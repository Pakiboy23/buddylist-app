import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { waitForSessionOrNull } from '@/lib/authClient';
import { getRaw, removeValue, setVersionedData, subscribeToStorageKey } from '@/lib/clientStorage';
import { setAppBadgeCount } from '@/lib/badge';
import { initSoundSystem, playUiSound } from '@/lib/sound';
import { supabase } from '@/lib/supabase';

type SoundType = 'join' | 'leave' | 'message';
export type ChatSyncState = 'idle' | 'hydrating' | 'syncing' | 'live' | 'error';

export interface JoinedRoom {
  id: string;
  slug: string;
  name: string;
  unreadCount: number;
}

interface ChatContextValue {
  activeRooms: string[];
  joinedRooms: JoinedRoom[];
  unreadMessages: Record<string, number>;
  isHydrated: boolean;
  syncState: ChatSyncState;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  playChatSound: (type: SoundType) => void;
  joinRoom: (roomId: string, roomSlug: string, roomName: string) => Promise<void>;
  leaveRoom: (roomId: string) => Promise<void>;
  clearUnreads: (roomId: string) => Promise<void>;
  resetChatState: () => Promise<void>;
  syncFromServer: () => Promise<void>;
}

const SOUND_MAP: Record<SoundType, string> = {
  join: '/sounds/door_creak.mp3',
  leave: '/sounds/door_slam.mp3',
  message: '/sounds/im_receive.mp3',
};

const CHAT_STATE_CACHE_PREFIX = 'hiitsme:chatstate:v3:';
const CHAT_STATE_CACHE_VERSION = 3;
const CHAT_STATE_WRITE_DEBOUNCE_MS = 180;
const CHAT_STATE_ROOM_LIMIT = 250;
const CHAT_STATE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SYNC_RETRY_DELAYS_MS = [1500, 4000, 10000] as const;

interface StoredRoomState {
  roomId: string;
  roomSlug: string;
  roomName: string;
  unreadCount: number;
  joinedAt: string | null;
}

interface PersistedChatState {
  version?: number;
  savedAt?: string;
  rooms: StoredRoomState[];
}

type CacheSource = 'current' | 'none';

interface RoomMembershipRow {
  room_id: string;
  joined_at: string | null;
  rooms: { slug: string; name: string } | { slug: string; name: string }[] | null;
}

const ChatContext = createContext<ChatContextValue | null>(null);

function getCacheKey(userId: string) {
  return `${CHAT_STATE_CACHE_PREFIX}${userId}`;
}

function sortRooms(rooms: StoredRoomState[]) {
  return [...rooms].sort((left, right) => {
    const leftTime = left.joinedAt ? Date.parse(left.joinedAt) : 0;
    const rightTime = right.joinedAt ? Date.parse(right.joinedAt) : 0;
    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }
    return left.roomName.localeCompare(right.roomName, undefined, { sensitivity: 'base' });
  }).slice(0, CHAT_STATE_ROOM_LIMIT);
}

function coerceStoredRoom(value: unknown): StoredRoomState | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<StoredRoomState>;
  const roomId = typeof candidate.roomId === 'string' ? candidate.roomId : '';
  const roomSlug = typeof candidate.roomSlug === 'string' ? candidate.roomSlug.trim() : '';
  const roomName = typeof candidate.roomName === 'string' ? candidate.roomName.trim() : '';
  if (!roomId || !roomSlug || !roomName) {
    return null;
  }

  const unreadCandidate =
    typeof candidate.unreadCount === 'number' && Number.isFinite(candidate.unreadCount)
      ? candidate.unreadCount
      : 0;

  return {
    roomId,
    roomSlug,
    roomName,
    unreadCount: Math.max(0, Math.floor(unreadCandidate)),
    joinedAt: typeof candidate.joinedAt === 'string' ? candidate.joinedAt : null,
  };
}

function parseCachedPayload(raw: string | null): PersistedChatState | null {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const candidate = parsed as {
      version?: unknown;
      savedAt?: unknown;
      rooms?: unknown;
    };

    const rooms = Array.isArray(candidate.rooms) ? candidate.rooms : null;
    if (!rooms) {
      return null;
    }

    return {
      version: typeof candidate.version === 'number' ? candidate.version : undefined,
      savedAt: typeof candidate.savedAt === 'string' ? candidate.savedAt : undefined,
      rooms: rooms as StoredRoomState[],
    };
  } catch {
    return null;
  }
}

