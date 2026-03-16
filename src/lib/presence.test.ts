import { describe, expect, it } from 'vitest';
import {
  getPresenceDetail,
  getPresenceLabel,
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
