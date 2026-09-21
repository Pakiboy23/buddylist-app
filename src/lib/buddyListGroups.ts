export const ONLINE_BUDDY_GROUP_ID = '__online__';
export const OFFLINE_BUDDY_GROUP_ID = '__offline__';
export const REQUESTS_BUDDY_GROUP_ID = '__requests__';
export const ARCHIVED_BUDDY_GROUP_ID = '__archived__';

export interface BuddyListGroupMember {
  id: string;
  screenname: string;
}

export interface BuddyListSection<T> {
  id: string;
  name: string;
  totalCount: number;
  rows: T[];
}

export interface BuddyListGroups<T extends BuddyListGroupMember> {
  online: BuddyListSection<T>;
  offline: BuddyListSection<T>;
  totalOnline: number;
  totalBuddies: number;
  hasQuery: boolean;
  query: string;
}

/**
 * Flatten the buddy list into Online / Offline. Search narrows visible rows
 * without changing the header totals, matching the previous Find-a-Buddy
 * behavior.
 */
export function buildBuddyListGroups<T extends BuddyListGroupMember>(input: {
  buddies: T[];
  isSignedOn: (buddy: T) => boolean;
  query?: string;
}): BuddyListGroups<T> {
  const query = (input.query ?? '').trim().toLowerCase();
  const matchesQuery = (buddy: T) => !query || buddy.screenname.toLowerCase().includes(query);

  const onlineMembers = input.buddies.filter((buddy) => input.isSignedOn(buddy));
  const offlineMembers = input.buddies.filter((buddy) => !input.isSignedOn(buddy));

  return {
    online: {
      id: ONLINE_BUDDY_GROUP_ID,
      name: 'Online',
      totalCount: onlineMembers.length,
      rows: onlineMembers.filter(matchesQuery),
    },
    offline: {
      id: OFFLINE_BUDDY_GROUP_ID,
      name: 'Offline',
      totalCount: offlineMembers.length,
      rows: offlineMembers.filter(matchesQuery),
    },
    totalOnline: onlineMembers.length,
    totalBuddies: input.buddies.length,
    hasQuery: query.length > 0,
    query,
  };
}