function normalizeCachedRooms(payload: PersistedChatState | null) {
  if (!payload) {
    return [];
  }

  if (typeof payload.version === 'number' && payload.version > CHAT_STATE_CACHE_VERSION) {
    return [];
  }

  if (typeof payload.savedAt === 'string') {
    const savedAtMs = Date.parse(payload.savedAt);
    if (Number.isNaN(savedAtMs) || Date.now() - savedAtMs > CHAT_STATE_CACHE_TTL_MS) {
      return [];
    }
  }

  const normalizedRooms = payload.rooms
    .map((room) => coerceStoredRoom(room))
    .filter((room): room is StoredRoomState => Boolean(room));
  return sortRooms(
    Array.from(new Map(normalizedRooms.map((room) => [room.roomId, room])).values()),
  );
}

function parseCachedRooms(userId: string): { rooms: StoredRoomState[]; source: CacheSource } {
  const currentPayload = parseCachedPayload(getRaw(getCacheKey(userId)));
  const currentRooms = normalizeCachedRooms(currentPayload);
  if (currentRooms.length > 0) {
    return { rooms: currentRooms, source: 'current' };
  }
  return { rooms: [], source: 'none' };
}

function writeCachedRooms(userId: string, rooms: StoredRoomState[]) {
  void setVersionedData(getCacheKey(userId), CHAT_STATE_CACHE_VERSION, { rooms }, { maxBytes: 96 * 1024 });
}

function deleteCachedRooms(userId: string | null) {
  if (!userId) {
    return;
  }
  removeValue(getCacheKey(userId));
}

function mapRowsToStoredRooms(rows: RoomMembershipRow[]): StoredRoomState[] {
  const mapped = rows
    .map((row) => {
      const roomData = Array.isArray(row.rooms) ? row.rooms[0] ?? null : row.rooms;
      const roomSlug = roomData?.slug?.trim() ?? '';
      const roomName = roomData?.name?.trim() ?? '';
      if (!row.room_id || !roomSlug || !roomName) {
        return null;
      }

      return {
        roomId: row.room_id,
        roomSlug,
        roomName,
        unreadCount: 0,
        joinedAt: typeof row.joined_at === 'string' ? row.joined_at : null,
      } satisfies StoredRoomState;
    })
    .filter((room): room is StoredRoomState => Boolean(room));

  return sortRooms(Array.from(new Map(mapped.map((room) => [room.roomId, room])).values()));
}

function areRoomsEqual(left: StoredRoomState[], right: StoredRoomState[]) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftRoom = left[index];
    const rightRoom = right[index];
    if (
      leftRoom.roomId !== rightRoom.roomId ||
      leftRoom.roomSlug !== rightRoom.roomSlug ||
      leftRoom.roomName !== rightRoom.roomName
    ) {
      return false;
    }
  }

  return true;
}

