import { describe, expect, it } from 'vitest';
import {
  filterExpiredMessages,
  formatDisappearingTimerLabel,
  getMessageExpiresAt,
  normalizeBlockedUserIds,
} from '@/lib/trustSafety';

describe('normalizeBlockedUserIds', () => {
  it('dedupes and extracts blocked ids from mixed row shapes', () => {
    expect(
      normalizeBlockedUserIds([
        { blocked_id: 'buddy-1' },
        { blockedId: 'buddy-2' },
        { blocked_id: 'buddy-1' },
      ]),
    ).toEqual(['buddy-1', 'buddy-2']);
  });
});

describe('formatDisappearingTimerLabel', () => {
  it('formats short labels for common timer values', () => {
    expect(formatDisappearingTimerLabel(null, { short: true })).toBe('Off');
    expect(formatDisappearingTimerLabel(300, { short: true })).toBe('5m');
    expect(formatDisappearingTimerLabel(3600, { short: true })).toBe('1h');
    expect(formatDisappearingTimerLabel(86400, { short: true })).toBe('1d');
  });
});

describe('getMessageExpiresAt', () => {
  it('returns a future timestamp when a timer is configured', () => {
    expect(getMessageExpiresAt(300, Date.UTC(2026, 2, 28, 10, 0, 0))).toBe('2026-03-28T10:05:00.000Z');
  });
});

describe('filterExpiredMessages', () => {
  it('removes expired messages and keeps active ones', () => {
    expect(
      filterExpiredMessages(
        [
          { id: 1, expires_at: '2026-03-28T10:00:00.000Z' },
          { id: 2, expires_at: '2026-03-28T10:10:00.000Z' },
          { id: 3, expires_at: null },
        ],
        Date.UTC(2026, 2, 28, 10, 5, 0),
      ).map((message) => message.id),
    ).toEqual([2, 3]);
  });
});
