'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { LocalNotificationsPlugin } from '@capacitor/local-notifications';
import type {
  ActionPerformed,
  PushNotificationSchema,
  PushNotificationsPlugin,
  Token,
} from '@capacitor/push-notifications';
import IncomingMessageBanner from '@/components/IncomingMessageBanner';
import { useChatContext } from '@/context/ChatContext';
import { navigateAppPath, normalizeAppPath } from '@/lib/appNavigation';
import { waitForSessionOrNull } from '@/lib/authClient';
import { subscribeToStorageKey } from '@/lib/clientStorage';
import {
  applyNotificationPreview,
  DEFAULT_USER_PRIVACY_SETTINGS,
  getDmPreference,
  getDmPreferencesStorageKey,
  getPrivacySettingsStorageKey,
  loadDmPreferencesSnapshot,
  loadPrivacySettingsSnapshot,
  type DmConversationPreference,
  type UserPrivacySettings,
} from '@/lib/privateChat';
import { normalizeRoomName, sameRoom } from '@/lib/roomName';
import { htmlToPlainText } from '@/lib/richText';
import { supabase } from '@/lib/supabase';
import { normalizeBlockedUserIds } from '@/lib/trustSafety';

interface BannerData {
  senderName: string;
  messagePreview: string;
  targetPath: string;
  variant: 'room' | 'dm';
  count?: number;
  queuedAtMs?: number;
  source?: 'realtime' | 'push';
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

interface PushNotificationData {
  targetPath?: unknown;
  senderName?: unknown;
  messagePreview?: unknown;
  variant?: unknown;
}

const BUDDY_LIST_PATH = '/buddy-list';
const MAX_BANNER_QUEUE = 20;
const BANNER_DEDUPE_WINDOW_MS = 2000;

function normalizeTextContent(content: string | null | undefined, fallback: string) {
  const text = htmlToPlainText(content ?? '').trim();
  return text || fallback;
}

function resolvePushBannerData(notification: Pick<PushNotificationSchema, 'title' | 'body' | 'data'>) {
  const rawData =
    notification.data && typeof notification.data === 'object'
      ? (notification.data as PushNotificationData)
      : {};
  const targetPath =
    typeof rawData.targetPath === 'string' ? normalizeAppPath(rawData.targetPath) : BUDDY_LIST_PATH;
  const variant = rawData.variant === 'room' || rawData.variant === 'dm' ? rawData.variant : 'dm';
  const senderName =
    typeof rawData.senderName === 'string' && rawData.senderName.trim()
      ? rawData.senderName.trim()
      : notification.title?.trim() || 'BuddyList';
  const messagePreview =
    typeof rawData.messagePreview === 'string' && rawData.messagePreview.trim()
      ? rawData.messagePreview.trim()
      : notification.body?.trim() || 'New message.';

  return {
    senderName,
    messagePreview,
    targetPath,
    variant,
  } satisfies Omit<BannerData, 'count' | 'queuedAtMs' | 'source'>;
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
  const pushNotificationsRef = useRef<PushNotificationsPlugin | null>(null);
  const localNotificationsEnabledRef = useRef(false);
  const nextLocalNotificationIdRef = useRef(1);
  const pendingPushTokenRef = useRef<string | null>(null);
  const persistedPushTokenRef = useRef<string | null>(null);
  const privacySettingsRef = useRef<UserPrivacySettings>(DEFAULT_USER_PRIVACY_SETTINGS);
  const dmPreferencesRef = useRef<Record<string, DmConversationPreference>>({});
  const blockedUserIdsRef = useRef<Set<string>>(new Set());

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
    if (!currentUserId) {
      privacySettingsRef.current = DEFAULT_USER_PRIVACY_SETTINGS;
      dmPreferencesRef.current = {};
      blockedUserIdsRef.current = new Set();
      if (typeof document !== 'undefined') {
        document.documentElement.classList.remove('privacy-shield-active');
        document.body.classList.remove('privacy-shield-active');
      }
      return;
    }

    privacySettingsRef.current = loadPrivacySettingsSnapshot(currentUserId);
    dmPreferencesRef.current = loadDmPreferencesSnapshot(currentUserId);
    void supabase
      .from('blocked_users')
      .select('blockedId:blocked_id')
      .eq('blocker_id', currentUserId)
      .then(({ data, error }) => {
        if (error) {
          return;
        }

        blockedUserIdsRef.current = new Set(
          normalizeBlockedUserIds((data ?? []) as Array<{ blockedId?: string | null }>),
        );
      });

    const unsubscribePreferences = subscribeToStorageKey(getDmPreferencesStorageKey(currentUserId), () => {
      dmPreferencesRef.current = loadDmPreferencesSnapshot(currentUserId);
    });
    const unsubscribePrivacy = subscribeToStorageKey(getPrivacySettingsStorageKey(currentUserId), () => {
      privacySettingsRef.current = loadPrivacySettingsSnapshot(currentUserId);
      if (typeof document !== 'undefined') {
        const shouldShield =
          privacySettingsRef.current.screenShieldEnabled && document.visibilityState !== 'visible';
        document.documentElement.classList.toggle('privacy-shield-active', shouldShield);
        document.body.classList.toggle('privacy-shield-active', shouldShield);
      }
    });

    return () => {
      unsubscribePreferences();
      unsubscribePrivacy();
    };
  }, [currentUserId]);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const applyShieldState = () => {
      const shouldShield =
        privacySettingsRef.current.screenShieldEnabled && document.visibilityState !== 'visible';
      document.documentElement.classList.toggle('privacy-shield-active', shouldShield);
      document.body.classList.toggle('privacy-shield-active', shouldShield);
    };

    applyShieldState();
    document.addEventListener('visibilitychange', applyShieldState);
    return () => {
      document.removeEventListener('visibilitychange', applyShieldState);
      document.documentElement.classList.remove('privacy-shield-active');
      document.body.classList.remove('privacy-shield-active');
    };
  }, []);

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
              navigateAppPath(router, targetPath);
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
      const session = await waitForSessionOrNull();
      if (!isMounted) {
        return;
      }
      setCurrentUserId(session?.user.id ?? null);
      if (!session) {
        setBannerQueue([]);
        persistedPushTokenRef.current = null;
      }
    };

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user.id ?? null);
      if (!session) {
        setBannerQueue([]);
        persistedPushTokenRef.current = null;
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

  const persistPushToken = useCallback(async (userId: string, tokenValue: string) => {
    if (!userId || !tokenValue.trim()) {
      return;
    }

    const { error } = await supabase.from('user_push_tokens').upsert(
      {
        user_id: userId,
        token: tokenValue.trim(),
        platform: Capacitor.getPlatform(),
        last_registered_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id,token',
      },
    );

    if (error) {
      console.error('Failed saving push notification token:', error.message);
      return;
    }

    persistedPushTokenRef.current = tokenValue.trim();
  }, []);

  useEffect(() => {
    const pendingToken = pendingPushTokenRef.current;
    if (!currentUserId || !pendingToken || persistedPushTokenRef.current === pendingToken) {
      return;
    }

    void persistPushToken(currentUserId, pendingToken);
  }, [currentUserId, persistPushToken]);

  const enqueueBanner = useCallback((banner: BannerData) => {
    const previewedBanner = applyNotificationPreview(
      {
        senderName: banner.senderName,
        messagePreview: banner.messagePreview,
      },
      privacySettingsRef.current,
    );

    playChatSoundRef.current('message');

    const localNotifications = localNotificationsRef.current;
    if (
      banner.source !== 'push' &&
      Capacitor.isNativePlatform() &&
      localNotifications &&
      localNotificationsEnabledRef.current
    ) {
      const notificationId = nextLocalNotificationIdRef.current++;
      void localNotifications
        .schedule({
          notifications: [
            {
              id: notificationId,
              title: previewedBanner.senderName,
              body: previewedBanner.messagePreview,
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
          senderName: previewedBanner.senderName,
          messagePreview: previewedBanner.messagePreview,
          variant: banner.variant,
          count: Math.max(1, existing.count ?? 1) + 1,
          queuedAtMs: now,
        };
      } else {
        next.push({
          ...banner,
          senderName: previewedBanner.senderName,
          messagePreview: previewedBanner.messagePreview,
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

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let isCancelled = false;
    const listenerHandles: Array<{ remove: () => Promise<void> | void }> = [];

    const initializePushNotifications = async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');
        if (isCancelled) {
          return;
        }

        pushNotificationsRef.current = PushNotifications;

        listenerHandles.push(
          await PushNotifications.addListener('registration', (token: Token) => {
            const tokenValue = token.value.trim();
            if (!tokenValue) {
              return;
            }

            pendingPushTokenRef.current = tokenValue;
            const currentUser = currentUserIdRef.current;
            if (currentUser && persistedPushTokenRef.current !== tokenValue) {
              void persistPushToken(currentUser, tokenValue);
            }
          }),
        );

        listenerHandles.push(
          await PushNotifications.addListener('registrationError', (error) => {
            console.error('Push registration error:', error.error);
          }),
        );

        listenerHandles.push(
          await PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
            const banner = resolvePushBannerData(notification);
            const currentPath = normalizeAppPath(
              `${pathnameRef.current}${searchParamsRef.current ? `?${searchParamsRef.current}` : ''}`,
            );

            if (banner.targetPath === currentPath) {
              return;
            }

            enqueueBanner({
              ...banner,
              source: 'push',
            });
          }),
        );

        listenerHandles.push(
          await PushNotifications.addListener(
            'pushNotificationActionPerformed',
            (action: ActionPerformed) => {
              const banner = resolvePushBannerData(action.notification);
              if (banner.targetPath.startsWith(BUDDY_LIST_PATH)) {
                navigateAppPath(router, banner.targetPath);
              }
            },
          ),
        );

        let permissionState = await PushNotifications.checkPermissions();
        if (permissionState.receive === 'prompt') {
          permissionState = await PushNotifications.requestPermissions();
        }

        if (isCancelled || permissionState.receive !== 'granted') {
          return;
        }

        await PushNotifications.register();
      } catch (error) {
        console.error('Failed initializing push notifications:', error);
      }
    };

    void initializePushNotifications();

    return () => {
      isCancelled = true;
      pushNotificationsRef.current = null;
      listenerHandles.forEach((handle) => {
        void handle.remove();
      });
    };
  }, [enqueueBanner, persistPushToken, router]);

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

          if (blockedUserIdsRef.current.has(senderId)) {
            return;
          }

          if (getDmPreference(dmPreferencesRef.current, senderId).isMuted) {
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
              source: 'realtime',
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
              source: 'realtime',
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
        navigateAppPath(router, targetPath);
      }}
    />
  );
}
