import { describe, expect, it } from 'vitest';
import {
  ARCHIVED_BUDDY_GROUP_ID,
  OFFLINE_BUDDY_GROUP_ID,
  ONLINE_BUDDY_GROUP_ID,
  REQUESTS_BUDDY_GROUP_ID,
  buildBuddyListGroups,
} from '@/lib/buddyListGroups';

function buddy(id: string, screenname: string) {
  return { id, screenname };
}

describe('buildBuddyListGroups', () => {
  it('splits signed-on buddies into Online and everyone else into Offline', () => {
    const groups = buildBuddyListGroups({
      buddies: [buddy('a', 'alex'), buddy('b', 'blake'), buddy('c', 'casey')],
      isSignedOn: (member) => member.id !== 'b',
    });

    expect(groups.online).toEqual({
      id: ONLINE_BUDDY_GROUP_ID,
      name: 'Online',
      totalCount: 2,
      rows: [buddy('a', 'alex'), buddy('c', 'casey')],
    });
    expect(groups.offline).toEqual({
      id: OFFLINE_BUDDY_GROUP_ID,
      name: 'Offline',
      totalCount: 1,
      rows: [buddy('b', 'blake')],
    });
    expect(groups.totalOnline).toBe(2);
    expect(groups.totalBuddies).toBe(3);
    expect(groups.hasQuery).toBe(false);
    expect(groups.query).toBe('');
  });

  it('filters visible rows by screenname without changing header totals', () => {
    const groups = buildBuddyListGroups({
      buddies: [buddy('a', 'Alex'), buddy('b', 'blake'), buddy('c', 'Casey')],
      isSignedOn: (member) => member.id !== 'b',
      query: '  ale  ',
    });

    expect(groups.hasQuery).toBe(true);
    expect(groups.query).toBe('ale');
    expect(groups.online.totalCount).toBe(2);
    expect(groups.online.rows).toEqual([buddy('a', 'Alex')]);
    expect(groups.offline.totalCount).toBe(1);
    expect(groups.offline.rows).toEqual([]);
    expect(groups.totalOnline).toBe(2);
    expect(groups.totalBuddies).toBe(3);
  });

  it('returns empty sections when there are no buddies', () => {
    const groups = buildBuddyListGroups({
      buddies: [],
      isSignedOn: () => true,
    });

    expect(groups.online.rows).toEqual([]);
    expect(groups.offline.rows).toEqual([]);
    expect(groups.totalOnline).toBe(0);
    expect(groups.totalBuddies).toBe(0);
  });

  it('keeps the stable pseudo-group ids used by collapse persistence', () => {
    expect(ONLINE_BUDDY_GROUP_ID).toBe('__online__');
    expect(OFFLINE_BUDDY_GROUP_ID).toBe('__offline__');
    expect(REQUESTS_BUDDY_GROUP_ID).toBe('__requests__');
    expect(ARCHIVED_BUDDY_GROUP_ID).toBe('__archived__');
  });
});
