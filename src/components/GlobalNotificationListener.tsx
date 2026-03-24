'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { LocalNotificationsPlugin } from '@capacitor/local-notifications';
import IncomingMessageBanner from '@/components/IncomingMessageBanner';
import { useChatContext } from '@/context/ChatContext';
import { navigateAppPath, normalizeAppPath } from '@/lib/appNavigation';
import { getSessionOrNull } from '@/lib/authClient';
import { normalizeRoomName, sameRoom } from '@/lib/roomName';
import { htmlToPlainText } from '@/lib/richText';
import { supabase } from '@/lib/supabase';

interface BannerData {
  senderName: string;
  messagePreview: string;
  targetPath: string;
  variant: 'room' | 'dm';
  count?: number;
  queuedAtMs?: number;
}

interface MessageInsert {
  sender_id?: string | null;
  receiver_id?: string | null;
  screenname?: string | null;
  content?: string | null;
}

interface RoomMessageInsert {
  id?: string | null;
  room_id?: string | null;
  sender_id?: string | null;
  content?: string | null;
}

interface UserProfileLookup {
  screenname: string | null;
}

interface ChatRoomLookup {
  name: string | null;
}

const BUDDY_LIST_PATH = '/buddy-list';
const MAX_BANNER_QUEUE = 20;
const BANNER_DEDUPE_WINDOW_MS = 2000;

function normalizeTextContent(content: string | null | undefined, fallback: string) {
  const text = htmlToPlainText(content ?? '').trim();
  return text || fallback;
}

