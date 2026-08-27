import { describe, expect, it } from 'vitest';
import {
  getPresenceDetail,
  getPresenceLabel,
  getStatusNote,
  isAwayStatus,
  resolvePresenceState,
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
