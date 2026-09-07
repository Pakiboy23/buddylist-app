import { describe, expect, it } from 'vitest';
import {
  canViewerSeeActivity,
  derivePresenceState,
  getPresenceDetail,
  getPresenceLabel,
  getStatusNote,
  isAwayStatus,
  isRecentlyActive,
  maskPresenceSignals,
  resolvePresenceState,
  resolveVisiblePresence,
} from '@/lib/presence';

describe('isAwayStatus', () => {
  it('matches away case-insensitively', () => {
    expect(isAwayStatus('Away')).toBe(true);
    expect(isAwayStatus('away')).toBe(true);
    expect(isAwayStatus('Busy')).toBe(false);
    expect(isAwayStatus(null)).toBe(false);
  });
});

describe('resolvePresenceState', () => {
  it('prefers offline over stale idle data', () => {
    expect(
      resolvePresenceState({
        isOnline: false,
        status: 'Available',
        idleSince: '2026-03-16T08:00:00.000Z',
      }),
    ).toBe('offline');
  });

  it('prefers away over idle when both are present', () => {
    expect(
      resolvePresenceState({
        isOnline: true,
        status: 'Away',
        idleSince: '2026-03-16T08:00:00.000Z',
      }),
    ).toBe('away');
  });

  it('marks online idle users distinctly', () => {
    expect(
      resolvePresenceState({
        isOnline: true,
        status: 'Available',
        idleSince: '2026-03-16T08:00:00.000Z',
      }),
    ).toBe('idle');
  });

  it('falls back to available when online and active', () => {
    expect(
      resolvePresenceState({
        isOnline: true,
        status: 'Available',
        idleSince: null,
      }),
    ).toBe('available');
  });
});

describe('isRecentlyActive', () => {
  const now = Date.parse('2026-09-07T12:00:00.000Z');

  it('treats a missing or invalid stamp as not recently active', () => {
    expect(isRecentlyActive(null, now)).toBe(false);
    expect(isRecentlyActive('not-a-date', now)).toBe(false);
  });

  it('is true inside the 24h window and false at or beyond it', () => {
    expect(isRecentlyActive('2026-09-07T11:00:00.000Z', now)).toBe(true);
    expect(isRecentlyActive('2026-09-06T12:00:00.001Z', now)).toBe(true);
    expect(isRecentlyActive('2026-09-06T12:00:00.000Z', now)).toBe(false);
    expect(isRecentlyActive('2026-08-26T12:00:00.000Z', now)).toBe(false);
  });
});

describe('derivePresenceState', () => {
  const now = Date.parse('2026-09-07T12:00:00.000Z');

  it('prefers an explicit realtime isOnline over last_active_at', () => {
    expect(
      derivePresenceState({
        isOnline: false,
        status: 'Available',
        lastActiveAt: '2026-09-07T11:55:00.000Z',
        now,
      }),
    ).toBe('offline');
    expect(
      derivePresenceState({
        isOnline: true,
        status: 'Away',
        lastActiveAt: '2026-08-01T12:00:00.000Z',
        now,
      }),
    ).toBe('away');
  });

  it('infers offline from a stale last_active_at when realtime is absent', () => {
    expect(
      derivePresenceState({
        status: 'Available',
        lastActiveAt: '2026-08-26T12:00:00.000Z',
        now,
      }),
    ).toBe('offline');
  });

  it('keeps away when last_active_at is still inside the window', () => {
    expect(
      derivePresenceState({
        status: 'Away',
        lastActiveAt: '2026-09-07T11:50:00.000Z',
        now,
      }),
    ).toBe('away');
  });

  it('marks idle when signed on and idle_since is set', () => {
    expect(
      derivePresenceState({
        status: 'Available',
        idleSince: '2026-09-07T11:40:00.000Z',
        lastActiveAt: '2026-09-07T11:40:00.000Z',
        now,
      }),
    ).toBe('idle');
  });
});

