import { describe, expect, it } from 'vitest';

import { countSeenByOthers, formatSeenByLabel } from '@/lib/roomReadReceipts';

const SENDER = 'sender-1';
const MESSAGE_AT = '2026-07-20T12:00:00.000Z';

describe('countSeenByOthers', () => {
  it('counts members whose last_seen_at is at or after the message time', () => {
    const members = {
      [SENDER]: '2026-07-20T12:05:00.000Z',
      'reader-1': '2026-07-20T12:00:00.000Z',
      'reader-2': '2026-07-20T12:03:00.000Z',
      'left-earlier': '2026-07-20T11:59:59.000Z',
    };
    expect(countSeenByOthers(members, SENDER, MESSAGE_AT)).toBe(2);
  });

  it('never counts the sender themself', () => {
    expect(countSeenByOthers({ [SENDER]: '2026-07-20T13:00:00.000Z' }, SENDER, MESSAGE_AT)).toBe(0);
  });

  it('ignores malformed timestamps instead of counting them', () => {
    const members = {
      'reader-1': 'not-a-date',
      'reader-2': '2026-07-20T12:10:00.000Z',
    };
    expect(countSeenByOthers(members, SENDER, MESSAGE_AT)).toBe(1);
    expect(countSeenByOthers(members, SENDER, 'not-a-date')).toBe(0);
  });

  it('returns 0 for an empty room', () => {
    expect(countSeenByOthers({}, SENDER, MESSAGE_AT)).toBe(0);
  });
});

describe('formatSeenByLabel', () => {
  it('hides the label until someone has seen the message', () => {
    expect(formatSeenByLabel(0)).toBeNull();
    expect(formatSeenByLabel(-1)).toBeNull();
  });

  it('formats counts', () => {
    expect(formatSeenByLabel(1)).toBe('Seen by 1');
    expect(formatSeenByLabel(4)).toBe('Seen by 4');
  });
});
