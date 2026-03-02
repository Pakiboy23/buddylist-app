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

type SoundType = 'join' | 'leave' | 'message';

interface ChatContextValue {
  activeRooms: string[];
  unreadMessages: Record<string, number>;
  playChatSound: (type: SoundType) => void;
  joinRoom: (roomName: string) => void;
  leaveRoom: (roomName: string) => void;
  incrementUnread: (roomName: string) => void;
  clearUnreads: (roomName: string) => void;
  resetChatState: () => void;
}

const SOUND_MAP: Record<SoundType, string> = {
  join: '/sounds/door_creak.mp3',
  leave: '/sounds/door_slam.mp3',
  message: '/sounds/im_receive.mp3',
};

const ChatContext = createContext<ChatContextValue | null>(null);

function normalizeRoomName(roomName: string) {
  return roomName.trim().replace(/^#+/, '');
}

function normalizeRoomKey(roomName: string) {
  return normalizeRoomName(roomName).toLowerCase();
}

function namesMatch(left: string, right: string) {
  return normalizeRoomKey(left) === normalizeRoomKey(right);
}

function resolveCanonicalRoomName(activeRooms: string[], roomName: string) {
  return activeRooms.find((room) => namesMatch(room, roomName)) ?? normalizeRoomName(roomName);
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [activeRooms, setActiveRooms] = useState<string[]>([]);
  const [unreadMessages, setUnreadMessages] = useState<Record<string, number>>({});
  const activeRoomsRef = useRef(activeRooms);

  useEffect(() => {
    activeRoomsRef.current = activeRooms;
  }, [activeRooms]);

  const playChatSound = useCallback((type: SoundType) => {
    if (typeof window === 'undefined') {
      return;
    }

    const src = SOUND_MAP[type];
    const audio = new Audio(src);
    void audio.play().catch(() => {
      console.log('Audio blocked - click once to unlock.');
    });
  }, []);

  const joinRoom = useCallback(
    (roomName: string) => {
      const normalized = normalizeRoomName(roomName);
      if (!normalized) {
        return;
      }

      let didAdd = false;
      setActiveRooms((previous) => {
        const exists = previous.some((room) => namesMatch(room, normalized));
        if (exists) {
          return previous;
        }
        didAdd = true;
        return [...previous, normalized];
      });

      if (didAdd) {
        playChatSound('join');
      }
    },
    [playChatSound],
  );

  const clearUnreads = useCallback((roomName: string) => {
    const normalized = normalizeRoomName(roomName);
    if (!normalized) {
      return;
    }

    const canonicalRoomName = resolveCanonicalRoomName(activeRoomsRef.current, normalized);

    setUnreadMessages((previous) => {
      const next = { ...previous };
      next[canonicalRoomName] = 0;
      return next;
    });
  }, []);

  const leaveRoom = useCallback(
    (roomName: string) => {
      const normalized = normalizeRoomName(roomName);
      if (!normalized) {
        return;
      }

      let didRemove = false;
      setActiveRooms((previous) => {
        const next = previous.filter((room) => !namesMatch(room, normalized));
        didRemove = next.length !== previous.length;
        return next;
      });

      const canonicalRoomName = resolveCanonicalRoomName(activeRoomsRef.current, normalized);

      setUnreadMessages((previous) => {
        const next = { ...previous };
        delete next[canonicalRoomName];
        return next;
      });

      if (didRemove) {
        playChatSound('leave');
      }
    },
    [playChatSound],
  );

  const incrementUnread = useCallback((roomName: string) => {
    const normalized = normalizeRoomName(roomName);
    if (!normalized) {
      return;
    }

    const canonicalRoomName = resolveCanonicalRoomName(activeRoomsRef.current, normalized);

    setUnreadMessages((previous) => ({
      ...previous,
      [canonicalRoomName]: (previous[canonicalRoomName] ?? 0) + 1,
    }));
  }, []);

  const resetChatState = useCallback(() => {
    setActiveRooms([]);
    setUnreadMessages({});
  }, []);

  const value = useMemo(
    () => ({
      activeRooms,
      unreadMessages,
      playChatSound,
      joinRoom,
      leaveRoom,
      incrementUnread,
      clearUnreads,
      resetChatState,
    }),
    [
      activeRooms,
      unreadMessages,
      playChatSound,
      joinRoom,
      leaveRoom,
      incrementUnread,
      clearUnreads,
      resetChatState,
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
