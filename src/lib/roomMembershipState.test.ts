import { describe, expect, it } from 'vitest';

import {
  CHAT_STATE_CACHE_VERSION,
  parseChatStateCache,
  syncRoomsFromMembershipRows,
  type RoomMembershipRow,
  type StoredRoomState,
} from '@/lib/roomMembershipState';

const JOINED_AT = '2026-09-01T00:00:00.000Z';

const membershipRows: RoomMembershipRow[] = [
  {
    room_id: 'room-1',
    joined_at: JOINED_AT,
    rooms: { slug: 'late-night', name: 'Late Night' },
  },
];

function positiveRoomUnread(rooms: readonly unknown[]) {
  return rooms.reduce<number>((sum, room) => {
    if (!room || typeof room !== 'object' || !('unreadCount' in room)) {
      return sum;
    }
    const count = (room as { unreadCount?: unknown }).unreadCount;
    return typeof count === 'number' && Number.isFinite(count) && count > 0 ? sum + count : sum;
  }, 0);
}

describe('syncRoomsFromMembershipRows', () => {
  it('cannot produce a positive room unread from membership rows or stale memory', () => {
    const previous = [
      {
        roomId: 'room-1',
        roomSlug: 'late-night',
        roomName: 'Late Night',
        joinedAt: JOINED_AT,
        unreadCount: 6,
      },
    ];
    const rows = membershipRows.map((row) => ({ ...row, unread_count: 9 }));

    const synced = syncRoomsFromMembershipRows(previous, rows);

    expect(synced).toEqual([
      {
        roomId: 'room-1',
        roomSlug: 'late-night',
        roomName: 'Late Night',
        joinedAt: JOINED_AT,
      },
    ]);
    expect(positiveRoomUnread(synced)).toBe(0);
    expect(synced.every((room) => !('unreadCount' in room))).toBe(true);
  });

  it('keeps a clean equal membership list instead of copying an unread field', () => {
    const previous: StoredRoomState[] = [
      {
        roomId: 'room-1',
        roomSlug: 'late-night',
        roomName: 'Late Night',
        joinedAt: JOINED_AT,
      },
    ];

    expect(syncRoomsFromMembershipRows(previous, membershipRows)).toBe(previous);
  });
});

describe('chat state cache version 3', () => {
  it('loads joined rooms from the versioned envelope and ignores unreadCount', () => {
    const raw = JSON.stringify({
      version: CHAT_STATE_CACHE_VERSION,
      savedAt: '2026-09-20T12:00:00.000Z',
      data: {
        rooms: [
          {
            roomId: 'room-1',
            roomSlug: 'late-night',
            roomName: 'Late Night',
            joinedAt: JOINED_AT,
            unreadCount: 4,
          },
        ],
      },
    });

    const rooms = parseChatStateCache(raw, Date.parse('2026-09-20T12:00:00.000Z'));

    expect(rooms).toEqual([
      {
        roomId: 'room-1',
        roomSlug: 'late-night',
        roomName: 'Late Night',
        joinedAt: JOINED_AT,
      },
    ]);
    expect(positiveRoomUnread(rooms)).toBe(0);

    const synced = syncRoomsFromMembershipRows(rooms, membershipRows);
    expect(positiveRoomUnread(synced)).toBe(0);
    expect(synced).toBe(rooms);
  });

  it('ignores unreadCount on a flat version 3 room list', () => {
    const raw = JSON.stringify({
      version: 3,
      savedAt: '2026-09-20T12:00:00.000Z',
      rooms: [
        {
          roomId: 'room-1',
          roomSlug: 'late-night',
          roomName: 'Late Night',
          joinedAt: JOINED_AT,
          unreadCount: 2,
        },
      ],
    });

    const rooms = parseChatStateCache(raw, Date.parse('2026-09-20T12:00:00.000Z'));
    expect(rooms[0]).not.toHaveProperty('unreadCount');
    expect(positiveRoomUnread(syncRoomsFromMembershipRows(rooms, membershipRows))).toBe(0);
  });
});
