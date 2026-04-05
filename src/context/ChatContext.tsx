'use client';

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
import { normalizeRoomKey, normalizeRoomName } from '@/lib/roomName';
import { isUserActiveRoomsRoomKeyMissingError } from '@/lib/roomSchema';
import { initSoundSystem, playUiSound } from '@/lib/sound';
import { supabase } from '@/lib/supabase';

type SoundType = 'join' | 'leave' | 'message';
export type ChatSyncState = 'idle' | 'hydrating' | 'syncing' | 'live' | 'error';

interface ChatContextValue {
  activeRooms: string[];
  unreadMessages: Record<string, number>;
  isHydrated: boolean;
  syncState: ChatSyncState;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  playChatSound: (type: SoundType) => void;
  joinRoom: (roomName: string) => Promise<void>;
  leaveRoom: (roomName: string) => Promise<void>;
  clearUnreads: (roomName: string) => Promise<void>;
  resetChatState: () => Promise<void>;
  syncFromServer: () => Promise<void>;
}

const SOUND_MAP: Record<SoundType, string> = {
  join: '/sounds/door_creak.mp3',
  leave: '/sounds/door_slam.mp3',
  message: '/sounds/im_receive.mp3',
};

const CHAT_STATE_CACHE_PREFIX = 'buddylist:chatstate:v2:';
const LEGACY_CHAT_STATE_CACHE_PREFIX = 'buddylist:chatstate:';
const CHAT_STATE_CACHE_VERSION = 2;
const CHAT_STATE_WRITE_DEBOUNCE_MS = 180;
const CHAT_STATE_ROOM_LIMIT = 250;
const CHAT_STATE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SYNC_RETRY_DELAYS_MS = [1500, 4000, 10000] as const;

interface UserActiveRoomRow {
  user_id?: string;
  room_key: string | null;
  room_name: string | null;
  unread_count: number | null;
  updated_at?: string | null;
}

interface StoredRoomState {
  roomKey: string;
  roomName: string;
  unreadCount: number;
  updatedAt: string | null;
}

interface PersistedChatState {
  version?: number;
  savedAt?: string;
  rooms: StoredRoomState[];
}

type CacheSource = 'current' | 'legacy' | 'none';

const ChatContext = createContext<ChatContextValue | null>(null);

function getCacheKey(userId: string) {
  return `${CHAT_STATE_CACHE_PREFIX}${userId}`;
}

function getLegacyCacheKey(userId: string) {
  return `${LEGACY_CHAT_STATE_CACHE_PREFIX}${userId}`;
}

