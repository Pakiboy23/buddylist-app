import { describe, expect, it } from 'vitest';
import {
  buildBuddyCircleIndex,
  normalizeBuddyCircle,
  normalizeBuddyCircles,
} from '@/lib/buddyCircles';

describe('normalizeBuddyCircle', () => {
  it('parses a circle and dedupes member buddy ids', () => {
    expect(
      normalizeBuddyCircle({
        id: 'circle-1',
        name: 'Besties',
        position: 2,
        show_presence: true,
        notify_mode: 'all',
        buddy_circle_members: [
          { buddy_id: 'buddy-a' },
          { buddy_id: 'buddy-a' },
          { buddy_id: 'buddy-b' },
        ],
      }),
    ).toEqual({
      id: 'circle-1',
      name: 'Besties',
      position: 2,
      showPresence: true,
      notifyMode: 'all',
      memberBuddyIds: ['buddy-a', 'buddy-b'],
    });
  });

  it('defaults show_presence to true and notify_mode to all when absent or invalid', () => {
    const circle = normalizeBuddyCircle({ id: 'c', name: 'Work', notify_mode: 'bogus' });
    expect(circle?.showPresence).toBe(true);
    expect(circle?.notifyMode).toBe('all');
    expect(circle?.memberBuddyIds).toEqual([]);
  });

  it('honors muted notify_mode and hidden presence', () => {
    const circle = normalizeBuddyCircle({
      id: 'c',
      name: 'Acquaintances',
      show_presence: false,
      notify_mode: 'muted',
    });
    expect(circle?.showPresence).toBe(false);
    expect(circle?.notifyMode).toBe('muted');
  });

  it('rejects rows missing id or name', () => {
    expect(normalizeBuddyCircle({ id: '', name: 'x' })).toBeNull();
    expect(normalizeBuddyCircle({ id: 'x', name: '   ' })).toBeNull();
    expect(normalizeBuddyCircle(null)).toBeNull();
  });
});

describe('normalizeBuddyCircles', () => {
  it('drops malformed rows and sorts by position then name', () => {
    expect(
      normalizeBuddyCircles([
        { id: 'b', name: 'Work', position: 1 },
        { id: 'c', name: 'Apple', position: 0 },
        { id: 'd', name: 'Zebra', position: 0 },
        null,
        { id: '', name: 'broken' },
      ]),
    ).toEqual([
      { id: 'c', name: 'Apple', position: 0, showPresence: true, notifyMode: 'all', memberBuddyIds: [] },
      { id: 'd', name: 'Zebra', position: 0, showPresence: true, notifyMode: 'all', memberBuddyIds: [] },
      { id: 'b', name: 'Work', position: 1, showPresence: true, notifyMode: 'all', memberBuddyIds: [] },
    ]);
  });

  it('returns an empty list for non-array input', () => {
    expect(normalizeBuddyCircles(null)).toEqual([]);
  });
});

describe('buildBuddyCircleIndex', () => {
  it('maps each buddy to its circle', () => {
    const circles = normalizeBuddyCircles([
      { id: 'work', name: 'Work', position: 0, buddy_circle_members: [{ buddy_id: 'b1' }] },
      { id: 'fam', name: 'Family', position: 1, buddy_circle_members: [{ buddy_id: 'b2' }] },
    ]);
    const index = buildBuddyCircleIndex(circles);
    expect(index.get('b1')?.id).toBe('work');
    expect(index.get('b2')?.id).toBe('fam');
    expect(index.has('b3')).toBe(false);
  });

  it('keeps the first circle when a buddy id appears more than once', () => {
    const circles = normalizeBuddyCircles([
      { id: 'first', name: 'A First', position: 0, buddy_circle_members: [{ buddy_id: 'dupe' }] },
      { id: 'second', name: 'B Second', position: 1, buddy_circle_members: [{ buddy_id: 'dupe' }] },
    ]);
    expect(buildBuddyCircleIndex(circles).get('dupe')?.id).toBe('first');
  });
});
