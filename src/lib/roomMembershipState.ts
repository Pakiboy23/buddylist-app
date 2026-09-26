/**
 * Joined-room cache and membership sync.
 *
 * Rooms v2 dropped user_active_rooms.unread_count. Cache version 3 may still
 * carry unreadCount from the old client; readers drop that field. Membership
 * rows selected for sync do not include an unread count, and sync must not
 * copy one forward from memory.
 *
 * The seeded catalog description is part of the room. Sync selects it with
 * the membership and the cache keeps that line so joined cards do not guess
 * a tag from the slug.
 */

export interface StoredRoomState {
  roomId: string;
  roomSlug: string;
  roomName: string;
  roomDescription: string;
  joinedAt: string | null;
}

interface RoomCatalogFields {
  slug: string;
  name: string;
  description?: string | null;
}

export interface RoomMembershipRow {
  room_id: string;
  joined_at: string | null;
  rooms: RoomCatalogFields | RoomCatalogFields[] | null;
}

export const CHAT_STATE_CACHE_VERSION = 3;

const CHAT_STATE_ROOM_LIMIT = 250;
const CHAT_STATE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function sortStoredRooms(rooms: StoredRoomState[]) {
  return [...rooms]
    .sort((left, right) => {
      const leftTime = left.joinedAt ? Date.parse(left.joinedAt) : 0;
      const rightTime = right.joinedAt ? Date.parse(right.joinedAt) : 0;
      if (leftTime !== rightTime) {
        return rightTime - leftTime;
      }
      return left.roomName.localeCompare(right.roomName, undefined, { sensitivity: 'base' });
    })
    .slice(0, CHAT_STATE_ROOM_LIMIT);
}

export function coerceStoredRoom(value: unknown): StoredRoomState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as {
    roomId?: unknown;
    roomSlug?: unknown;
    roomName?: unknown;
    roomDescription?: unknown;
    joinedAt?: unknown;
  };
  const roomId = typeof candidate.roomId === 'string' ? candidate.roomId : '';
  const roomSlug = typeof candidate.roomSlug === 'string' ? candidate.roomSlug.trim() : '';
  const roomName = typeof candidate.roomName === 'string' ? candidate.roomName.trim() : '';
  if (!roomId || !roomSlug || !roomName) {
    return null;
  }

  return {
    roomId,
    roomSlug,
    roomName,
    roomDescription: typeof candidate.roomDescription === 'string' ? candidate.roomDescription.trim() : '',
    joinedAt: typeof candidate.joinedAt === 'string' ? candidate.joinedAt : null,
  };
}

function isCleanStoredRoom(value: unknown): value is StoredRoomState {
  if (!value || typeof value !== 'object' || Array.isArray(value) || 'unreadCount' in value) {
    return false;
  }

  const coerced = coerceStoredRoom(value);
  if (!coerced) {
    return false;
  }

  const candidate = value as StoredRoomState;
  return (
    candidate.roomId === coerced.roomId &&
    candidate.roomSlug === coerced.roomSlug &&
    candidate.roomName === coerced.roomName &&
    candidate.roomDescription === coerced.roomDescription &&
    candidate.joinedAt === coerced.joinedAt
  );
}

function readCachedRoomList(payload: object): unknown[] | null {
  const candidate = payload as { rooms?: unknown; data?: unknown };
  if (Array.isArray(candidate.rooms)) {
    return candidate.rooms;
  }

  if (candidate.data && typeof candidate.data === 'object') {
    const dataRooms = (candidate.data as { rooms?: unknown }).rooms;
    if (Array.isArray(dataRooms)) {
      return dataRooms;
    }
  }

  return null;
}

export function normalizeCachedRooms(payload: unknown, nowMs = Date.now()): StoredRoomState[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const candidate = payload as { version?: unknown; savedAt?: unknown };
  if (typeof candidate.version === 'number' && candidate.version > CHAT_STATE_CACHE_VERSION) {
    return [];
  }

  if (typeof candidate.savedAt === 'string') {
    const savedAtMs = Date.parse(candidate.savedAt);
    if (Number.isNaN(savedAtMs) || nowMs - savedAtMs > CHAT_STATE_CACHE_TTL_MS) {
      return [];
    }
  }

  const rooms = readCachedRoomList(payload);
  if (!rooms) {
    return [];
  }

  const normalizedRooms = rooms
    .map((room) => coerceStoredRoom(room))
    .filter((room): room is StoredRoomState => Boolean(room));

  return sortStoredRooms(Array.from(new Map(normalizedRooms.map((room) => [room.roomId, room])).values()));
}

export function parseChatStateCache(raw: string | null, nowMs = Date.now()): StoredRoomState[] {
  if (!raw) {
    return [];
  }

  try {
    return normalizeCachedRooms(JSON.parse(raw) as unknown, nowMs);
  } catch {
    return [];
  }
}

export function mapMembershipRowsToStoredRooms(rows: readonly RoomMembershipRow[]): StoredRoomState[] {
  const mapped = rows
    .map((row) => {
      const roomData = Array.isArray(row.rooms) ? row.rooms[0] ?? null : row.rooms;
      const roomSlug = roomData?.slug?.trim() ?? '';
      const roomName = roomData?.name?.trim() ?? '';
      const roomDescription = roomData?.description?.trim() ?? '';
      if (!row.room_id || !roomSlug || !roomName) {
        return null;
      }

      return {
        roomId: row.room_id,
        roomSlug,
        roomName,
        roomDescription,
        joinedAt: typeof row.joined_at === 'string' ? row.joined_at : null,
      } satisfies StoredRoomState;
    })
    .filter((room): room is StoredRoomState => Boolean(room));

  return sortStoredRooms(Array.from(new Map(mapped.map((room) => [room.roomId, room])).values()));
}

function areRoomsEqual(left: readonly StoredRoomState[], right: readonly StoredRoomState[]) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftRoom = left[index];
    const rightRoom = right[index];
    if (
      leftRoom.roomId !== rightRoom.roomId ||
      leftRoom.roomSlug !== rightRoom.roomSlug ||
      leftRoom.roomName !== rightRoom.roomName ||
      leftRoom.roomDescription !== rightRoom.roomDescription
    ) {
      return false;
    }
  }

  return true;
}

export function mergeStoredRooms(
  previous: readonly unknown[],
  nextRooms: StoredRoomState[],
): StoredRoomState[] {
  if (!previous.every(isCleanStoredRoom)) {
    return nextRooms;
  }

  if (!areRoomsEqual(previous, nextRooms)) {
    return nextRooms;
  }

  return previous as StoredRoomState[];
}

export function syncRoomsFromMembershipRows(
  previous: readonly unknown[],
  rows: readonly RoomMembershipRow[],
): StoredRoomState[] {
  return mergeStoredRooms(previous, mapMembershipRowsToStoredRooms(rows));
}
