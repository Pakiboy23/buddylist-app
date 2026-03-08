import { describe, expect, it } from 'vitest';
import {
  applyDmStateEvent,
  mapRowsToUnreadDirectMessages,
  normalizeUnreadCount,
  type UserDmStateRowLite,
} from '@/lib/unread-dm';

describe('normalizeUnreadCount', () => {
  it('normalizes non-finite and negative values to zero', () => {
    expect(normalizeUnreadCount(null)).toBe(0);
    expect(normalizeUnreadCount(undefined)).toBe(0);
    expect(normalizeUnreadCount(-7)).toBe(0);
    expect(normalizeUnreadCount(Number.NaN)).toBe(0);
    expect(normalizeUnreadCount(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('floors finite positive values', () => {
    expect(normalizeUnreadCount(1)).toBe(1);
    expect(normalizeUnreadCount(2.9)).toBe(2);
  });
});

describe('mapRowsToUnreadDirectMessages', () => {
  it('maps rows into unread dictionary and omits non-positive rows', () => {
    const rows: UserDmStateRowLite[] = [
      { buddy_id: 'buddy-a', unread_count: 2 },
      { buddy_id: 'buddy-b', unread_count: 0 },
      { buddy_id: 'buddy-c', unread_count: -1 },
    ];

    expect(mapRowsToUnreadDirectMessages(rows)).toEqual({
      'buddy-a': 2,
    });
  });

  it('ignores invalid buddy ids', () => {
    const rows = [
      { buddy_id: null, unread_count: 4 },
      { buddy_id: '', unread_count: 3 },
      { buddy_id: 'buddy-d', unread_count: 1 },
    ] as UserDmStateRowLite[];

    expect(mapRowsToUnreadDirectMessages(rows)).toEqual({
      'buddy-d': 1,
    });
  });
});

describe('applyDmStateEvent', () => {
  it('applies INSERT and UPDATE deterministically', () => {
    let unread = applyDmStateEvent({}, 'INSERT', { buddy_id: 'buddy-a', unread_count: 1 });
    expect(unread).toEqual({ 'buddy-a': 1 });

    unread = applyDmStateEvent(unread, 'UPDATE', { buddy_id: 'buddy-a', unread_count: 3 });
    expect(unread).toEqual({ 'buddy-a': 3 });
  });

  it('removes entries on DELETE and on non-positive unread', () => {
    let unread: Record<string, number> = { 'buddy-a': 2, 'buddy-b': 1 };
    unread = applyDmStateEvent(unread, 'DELETE', { buddy_id: 'buddy-b' });
    expect(unread).toEqual({ 'buddy-a': 2 });

    unread = applyDmStateEvent(unread, 'UPDATE', { buddy_id: 'buddy-a', unread_count: 0 });
    expect(unread).toEqual({});
  });

  it('returns the same object when update is idempotent', () => {
    const unread = { 'buddy-a': 2 };
    const next = applyDmStateEvent(unread, 'UPDATE', { buddy_id: 'buddy-a', unread_count: 2 });
    expect(next).toBe(unread);
  });
});