export default function GlobalNotificationListener() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserScreenname, setCurrentUserScreenname] = useState('');
  const [bannerQueue, setBannerQueue] = useState<BannerData[]>([]);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const { activeRooms, playChatSound } = useChatContext();

  const currentUserIdRef = useRef(currentUserId);
  const currentUserScreennameRef = useRef(currentUserScreenname);
  const activeRoomsRef = useRef(activeRooms);
  const pathnameRef = useRef(pathname);
  const searchParamsRef = useRef(searchParams.toString());
  const playChatSoundRef = useRef(playChatSound);
  const roomNameCacheRef = useRef<Record<string, string>>({});
  const senderNameCacheRef = useRef<Record<string, string>>({});
  const localNotificationsRef = useRef<LocalNotificationsPlugin | null>(null);
  const localNotificationsEnabledRef = useRef(false);
  const nextLocalNotificationIdRef = useRef(1);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    currentUserScreennameRef.current = currentUserScreenname.trim().toLowerCase();
  }, [currentUserScreenname]);

  useEffect(() => {
    activeRoomsRef.current = activeRooms;
  }, [activeRooms]);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    searchParamsRef.current = searchParams.toString();
  }, [searchParams]);

  useEffect(() => {
    playChatSoundRef.current = playChatSound;
  }, [playChatSound]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let isCancelled = false;
    let removeActionListener: (() => void) | null = null;

    const initializeLocalNotifications = async () => {
      try {
        const { LocalNotifications } = await import('@capacitor/local-notifications');
        if (isCancelled) {
          return;
        }

        localNotificationsRef.current = LocalNotifications;

        const permissions = await LocalNotifications.checkPermissions();
        localNotificationsEnabledRef.current = permissions.display === 'granted';

        const listener = await LocalNotifications.addListener(
          'localNotificationActionPerformed',
          (event) => {
            const rawExtra = event.notification.extra as
              | { targetPath?: unknown }
              | undefined;
            const targetPath =
              typeof rawExtra?.targetPath === 'string' ? rawExtra.targetPath : '';
            if (targetPath.startsWith(BUDDY_LIST_PATH)) {
              navigateAppPath(router, targetPath, {
                nativeDocumentNavigation: true,
              });
            }
          },
        );

        removeActionListener = () => {
          listener.remove();
        };
      } catch (error) {
        console.error('Failed initializing local notifications:', error);
      }
    };

    void initializeLocalNotifications();

    return () => {
      isCancelled = true;
      localNotificationsRef.current = null;
      localNotificationsEnabledRef.current = false;
      removeActionListener?.();
    };
  }, [router]);

  useEffect(() => {
    let isMounted = true;

    const loadSession = async () => {
      const session = await getSessionOrNull();
      if (!isMounted) {
        return;
      }
      setCurrentUserId(session?.user.id ?? null);
      if (!session) {
        setBannerQueue([]);
      }
    };

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user.id ?? null);
      if (!session) {
        setBannerQueue([]);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentUserId) {
      setCurrentUserScreenname('');
      return;
    }

    let isCancelled = false;

    const loadCurrentUserScreenname = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('screenname')
        .eq('id', currentUserId)
        .maybeSingle();

      if (isCancelled) {
        return;
      }

      if (error) {
        console.error('Global listener failed to resolve current user screenname:', error.message);
        return;
      }

      const profile = data as UserProfileLookup | null;
      setCurrentUserScreenname(profile?.screenname?.trim() || '');
    };

    void loadCurrentUserScreenname();

    return () => {
      isCancelled = true;
    };
  }, [currentUserId]);

  const enqueueBanner = useCallback((banner: BannerData) => {
    playChatSoundRef.current('message');

    const localNotifications = localNotificationsRef.current;
    if (Capacitor.isNativePlatform() && localNotifications && localNotificationsEnabledRef.current) {
      const notificationId = nextLocalNotificationIdRef.current++;
      void localNotifications
        .schedule({
          notifications: [
            {
              id: notificationId,
              title: banner.senderName,
              body: banner.messagePreview,
              schedule: { at: new Date(Date.now() + 200) },
              extra: { targetPath: banner.targetPath },
            },
          ],
        })
        .catch((error) => {
          console.error('Failed scheduling local notification:', error);
        });
    }

    setBannerQueue((previous) => {
      const now = Date.now();
      const next = [...previous];
      let dedupeIndex = -1;
      for (let index = next.length - 1; index >= 0; index -= 1) {
        const queuedBanner = next[index];
        if (
          queuedBanner.targetPath === banner.targetPath &&
          typeof queuedBanner.queuedAtMs === 'number' &&
          now - queuedBanner.queuedAtMs <= BANNER_DEDUPE_WINDOW_MS
        ) {
          dedupeIndex = index;
          break;
        }
      }

      if (dedupeIndex >= 0) {
        const existing = next[dedupeIndex];
        next[dedupeIndex] = {
          ...existing,
          senderName: banner.senderName,
          messagePreview: banner.messagePreview,
          variant: banner.variant,
          count: Math.max(1, existing.count ?? 1) + 1,
          queuedAtMs: now,
        };
      } else {
        next.push({
          ...banner,
          count: Math.max(1, banner.count ?? 1),
          queuedAtMs: now,
        });
      }

      if (next.length > MAX_BANNER_QUEUE) {
        return next.slice(next.length - MAX_BANNER_QUEUE);
      }

      return next;
    });
  }, []);

  const resolveSenderNameById = useCallback(async (senderId: string, fallbackScreenname?: string | null) => {
    if (typeof fallbackScreenname === 'string' && fallbackScreenname.trim()) {
      return fallbackScreenname.trim();
    }

    const cached = senderNameCacheRef.current[senderId];
    if (cached) {
      return cached;
    }

    const { data: senderData, error } = await supabase
      .from('users')
      .select('screenname')
      .eq('id', senderId)
      .maybeSingle();

    if (error) {
      console.error('Global listener failed to resolve sender name:', error.message);
    }

    const sender = senderData as UserProfileLookup | null;
    const resolved = sender?.screenname?.trim() || 'Unknown User';
    senderNameCacheRef.current[senderId] = resolved;
    return resolved;
  }, []);

  const resolveRoomNameById = useCallback(async (roomId: string) => {
    const cached = roomNameCacheRef.current[roomId];
    if (cached) {
      return cached;
    }

    const { data: roomData, error } = await supabase
      .from('chat_rooms')
      .select('name')
      .eq('id', roomId)
      .maybeSingle();

    if (error) {
      console.error('Global listener failed to resolve room name:', error.message);
      return '';
    }

    const room = roomData as ChatRoomLookup | null;
    const resolvedRoom = normalizeRoomName(room?.name ?? '');
    if (!resolvedRoom) {
      return '';
    }

    roomNameCacheRef.current[roomId] = resolvedRoom;
    return resolvedRoom;
  }, []);

  const getCurrentView = useMemo(
    () => () => {
      const params = new URLSearchParams(searchParamsRef.current);
      return {
        pathname: pathnameRef.current,
        dm: params.get('dm') ?? '',
        room: normalizeRoomName(params.get('room') ?? ''),
      };
    },
    [],
  );

  useEffect(() => {
    const messagesChannel = supabase
      .channel('global_notifications_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const currentUser = currentUserIdRef.current;
          if (!currentUser) {
            return;
          }

          const incoming = payload.new as MessageInsert;
          const senderId = typeof incoming.sender_id === 'string' ? incoming.sender_id : '';
          const receiverId = typeof incoming.receiver_id === 'string' ? incoming.receiver_id : '';

          if (!senderId || !receiverId) {
            return;
          }

          if (receiverId !== currentUser || senderId === currentUser) {
            return;
          }

          const view = getCurrentView();
          if (view.pathname === BUDDY_LIST_PATH && view.dm === senderId) {
            return;
          }

          void (async () => {
            const senderName = await resolveSenderNameById(senderId, incoming.screenname);
            enqueueBanner({
              senderName,
              messagePreview: normalizeTextContent(incoming.content, 'New direct message.'),
              targetPath: normalizeAppPath(
                `${BUDDY_LIST_PATH}?dm=${encodeURIComponent(senderId)}`,
              ),
              variant: 'dm',
            });
          })();
        },
      )
      .subscribe();

    return () => {
      messagesChannel.unsubscribe();
    };
  }, [enqueueBanner, getCurrentView, resolveSenderNameById]);

  useEffect(() => {
    const roomMessagesChannel = supabase
      .channel('global_notifications_room_messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_messages',
        },
        (payload) => {
          const currentUser = currentUserIdRef.current;
          if (!currentUser) {
            return;
          }

          const incoming = payload.new as RoomMessageInsert;
          const senderId = typeof incoming.sender_id === 'string' ? incoming.sender_id : '';
          const roomId = typeof incoming.room_id === 'string' ? incoming.room_id : '';
          if (!senderId || !roomId || senderId === currentUser) {
            return;
          }

          void (async () => {
            const roomName = await resolveRoomNameById(roomId);
            if (!roomName) {
              return;
            }

            const activeRoomName = activeRoomsRef.current.find((room) =>
              sameRoom(room, roomName),
            );
            if (!activeRoomName) {
              return;
            }

            const view = getCurrentView();
            if (view.pathname === BUDDY_LIST_PATH && view.room && sameRoom(view.room, roomName)) {
              return;
            }

            const previewText = normalizeTextContent(incoming.content, 'New room message.');
            const mentionToken = currentUserScreennameRef.current
              ? `@${currentUserScreennameRef.current}`
              : '';
            const isMention =
              Boolean(mentionToken) &&
              previewText.toLowerCase().includes(mentionToken);
            const senderName = await resolveSenderNameById(senderId);
            enqueueBanner({
              senderName: isMention ? `${senderName} (mention)` : senderName,
              messagePreview: isMention ? `Mention: ${previewText}` : previewText,
              targetPath: normalizeAppPath(
                `${BUDDY_LIST_PATH}?room=${encodeURIComponent(activeRoomName)}`,
              ),
              variant: 'room',
            });
          })();
        },
      )
      .subscribe();

    return () => {
      roomMessagesChannel.unsubscribe();
    };
  }, [enqueueBanner, getCurrentView, resolveRoomNameById, resolveSenderNameById]);

  const activeBanner = bannerQueue[0] ?? null;
  if (!activeBanner) {
    return null;
  }

  return (
    <IncomingMessageBanner
      senderName={activeBanner.senderName}
      messagePreview={activeBanner.messagePreview}
      variant={activeBanner.variant}
      count={activeBanner.count}
      onClose={() => setBannerQueue((previous) => previous.slice(1))}
      onClick={() => {
        const targetPath = activeBanner.targetPath;
        setBannerQueue((previous) => previous.slice(1));
        navigateAppPath(router, targetPath, {
          nativeDocumentNavigation: true,
        });
      }}
    />
  );
}