describe('presence privacy gating', () => {
  const now = Date.parse('2026-09-07T12:00:00.000Z');

  it('lets a person always see their own activity', () => {
    expect(canViewerSeeActivity(false, { isSelf: true })).toBe(true);
    expect(canViewerSeeActivity(true, { isSelf: true })).toBe(true);
  });

  it('defaults missing rows to visible and honors an explicit off', () => {
    expect(canViewerSeeActivity(undefined)).toBe(true);
    expect(canViewerSeeActivity(null)).toBe(true);
    expect(canViewerSeeActivity(true)).toBe(true);
    expect(canViewerSeeActivity(false)).toBe(false);
  });

  it('nulls live signals for other viewers when the toggle is off', () => {
    expect(
      maskPresenceSignals({
        showOnlineStatus: false,
        isOnline: true,
        status: 'Away',
        idleSince: '2026-09-07T11:00:00.000Z',
        lastActiveAt: '2026-09-07T11:55:00.000Z',
      }),
    ).toEqual({
      isOnline: false,
      status: null,
      idleSince: null,
      lastActiveAt: null,
    });
  });

  it('keeps the truth for the owner even when the toggle is off', () => {
    const visible = resolveVisiblePresence({
      isSelf: true,
      showOnlineStatus: false,
      isOnline: true,
      status: 'Available',
      lastActiveAt: '2026-09-07T11:55:00.000Z',
      now,
    });
    expect(visible.activityVisible).toBe(true);
    expect(visible.state).toBe('available');
    expect(visible.lastActiveAt).toBe('2026-09-07T11:55:00.000Z');
  });

  it('hides chips and last-active from others when the toggle is off', () => {
    const hidden = resolveVisiblePresence({
      showOnlineStatus: false,
      isOnline: true,
      status: 'Available',
      lastActiveAt: '2026-09-07T11:55:00.000Z',
      now,
    });
    expect(hidden.activityVisible).toBe(false);
    expect(hidden.state).toBe('offline');
    expect(hidden.lastActiveAt).toBeNull();
    expect(hidden.status).toBeNull();
  });
});

describe('getPresenceLabel', () => {
  it('returns user-facing presence copy', () => {
    expect(getPresenceLabel('available')).toBe('Available');
    expect(getPresenceLabel('idle')).toBe('Idle');
    expect(getPresenceLabel('away')).toBe('Away');
    expect(getPresenceLabel('offline')).toBe('Offline');
  });
});

describe('getPresenceDetail', () => {
  it('uses away message for away buddies', () => {
    expect(
      getPresenceDetail({
        state: 'away',
        awayMessage: 'Out grabbing coffee.',
      }),
    ).toBe('Out grabbing coffee.');
  });

  it('uses status line for available buddies', () => {
    expect(
      getPresenceDetail({
        state: 'available',
        statusMessage: 'Focused and listening.',
      }),
    ).toBe('Focused and listening.');
  });
});

describe('getStatusNote', () => {
  it('shows the away message while away', () => {
    expect(
      getStatusNote({ state: 'away', awayMessage: 'brb — chai run', statusMessage: 'ignored' }),
    ).toBe('brb — chai run');
  });

  it('keeps a set away message readable even when the buddy is offline', () => {
    expect(
      getStatusNote({ state: 'offline', awayMessage: 'gone camping til Sunday', statusMessage: '' }),
    ).toBe('gone camping til Sunday');
  });

  it('prefers the status line outside of away', () => {
    expect(
      getStatusNote({ state: 'available', awayMessage: 'old away note', statusMessage: 'new phone who dis' }),
    ).toBe('new phone who dis');
    expect(
      getStatusNote({ state: 'offline', awayMessage: 'old away note', statusMessage: 'catch me in Late Night' }),
    ).toBe('catch me in Late Night');
  });

  it('returns null when nothing is authored — never a synthesized fallback', () => {
    expect(getStatusNote({ state: 'offline', awayMessage: '', statusMessage: '  ' })).toBeNull();
    expect(getStatusNote({ state: 'available', awayMessage: null, statusMessage: null })).toBeNull();
    expect(getStatusNote({ state: 'away', awayMessage: '', statusMessage: 'status line' })).toBeNull();
  });

  it('trims whitespace', () => {
    expect(getStatusNote({ state: 'idle', awayMessage: '  window seat  ', statusMessage: '' })).toBe('window seat');
  });
});