function upsertRoomState(previous: StoredRoomState[], room: StoredRoomState) {
  const next = previous.filter((item) => item.roomId !== room.roomId);
  next.push(room);
  return sortRooms(next);
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [userId, setUserId] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);
  const [syncState, setSyncState] = useState<ChatSyncState>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);
  const [rooms, setRooms] = useState<StoredRoomState[]>([]);
  const roomsRef = useRef<StoredRoomState[]>([]);
  const userIdRef = useRef<string | null>(null);
  const cacheWriteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const syncInFlightRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  useEffect(() => {
    initSoundSystem();
  }, []);

  const playChatSound = useCallback((type: SoundType) => {
    void playUiSound(SOUND_MAP[type]);
  }, []);

  const syncFromServer = useCallback(async () => {
    if (syncInFlightRef.current) {
      await syncInFlightRef.current;
      return;
    }

    const sessionUserId = userIdRef.current;
    if (!sessionUserId) {
      setRooms([]);
      setSyncState('idle');
      setLastSyncError(null);
      return;
    }

    const syncPromise = (async () => {
      setSyncState('syncing');
      setLastSyncError(null);

      for (let attempt = 0; attempt <= SYNC_RETRY_DELAYS_MS.length; attempt += 1) {
        const { data, error } = await supabase
          .from('room_memberships')
          .select('room_id, joined_at, rooms(slug, name)')
          .eq('user_id', sessionUserId)
          .order('joined_at', { ascending: false });

        if (!error) {
          const rows = (data ?? []) as RoomMembershipRow[];
          const nextRooms = mapRowsToStoredRooms(rows);

          setRooms((previous) => {
            if (!areRoomsEqual(previous, nextRooms)) {
              return nextRooms.map((next) => {
                const existing = previous.find((p) => p.roomId === next.roomId);
                return existing ? { ...next, unreadCount: existing.unreadCount } : next;
              });
            }
            return previous;
          });
          setLastSyncedAt(new Date().toISOString());
          setSyncState('live');
          return;
        }

        if (attempt < SYNC_RETRY_DELAYS_MS.length) {
          const delay = SYNC_RETRY_DELAYS_MS[attempt];
          await new Promise((resolve) => setTimeout(resolve, delay));
          if (userIdRef.current !== sessionUserId) {
            return;
          }
          continue;
        }

        setSyncState('error');
        setLastSyncError(error.message);
        console.error('Failed to sync room memberships after retries:', error.message);
      }
    })();

    syncInFlightRef.current = syncPromise;
    try {
      await syncPromise;
    } finally {
      if (syncInFlightRef.current === syncPromise) {
        syncInFlightRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadSession = async () => {
      const session = await waitForSessionOrNull();
      if (isCancelled) {
        return;
      }
      setUserId(session?.user.id ?? null);
      if (!session) {
        setIsHydrated(true);
        setRooms([]);
        setSyncState('idle');
        setLastSyncedAt(null);
        setLastSyncError(null);
      }
    };

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUserId(null);
        setRooms([]);
        setIsHydrated(true);
        setSyncState('idle');
        setLastSyncedAt(null);
        setLastSyncError(null);
        return;
      }

      setUserId(session.user.id);
    });

    return () => {
      isCancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const hydratePersistentState = async () => {
      if (!userId) {
        setRooms([]);
        setIsHydrated(true);
        setSyncState('idle');
        setLastSyncedAt(null);
        setLastSyncError(null);
        return;
      }

      setIsHydrated(false);
      setSyncState('hydrating');
      const { rooms: cachedRooms } = parseCachedRooms(userId);
      setRooms(cachedRooms.length > 0 ? cachedRooms : []);

      await syncFromServer();
      if (!isCancelled) {
        setIsHydrated(true);
      }
    };

    void hydratePersistentState();

    return () => {
      isCancelled = true;
    };
  }, [syncFromServer, userId]);

  useEffect(() => {
    if (!userId) {
      if (cacheWriteTimeoutRef.current) {
        clearTimeout(cacheWriteTimeoutRef.current);
        cacheWriteTimeoutRef.current = null;
      }
      return;
    }

    if (cacheWriteTimeoutRef.current) {
      clearTimeout(cacheWriteTimeoutRef.current);
    }

    cacheWriteTimeoutRef.current = setTimeout(() => {
      writeCachedRooms(userId, rooms);
      cacheWriteTimeoutRef.current = null;
    }, CHAT_STATE_WRITE_DEBOUNCE_MS);

    return () => {
      if (cacheWriteTimeoutRef.current) {
        clearTimeout(cacheWriteTimeoutRef.current);
        cacheWriteTimeoutRef.current = null;
      }
    };
  }, [rooms, userId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const flushPendingCacheWrite = () => {
      if (cacheWriteTimeoutRef.current && userIdRef.current) {
        clearTimeout(cacheWriteTimeoutRef.current);
        cacheWriteTimeoutRef.current = null;
        writeCachedRooms(userIdRef.current, roomsRef.current);
      }
    };

    window.addEventListener('beforeunload', flushPendingCacheWrite);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushPendingCacheWrite();
      }
    });

    return () => {
      window.removeEventListener('beforeunload', flushPendingCacheWrite);
    };
  }, []);

  useEffect(() => {
    if (!userId || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const handleOnline = () => {
      void syncFromServer();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncFromServer();
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [syncFromServer, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const unsubscribe = subscribeToStorageKey(getCacheKey(userId), (rawValue) => {
      const nextRooms = normalizeCachedRooms(parseCachedPayload(rawValue));
      if (nextRooms.length > 0) {
        setRooms((previous) => (areRoomsEqual(previous, nextRooms) ? previous : nextRooms));
      }
    });

    return () => {
      unsubscribe();
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const channel = supabase
      .channel(`room_memberships:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'room_memberships',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const oldRow = payload.old as Partial<{ room_id: string }>;
          const roomId = typeof oldRow.room_id === 'string' ? oldRow.room_id : '';
          if (!roomId) {
            return;
          }
          setRooms((previous) => previous.filter((room) => room.roomId !== roomId));
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_memberships',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          void syncFromServer();
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [syncFromServer, userId]);

  const joinRoom = useCallback(
    async (roomId: string, roomSlug: string, roomName: string) => {
      if (!roomId || !roomSlug || !roomName) {
        return;
      }

      const alreadyActive = roomsRef.current.some((room) => room.roomId === roomId);
      const optimisticRoom: StoredRoomState = {
        roomId,
        roomSlug,
        roomName,
        unreadCount: 0,
        joinedAt: new Date().toISOString(),
      };
      setRooms((previous) => upsertRoomState(previous, optimisticRoom));

      if (!alreadyActive) {
        playChatSound('join');
      }

      if (!userIdRef.current) {
        return;
      }

      const now = new Date().toISOString();
      const { error } = await supabase
        .from('room_memberships')
        .upsert(
          { room_id: roomId, user_id: userIdRef.current, joined_at: now, last_seen_at: now },
          { onConflict: 'room_id,user_id', ignoreDuplicates: true },
        );

      if (error) {
        console.error('Failed to persist room join:', error.message);
        await syncFromServer();
      }
    },
    [playChatSound, syncFromServer],
  );

  const leaveRoom = useCallback(
    async (roomId: string) => {
      if (!roomId) {
        return;
      }

      const existed = roomsRef.current.some((room) => room.roomId === roomId);
      setRooms((previous) => previous.filter((room) => room.roomId !== roomId));

      if (existed) {
        playChatSound('leave');
      }

      if (!userIdRef.current) {
        return;
      }

      const { error } = await supabase
        .from('room_memberships')
        .delete()
        .eq('room_id', roomId)
        .eq('user_id', userIdRef.current);

      if (error) {
        console.error('Failed to persist room leave:', error.message);
        await syncFromServer();
      }
    },
    [playChatSound, syncFromServer],
  );

  const clearUnreads = useCallback(
    async (roomId: string) => {
      if (!roomId) {
        return;
      }

      setRooms((previous) =>
        previous.map((room) =>
          room.roomId === roomId ? { ...room, unreadCount: 0 } : room,
        ),
      );

      if (!userIdRef.current) {
        return;
      }

      const { error } = await supabase
        .from('room_memberships')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('room_id', roomId)
        .eq('user_id', userIdRef.current);

      if (error) {
        console.error('Failed to update last_seen_at:', error.message);
      }
    },
    [],
  );

  const resetChatState = useCallback(async () => {
    deleteCachedRooms(userIdRef.current);
    setRooms([]);
    setLastSyncedAt(null);
    setLastSyncError(null);
    setSyncState('idle');
  }, []);

  const joinedRooms = useMemo<JoinedRoom[]>(
    () =>
      rooms.map((room) => ({
        id: room.roomId,
        slug: room.roomSlug,
        name: room.roomName,
        unreadCount: room.unreadCount,
      })),
    [rooms],
  );

  const activeRooms = useMemo(() => rooms.map((room) => room.roomSlug), [rooms]);

  const unreadMessages = useMemo(
    () =>
      rooms.reduce<Record<string, number>>((accumulator, room) => {
        accumulator[room.roomId] = room.unreadCount;
        return accumulator;
      }, {}),
    [rooms],
  );

  useEffect(() => {
    const total = Object.values(unreadMessages).reduce((sum, count) => sum + count, 0);
    void setAppBadgeCount(total);
  }, [unreadMessages]);

  const value = useMemo(
    () => ({
      activeRooms,
      joinedRooms,
      unreadMessages,
      isHydrated,
      syncState,
      lastSyncedAt,
      lastSyncError,
      playChatSound,
      joinRoom,
      leaveRoom,
      clearUnreads,
      resetChatState,
      syncFromServer,
    }),
    [
      activeRooms,
      joinedRooms,
      unreadMessages,
      isHydrated,
      syncState,
      lastSyncedAt,
      lastSyncError,
      playChatSound,
      joinRoom,
      leaveRoom,
      clearUnreads,
      resetChatState,
      syncFromServer,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within ChatProvider.');
  }
  return context;
}
