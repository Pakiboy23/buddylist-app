'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import IncomingMessageBanner from '@/components/IncomingMessageBanner';
import { useChatContext } from '@/context/ChatContext';
import { supabase } from '@/lib/supabase';
import { htmlToPlainText } from '@/lib/richText';

interface BannerData {
  senderName: string;
  messagePreview: string;
  targetPath: string;
}

interface MessageInsert {
  sender_id?: string | null;
  screenname?: string | null;
  content?: string | null;
  room_name?: string | null;
}

interface UserProfileLookup {
  screenname: string | null;
}

const BUDDY_LIST_PATH = '/buddy-list';

function normalizeRoomName(roomName: string) {
  return roomName.trim().replace(/^#+/, '');
}

function normalizeRoomKey(roomName: string) {
  return normalizeRoomName(roomName).toLowerCase();
}

export default function GlobalNotificationListener() {
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentScreenname, setCurrentScreenname] = useState<string>('');
  const [bannerData, setBannerData] = useState<BannerData | null>(null);
  const { activeRooms, incrementUnread, playChatSound } = useChatContext();
  const searchParams = useSearchParams();
  const currentScreennameRef = useRef(currentScreenname);
  const searchParamsRef = useRef(searchParams.toString());
  const currentUserIdRef = useRef<string | null>(currentUserId);
  const activeRoomsRef = useRef(activeRooms);
  const incrementUnreadRef = useRef(incrementUnread);
  const playChatSoundRef = useRef(playChatSound);
  const router = useRouter();

  useEffect(() => {
    currentScreennameRef.current = currentScreenname;
  }, [currentScreenname]);

  useEffect(() => {
    searchParamsRef.current = searchParams.toString();
  }, [searchParams]);

  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  useEffect(() => {
    activeRoomsRef.current = activeRooms;
  }, [activeRooms]);

  useEffect(() => {
    incrementUnreadRef.current = incrementUnread;
  }, [incrementUnread]);

  useEffect(() => {
    playChatSoundRef.current = playChatSound;
  }, [playChatSound]);

  useEffect(() => {
    let isMounted = true;

    const loadSessionProfile = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!isMounted || !session) {
        setCurrentUserId(null);
        setCurrentScreenname('');
        return;
      }

      const metadataScreenname =
        typeof session.user.user_metadata?.screenname === 'string'
          ? session.user.user_metadata.screenname.trim()
          : '';

      const { data: profileData } = await supabase
        .from('users')
        .select('screenname')
        .eq('id', session.user.id)
        .maybeSingle();

      const profile = profileData as UserProfileLookup | null;
      const fallbackName = session.user.email?.split('@')[0] ?? '';
      const resolvedScreenname = profile?.screenname?.trim() || metadataScreenname || fallbackName;

      setCurrentUserId(session.user.id);
      setCurrentScreenname(resolvedScreenname);
    };

    void loadSessionProfile();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setCurrentUserId(null);
        setCurrentScreenname('');
        setBannerData(null);
        return;
      }

      const metadataScreenname =
        typeof session.user.user_metadata?.screenname === 'string'
          ? session.user.user_metadata.screenname.trim()
          : '';
      const fallbackName = session.user.email?.split('@')[0] ?? '';
      setCurrentUserId(session.user.id);
      setCurrentScreenname(metadataScreenname || fallbackName);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('global_notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          console.log('Global Listener heard message:', payload);

          const currentUserIdValue = currentUserIdRef.current;
          const currentScreennameValue = currentScreennameRef.current.trim();
          if (!currentUserIdValue && !currentScreennameValue) {
            return;
          }

          const incoming = payload.new as MessageInsert;
          const incomingRoom = normalizeRoomName(
            typeof incoming.room_name === 'string' ? incoming.room_name : '',
          );
          if (!incomingRoom) {
            return;
          }

          const senderScreenname =
            typeof incoming.screenname === 'string' ? incoming.screenname.trim() : '';
          const normalizedCurrentScreenname = currentScreennameValue.toLowerCase();
          if (
            senderScreenname &&
            normalizedCurrentScreenname &&
            senderScreenname.toLowerCase() === normalizedCurrentScreenname
          ) {
            return;
          }

          if (
            incoming.sender_id &&
            currentUserIdValue &&
            incoming.sender_id === currentUserIdValue
          ) {
            return;
          }

          const incomingRoomKey = normalizeRoomKey(incomingRoom);
          if (!incomingRoomKey) {
            return;
          }

          const activeRoomName = activeRoomsRef.current.find(
            (activeRoom) => normalizeRoomKey(activeRoom) === incomingRoomKey,
          );
          if (!activeRoomName) {
            return;
          }

          const currentUrlRoom = normalizeRoomName(
            new URLSearchParams(searchParamsRef.current).get('room') ?? '',
          );
          if (normalizeRoomKey(currentUrlRoom) === incomingRoomKey) {
            return;
          }

          incrementUnreadRef.current(activeRoomName);
          playChatSoundRef.current('message');
          setBannerData({
            senderName: senderScreenname || activeRoomName,
            messagePreview: htmlToPlainText(incoming.content ?? '').trim() || 'New room message.',
            targetPath: `${BUDDY_LIST_PATH}?room=${encodeURIComponent(activeRoomName)}`,
          });
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  return bannerData ? (
    <IncomingMessageBanner
      senderName={bannerData.senderName}
      messagePreview={bannerData.messagePreview}
      onClose={() => setBannerData(null)}
      onClick={() => {
        setBannerData(null);
        router.push(bannerData.targetPath);
      }}
    />
  ) : null;
}