function sortRooms(rooms: StoredRoomState[]) {
  return [...rooms].sort((left, right) => {
    const leftTime = left.updatedAt ? Date.parse(left.updatedAt) : 0;
    const rightTime = right.updatedAt ? Date.parse(right.updatedAt) : 0;
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
  const roomName = typeof candidate.roomName === 'string' ? normalizeRoomName(candidate.roomName) : '';
  const roomKey = typeof candidate.roomKey === 'string' ? normalizeRoomKey(candidate.roomKey) : '';
  const normalizedKey = roomKey || normalizeRoomKey(roomName);
  if (!roomName || !normalizedKey) {
    return null;
  }

  const unreadCandidate =
    typeof candidate.unreadCount === 'number' && Number.isFinite(candidate.unreadCount)
      ? candidate.unreadCount
      : 0;

  return {
    roomName,
    roomKey: normalizedKey,
    unreadCount: Math.max(0, Math.floor(unreadCandidate)),
    updatedAt: typeof candidate.updatedAt === 'string' ? candidate.updatedAt : null,
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
      data?: { rooms?: unknown };
    };

    const dataRooms = candidate.data && typeof candidate.data === 'object' ? candidate.data.rooms : undefined;
    const rooms = Array.isArray(candidate.rooms) ? candidate.rooms : Array.isArray(dataRooms) ? dataRooms : null;
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
    Array.from(new Map(normalizedRooms.map((room) => [room.roomKey, room])).values()),
  );
}

function parseCachedRooms(userId: string): { rooms: StoredRoomState[]; source: CacheSource } {
  const currentPayload = parseCachedPayload(getRaw(getCacheKey(userId)));
  const currentRooms = normalizeCachedRooms(currentPayload);
  if (currentRooms.length > 0) {
    return { rooms: currentRooms, source: 'current' };
  }

  const legacyPayload = parseCachedPayload(getRaw(getLegacyCacheKey(userId)));
  const legacyRooms = normalizeCachedRooms(legacyPayload);
  if (legacyRooms.length > 0) {
    return { rooms: legacyRooms, source: 'legacy' };
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
  removeValue(getLegacyCacheKey(userId));
}

function mapRowsToStoredRooms(rows: UserActiveRoomRow[]) {
  const mapped = rows
    .map((row) => {
      const roomName = normalizeRoomName(typeof row.room_name === 'string' ? row.room_name : '');
      const normalizedKey = normalizeRoomKey(typeof row.room_key === 'string' ? row.room_key : roomName);
      if (!roomName || !normalizedKey) {
        return null;
      }

      return {
        roomKey: normalizedKey,
        roomName,
        unreadCount:
          typeof row.unread_count === 'number' && Number.isFinite(row.unread_count)
            ? Math.max(0, Math.floor(row.unread_count))
            : 0,
        updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
      } satisfies StoredRoomState;
    })
    .filter((room): room is StoredRoomState => Boolean(room));

  return sortRooms(Array.from(new Map(mapped.map((room) => [room.roomKey, room])).values()));
}

function areRoomsEqual(left: StoredRoomState[], right: StoredRoomState[]) {
  if (left.length !== right.length) {
    return false;
  }

  for (let index = 0; index < left.length; index += 1) {
    const leftRoom = left[index];
    const rightRoom = right[index];
    if (
      leftRoom.roomKey !== rightRoom.roomKey ||
      leftRoom.roomName !== rightRoom.roomName ||
      leftRoom.unreadCount !== rightRoom.unreadCount ||
      leftRoom.updatedAt !== rightRoom.updatedAt
    ) {
      return false;
    }
  }

  return true;
}

function upsertRoomState(
  previous: StoredRoomState[],
  room: StoredRoomState,
  merge: 'replace' | 'preserve_unread' = 'replace',
) {
  const existing = previous.find((item) => item.roomKey === room.roomKey);
  const nextRoom =
    merge === 'preserve_unread' && existing
      ? {
          ...room,
          unreadCount: existing.unreadCount,
        }
      : room;

  const next = previous.filter((item) => item.roomKey !== room.roomKey);
  next.push(nextRoom);
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
  const userActiveRoomKeySchemaUnavailableRef = useRef(false);

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
        let rows: UserActiveRoomRow[] = [];
        let error: { message: string; code?: string | null; details?: string | null; hint?: string | null } | null =
          null;

        if (userActiveRoomKeySchemaUnavailableRef.current) {
          const fallbackResult = await supabase
            .from('user_active_rooms')
            .select('*')
            .eq('user_id', sessionUserId)
            .order('updated_at', { ascending: false });

          rows = (fallbackResult.data ?? []) as UserActiveRoomRow[];
          error = fallbackResult.error;
        } else {
          const primaryResult = await supabase
            .from('user_active_rooms')
            .select('user_id,room_key,room_name,unread_count,updated_at')
            .eq('user_id', sessionUserId)
            .order('updated_at', { ascending: false });

          rows = (primaryResult.data ?? []) as UserActiveRoomRow[];
          error = primaryResult.error;

          if (isUserActiveRoomsRoomKeyMissingError(error)) {
            userActiveRoomKeySchemaUnavailableRef.current = true;
            const fallbackResult = await supabase
              .from('user_active_rooms')
              .select('*')
              .eq('user_id', sessionUserId)
              .order('updated_at', { ascending: false });

            rows = (fallbackResult.data ?? []) as UserActiveRoomRow[];
            error = fallbackResult.error;
          }
        }

        if (!error) {
          const nextRooms = mapRowsToStoredRooms(rows);
          setRooms((previous) => (areRoomsEqual(previous, nextRooms) ? previous : nextRooms));
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
        console.error('Failed to sync persistent chat state after retries:', error.message);
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
      const { rooms: cachedRooms, source } = parseCachedRooms(userId);
      setRooms(cachedRooms.length > 0 ? cachedRooms : []);
      if (source === 'legacy') {
        writeCachedRooms(userId, cachedRooms);
        removeValue(getLegacyCacheKey(userId));
      }

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
      setRooms((previous) => (areRoomsEqual(previous, nextRooms) ? previous : nextRooms));
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
      .channel(`chat_state:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_active_rooms',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as Partial<UserActiveRoomRow>;
            const oldKey = normalizeRoomKey(
              typeof oldRow.room_key === 'string' ? oldRow.room_key : oldRow.room_name ?? '',
            );
            if (!oldKey) {
              return;
            }
            setRooms((previous) => previous.filter((room) => room.roomKey !== oldKey));
            return;
          }

          const row = payload.new as UserActiveRoomRow;
          const roomName = normalizeRoomName(typeof row.room_name === 'string' ? row.room_name : '');
          const roomKey = normalizeRoomKey(typeof row.room_key === 'string' ? row.room_key : roomName);
          if (!roomName || !roomKey) {
            return;
          }

          const nextRoom: StoredRoomState = {
            roomKey,
            roomName,
            unreadCount:
              typeof row.unread_count === 'number' && Number.isFinite(row.unread_count)
                ? Math.max(0, Math.floor(row.unread_count))
                : 0,
            updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
          };

          setRooms((previous) => upsertRoomState(previous, nextRoom));
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [userId]);

  const joinRoom = useCallback(
    async (roomName: string) => {
      const normalizedName = normalizeRoomName(roomName);
      const roomKey = normalizeRoomKey(normalizedName);
      if (!normalizedName || !roomKey) {
        return;
      }

      const alreadyActive = roomsRef.current.some((room) => room.roomKey === roomKey);
      const optimisticRoom: StoredRoomState = {
        roomKey,
        roomName: normalizedName,
        unreadCount: 0,
        updatedAt: new Date().toISOString(),
      };
      setRooms((previous) => upsertRoomState(previous, optimisticRoom, 'preserve_unread'));

      if (!alreadyActive) {
        playChatSound('join');
      }

      if (!userIdRef.current) {
        return;
      }

      const { error } = await supabase.rpc('join_active_room', { p_room_name: normalizedName });
      if (error) {
        console.error('Failed to persist active room join:', error.message);
        await syncFromServer();
      }
    },
    [playChatSound, syncFromServer],
  );

  const leaveRoom = useCallback(
    async (roomName: string) => {
      const normalizedName = normalizeRoomName(roomName);
      const roomKey = normalizeRoomKey(normalizedName);
      if (!normalizedName || !roomKey) {
        return;
      }

      const existed = roomsRef.current.some((room) => room.roomKey === roomKey);
      setRooms((previous) => previous.filter((room) => room.roomKey !== roomKey));

      if (existed) {
        playChatSound('leave');
      }

      if (!userIdRef.current) {
        return;
      }

      const { error } = await supabase.rpc('leave_active_room', { p_room_name: normalizedName });
      if (error) {
        console.error('Failed to persist active room leave:', error.message);
        await syncFromServer();
      }
    },
    [playChatSound, syncFromServer],
  );

  const clearUnreads = useCallback(
    async (roomName: string) => {
      const normalizedName = normalizeRoomName(roomName);
      const roomKey = normalizeRoomKey(normalizedName);
      if (!normalizedName || !roomKey) {
        return;
      }

      setRooms((previous) =>
        sortRooms(
          previous.map((room) =>
            room.roomKey === roomKey
              ? {
                  ...room,
                  unreadCount: 0,
                  updatedAt: new Date().toISOString(),
                }
              : room,
          ),
        ),
      );

      if (!userIdRef.current) {
        return;
      }

      const { error } = await supabase.rpc('clear_room_unread', { p_room_name: normalizedName });
      if (error) {
        console.error('Failed to clear unread count:', error.message);
        await syncFromServer();
      }
    },
    [syncFromServer],
  );

  const resetChatState = useCallback(async () => {
    deleteCachedRooms(userIdRef.current);
    setRooms([]);
    setLastSyncedAt(null);
    setLastSyncError(null);
    setSyncState('idle');
  }, []);

  const activeRooms = useMemo(() => rooms.map((room) => room.roomName), [rooms]);
  const unreadMessages = useMemo(
    () =>
      rooms.reduce<Record<string, number>>((accumulator, room) => {
        accumulator[room.roomName] = room.unreadCount;
        return accumulator;
      }, {}),
    [rooms],
  );

  // Sync total unread count to native app badge
  useEffect(() => {
    const total = Object.values(unreadMessages).reduce((sum, count) => sum + count, 0);
    void setAppBadgeCount(total);
  }, [unreadMessages]);

  const value = useMemo(
    () => ({
      activeRooms,
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
