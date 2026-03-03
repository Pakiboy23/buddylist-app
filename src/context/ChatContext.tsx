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
import { getSessionOrNull } from '@/lib/authClient';
import { normalizeRoomKey, normalizeRoomName } from '@/lib/roomName';
import { initSoundSystem, playUiSound } from '@/lib/sound';
import { supabase } from '@/lib/supabase';

type SoundType = 'join' | 'leave' | 'message';

interface ChatContextValue {
  activeRooms: string[];
  unreadMessages: Record<string, number>;
  isHydrated: boolean;
  playChatSound: (type: SoundType) => void;
  joinRoom: (roomName: string) => Promise<void>;
  leaveRoom: (roomName: string) => Promise<void>;
  incrementUnread: (roomName: string) => Promise<void>;
  clearUnreads: (roomName: string) => Promise<void>;
  resetChatState: () => Promise<void>;
  syncFromServer: () => Promise<void>;
}

const SOUND_MAP: Record<SoundType, string> = {
  join: '/sounds/door_creak.mp3',
  leave: '/sounds/door_slam.mp3',
  message: '/sounds/im_receive.mp3',
};

const CHAT_STATE_CACHE_PREFIX = 'buddylist:chatstate:';

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
  rooms: StoredRoomState[];
}

const ChatContext = createContext<ChatContextValue | null>(null);

function getCacheKey(userId: string) {
  return `${CHAT_STATE_CACHE_PREFIX}${userId}`;
}

function sortRooms(rooms: StoredRoomState[]) {
  return [...rooms].sort((left, right) => {
    const leftTime = left.updatedAt ? Date.parse(left.updatedAt) : 0;
    const rightTime = right.updatedAt ? Date.parse(right.updatedAt) : 0;
    if (leftTime !== rightTime) {
      return rightTime - leftTime;
    }
    return left.roomName.localeCompare(right.roomName, undefined, { sensitivity: 'base' });
  });
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

function parseCachedRooms(userId: string): StoredRoomState[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(getCacheKey(userId));
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as PersistedChatState;
    if (!parsed || !Array.isArray(parsed.rooms)) {
      return [];
    }

    const normalizedRooms = parsed.rooms
      .map((room) => coerceStoredRoom(room))
      .filter((room): room is StoredRoomState => Boolean(room));
    return sortRooms(
      Array.from(new Map(normalizedRooms.map((room) => [room.roomKey, room])).values()),
    );
  } catch {
    return [];
  }
}

function writeCachedRooms(userId: string, rooms: StoredRoomState[]) {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const payload: PersistedChatState = { rooms };
    window.localStorage.setItem(getCacheKey(userId), JSON.stringify(payload));
  } catch {
    // Ignore cache write failures (private mode / quota / storage restrictions).
  }
}

function deleteCachedRooms(userId: string | null) {
  if (typeof window === 'undefined' || !userId) {
    return;
  }

  try {
    window.localStorage.removeItem(getCacheKey(userId));
  } catch {
    // Ignore cache cleanup failures.
  }
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
  const [rooms, setRooms] = useState<StoredRoomState[]>([]);
  const roomsRef = useRef<StoredRoomState[]>([]);
  const userIdRef = useRef<string | null>(null);

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
    const sessionUserId = userIdRef.current;
    if (!sessionUserId) {
      setRooms([]);
      return;
    }

    const { data, error } = await supabase
      .from('user_active_rooms')
      .select('user_id,room_key,room_name,unread_count,updated_at')
      .eq('user_id', sessionUserId)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Failed to sync persistent chat state:', error.message);
      return;
    }

    const rows = (data ?? []) as UserActiveRoomRow[];
    setRooms(mapRowsToStoredRooms(rows));
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const loadSession = async () => {
      const session = await getSessionOrNull();
      if (isCancelled) {
        return;
      }
      setUserId(session?.user.id ?? null);
      if (!session) {
        setIsHydrated(true);
        setRooms([]);
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
        return;
      }

      setIsHydrated(false);
      const cachedRooms = parseCachedRooms(userId);
      if (cachedRooms.length > 0) {
        setRooms(cachedRooms);
      } else {
        setRooms([]);
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
      return;
    }

    writeCachedRooms(userId, rooms);
  }, [rooms, userId]);

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

  const incrementUnread = useCallback(
    async (roomName: string) => {
      const normalizedName = normalizeRoomName(roomName);
      const roomKey = normalizeRoomKey(normalizedName);
      if (!normalizedName || !roomKey) {
        return;
      }

      const trackedRoom = roomsRef.current.find((room) => room.roomKey === roomKey);
      if (!trackedRoom) {
        return;
      }

      setRooms((previous) =>
        sortRooms(
          previous.map((room) =>
            room.roomKey === roomKey
              ? {
                  ...room,
                  unreadCount: room.unreadCount + 1,
                  updatedAt: new Date().toISOString(),
                }
              : room,
          ),
        ),
      );

      if (!userIdRef.current) {
        return;
      }

      const { error } = await supabase.rpc('bump_room_unread', { p_room_name: trackedRoom.roomName });
      if (error) {
        console.error('Failed to increment unread count:', error.message);
        await syncFromServer();
      }
    },
    [syncFromServer],
  );

  const resetChatState = useCallback(async () => {
    deleteCachedRooms(userIdRef.current);
    setRooms([]);
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

  const value = useMemo(
    () => ({
      activeRooms,
      unreadMessages,
      isHydrated,
      playChatSound,
      joinRoom,
      leaveRoom,
      incrementUnread,
      clearUnreads,
      resetChatState,
      syncFromServer,
    }),
    [
      activeRooms,
      unreadMessages,
      isHydrated,
      playChatSound,
      joinRoom,
      leaveRoom,
      incrementUnread,
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
