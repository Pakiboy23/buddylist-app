'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ChatWindow, { ChatMessage } from '@/components/ChatWindow';
import GroupChatWindow from '@/components/GroupChatWindow';
import RichTextToolbar from '@/components/RichTextToolbar';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_RICH_TEXT_FORMAT,
  detectRichTextFormat,
  formatRichText,
  htmlToPlainText,
  RichTextFormat,
  sanitizeRichTextHtml,
} from '@/lib/richText';
import RetroWindow from '@/components/RetroWindow';

interface UserProfile {
  id: string;
  email?: string | null;
  screenname: string | null;
  status_msg: string | null;
}

interface BuddyRelationshipRow {
  buddy_id: string;
  status: 'pending' | 'accepted';
}

interface Buddy {
  id: string;
  screenname: string;
  status_msg: string | null;
  relationshipStatus: 'pending' | 'accepted';
}

interface PendingRequest {
  senderId: string;
  screenname: string;
}

export interface TemporaryChatProfile {
  screenname: string;
  status_msg: string | null;
}

interface ChatRoom {
  id: string;
  name: string;
}

const SIGN_ON_SOUND = '/signon.wav';
const SIGN_OFF_SOUND = '/doorslam.wav';
const INCOMING_MESSAGE_SOUND = '/imrcv.wav';
const NEW_MESSAGE_SOUND = '/newmessage.wav';

function useSoundPlayer() {
  const audioCacheRef = useRef<Record<string, HTMLAudioElement>>({});

  return useCallback((src: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    if (!audioCacheRef.current[src]) {
      const audio = new Audio(src);
      audio.preload = 'auto';
      audioCacheRef.current[src] = audio;
    }

    const audio = audioCacheRef.current[src];
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }, []);
}

export default function BuddyList() {
  const [userId, setUserId] = useState<string | null>(null);
  const [screenname, setScreenname] = useState('Loading...');
  const [statusMsg, setStatusMsg] = useState('Available');
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const [buddyRows, setBuddyRows] = useState<Buddy[]>([]);
  const [isLoadingBuddies, setIsLoadingBuddies] = useState(false);
  const [hasLoadedBuddies, setHasLoadedBuddies] = useState(false);
  const [selectedBuddyId, setSelectedBuddyId] = useState<string | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  const [showSetupWindow, setShowSetupWindow] = useState(false);
  const [setupDraft, setSetupDraft] = useState('');
  const [setupFormat, setSetupFormat] = useState<RichTextFormat>(DEFAULT_RICH_TEXT_FORMAT);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [isSavingSetup, setIsSavingSetup] = useState(false);

  const [showAddWindow, setShowAddWindow] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddingBuddyId, setIsAddingBuddyId] = useState<string | null>(null);

  const [showRoomsWindow, setShowRoomsWindow] = useState(false);
  const [roomNameDraft, setRoomNameDraft] = useState('');
  const [roomJoinError, setRoomJoinError] = useState<string | null>(null);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);

  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [pendingRequestError, setPendingRequestError] = useState<string | null>(null);
  const [isProcessingRequestId, setIsProcessingRequestId] = useState<string | null>(null);
  const [temporaryChatAllowedIds, setTemporaryChatAllowedIds] = useState<string[]>([]);
  const [temporaryChatProfiles, setTemporaryChatProfiles] = useState<Record<string, TemporaryChatProfile>>({});

  const [openChatBuddyIds, setOpenChatBuddyIds] = useState<string[]>([]);
  const [activeChatBuddyId, setActiveChatBuddyId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const previousOnlineBuddyIdsRef = useRef<Set<string>>(new Set());
  const hasPresenceSyncedRef = useRef(false);
  const activeChatBuddyIdRef = useRef<string | null>(null);
  const acceptedBuddyIdsRef = useRef<Set<string>>(new Set());
  const pendingRequestsRef = useRef<PendingRequest[]>([]);
  const temporaryChatAllowedIdsRef = useRef<Set<string>>(new Set());
  const openChatBuddyIdsRef = useRef<string[]>([]);
  const playSound = useSoundPlayer();
  const router = useRouter();

  useEffect(() => {
    activeChatBuddyIdRef.current = activeChatBuddyId;
  }, [activeChatBuddyId]);

  useEffect(() => {
    openChatBuddyIdsRef.current = openChatBuddyIds;
  }, [openChatBuddyIds]);

  useEffect(() => {
    pendingRequestsRef.current = pendingRequests;
  }, [pendingRequests]);

  useEffect(() => {
    temporaryChatAllowedIdsRef.current = new Set(temporaryChatAllowedIds);
  }, [temporaryChatAllowedIds]);

  const playIncomingAlert = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const tryPlay = (src: string) => {
      const audio = new Audio(src);
      audio.preload = 'auto';
      return audio.play();
    };

    void tryPlay(INCOMING_MESSAGE_SOUND)
      .catch(() => tryPlay(NEW_MESSAGE_SOUND))
      .catch(() => {
        const AudioContextConstructor =
          window.AudioContext ||
          (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

        if (!AudioContextConstructor) {
          return;
        }

        const audioContext = new AudioContextConstructor();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        oscillator.type = 'sine';
        oscillator.frequency.value = 880;
        gainNode.gain.value = 0.06;

        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.13);
      });
  }, []);

  const loadBuddies = useCallback(async (targetUserId: string) => {
    setIsLoadingBuddies(true);

    const { data: relationships, error: relationshipsError } = await supabase
      .from('buddies')
      .select('buddy_id,status')
      .eq('user_id', targetUserId)
      .in('status', ['accepted', 'pending']);

    if (relationshipsError) {
      console.error('Failed to load buddies:', relationshipsError.message);
      setIsLoadingBuddies(false);
      setHasLoadedBuddies(true);
      return;
    }

    const relationshipRows = (relationships ?? []) as BuddyRelationshipRow[];

    if (relationshipRows.length === 0) {
      setBuddyRows([]);
      setSelectedBuddyId(null);
      setIsLoadingBuddies(false);
      setHasLoadedBuddies(true);
      return;
    }

    const buddyIds = [...new Set(relationshipRows.map((item) => item.buddy_id))];
    const { data: profiles, error: profilesError } = await supabase
      .from('users')
      .select('id,screenname,status_msg')
      .in('id', buddyIds);

    if (profilesError) {
      console.error('Failed to load buddy profiles:', profilesError.message);
    }

    const profileMap = new Map(
      (((profiles as UserProfile[] | null) ?? []) as UserProfile[]).map((profile) => [
        profile.id,
        profile,
      ]),
    );

    const mergedRows = relationshipRows.map((relationship) => {
      const profile = profileMap.get(relationship.buddy_id);
      return {
        id: relationship.buddy_id,
        screenname: profile?.screenname?.trim() || 'Unknown Buddy',
        status_msg: profile?.status_msg ?? null,
        relationshipStatus: relationship.status,
      } as Buddy;
    });

    const dedupedRows = Array.from(new Map(mergedRows.map((row) => [row.id, row])).values()).sort(
      (left, right) => left.screenname.localeCompare(right.screenname, undefined, { sensitivity: 'base' }),
    );

    setBuddyRows(dedupedRows);
    setSelectedBuddyId((previous) =>
      previous && dedupedRows.some((buddy) => buddy.id === previous)
        ? previous
        : (dedupedRows[0]?.id ?? null),
    );
    setIsLoadingBuddies(false);
    setHasLoadedBuddies(true);
  }, []);

  useEffect(() => {
    const bootstrapUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/');
        return;
      }

      setHasLoadedBuddies(false);

      const metaScreenname =
        typeof session.user.user_metadata?.screenname === 'string'
          ? session.user.user_metadata.screenname.trim()
          : '';
      const emailFallback = session.user.email?.split('@')[0] ?? 'Unknown User';
      const fallbackName = metaScreenname || emailFallback;

      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('id,email,screenname,status_msg')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Failed to fetch profile:', profileError.message);
      }

      const existingProfile = userProfile as UserProfile | null;
      const resolvedScreenname = existingProfile?.screenname?.trim() || fallbackName;
      const resolvedStatus = existingProfile?.status_msg || 'Available';
      const userEmail = session.user.email ?? existingProfile?.email ?? null;
      const metadataScreenname =
        typeof session.user.user_metadata?.screenname === 'string'
          ? session.user.user_metadata.screenname.trim()
          : '';

      if (!userEmail) {
        console.error('Failed to sync profile: authenticated user has no email.');
        await supabase.auth.signOut();
        router.push('/');
        return;
      }

      const { error: upsertError } = await supabase.from('users').upsert(
        {
          id: session.user.id,
          email: userEmail,
          screenname: metadataScreenname || resolvedScreenname,
          status_msg: resolvedStatus,
          is_online: true,
        },
        { onConflict: 'id' },
      );

      if (upsertError) {
        console.error('Failed to sync profile:', upsertError.message);
      }

      setUserId(session.user.id);
      setScreenname(resolvedScreenname);
      setStatusMsg(resolvedStatus);
      setSetupDraft(htmlToPlainText(resolvedStatus));
      setSetupFormat(detectRichTextFormat(resolvedStatus));
      setIsBootstrapping(false);
      void loadBuddies(session.user.id);
    };

    void bootstrapUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession) {
        router.push('/');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadBuddies, router]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const buddiesChannel = supabase
      .channel(`buddies:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'buddies', filter: `user_id=eq.${userId}` },
        () => {
          void loadBuddies(userId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(buddiesChannel);
    };
  }, [loadBuddies, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const usersChannel = supabase
      .channel(`users:${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, (payload) => {
        const updated = payload.new as Partial<UserProfile> & { id?: string };
        if (!updated.id) {
          return;
        }

        setBuddyRows((previous) =>
          previous.map((buddy) => {
            if (buddy.id !== updated.id) {
              return buddy;
            }

            return {
              ...buddy,
              screenname:
                typeof updated.screenname === 'string' && updated.screenname.trim()
                  ? updated.screenname
                  : buddy.screenname,
              status_msg:
                typeof updated.status_msg === 'string'
                  ? updated.status_msg
                  : updated.status_msg === null
                    ? null
                    : buddy.status_msg,
            };
          }),
        );

        if (updated.id === userId) {
          if (typeof updated.screenname === 'string' && updated.screenname.trim()) {
            setScreenname(updated.screenname);
          }
          if (typeof updated.status_msg === 'string') {
            setStatusMsg(updated.status_msg);
            setSetupDraft(htmlToPlainText(updated.status_msg));
            setSetupFormat(detectRichTextFormat(updated.status_msg));
          }
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(usersChannel);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    hasPresenceSyncedRef.current = false;
    previousOnlineBuddyIdsRef.current = new Set();

    const presenceChannel = supabase.channel('buddylist-presence', {
      config: {
        presence: {
          key: userId,
        },
      },
    });

    presenceChannel.on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      setOnlineUserIds(new Set(Object.keys(state)));
    });

    presenceChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void presenceChannel.track({
          user_id: userId,
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      void presenceChannel.untrack();
      void supabase.removeChannel(presenceChannel);
    };
  }, [userId]);

  const buddies = useMemo(
    () =>
      buddyRows.map((buddy) => ({
        ...buddy,
        isOnline: onlineUserIds.has(buddy.id),
      })),
    [buddyRows, onlineUserIds],
  );

  const acceptedBuddies = useMemo(
    () => buddies.filter((buddy) => buddy.relationshipStatus === 'accepted'),
    [buddies],
  );
  const pendingBuddies = useMemo(
    () => buddies.filter((buddy) => buddy.relationshipStatus === 'pending'),
    [buddies],
  );
  const onlineBuddies = useMemo(
    () => acceptedBuddies.filter((buddy) => buddy.isOnline),
    [acceptedBuddies],
  );
  const offlineBuddies = useMemo(
    () => acceptedBuddies.filter((buddy) => !buddy.isOnline),
    [acceptedBuddies],
  );

  const selectedBuddy = useMemo(
    () => acceptedBuddies.find((buddy) => buddy.id === selectedBuddyId) ?? null,
    [acceptedBuddies, selectedBuddyId],
  );
  const activeChatBuddy = useMemo(() => {
    if (!activeChatBuddyId) {
      return null;
    }

    const knownBuddy = buddies.find((buddy) => buddy.id === activeChatBuddyId);
    if (knownBuddy) {
      return knownBuddy;
    }

    const temporaryProfile = temporaryChatProfiles[activeChatBuddyId];
    if (temporaryProfile) {
      return {
        id: activeChatBuddyId,
        relationshipStatus: 'pending' as const,
        screenname: temporaryProfile.screenname,
        status_msg: temporaryProfile.status_msg,
        isOnline: true,
      };
    }

    const pendingRequest = pendingRequests.find((request) => request.senderId === activeChatBuddyId);
    if (!pendingRequest) {
      return null;
    }

    return {
      id: activeChatBuddyId,
      relationshipStatus: 'pending' as const,
      screenname: pendingRequest.screenname,
      status_msg: null,
      isOnline: true,
    };
  }, [activeChatBuddyId, buddies, pendingRequests, temporaryChatProfiles]);

  useEffect(() => {
    acceptedBuddyIdsRef.current = new Set(acceptedBuddies.map((buddy) => buddy.id));
  }, [acceptedBuddies]);

  useEffect(() => {
    if (!hasLoadedBuddies) {
      return;
    }

    const currentOnlineBuddyIds = new Set(onlineBuddies.map((buddy) => buddy.id));
    if (!hasPresenceSyncedRef.current) {
      hasPresenceSyncedRef.current = true;
      previousOnlineBuddyIdsRef.current = currentOnlineBuddyIds;
      return;
    }

    currentOnlineBuddyIds.forEach((buddyId) => {
      if (!previousOnlineBuddyIdsRef.current.has(buddyId)) {
        playSound(SIGN_ON_SOUND);
      }
    });

    previousOnlineBuddyIdsRef.current.forEach((buddyId) => {
      if (!currentOnlineBuddyIds.has(buddyId)) {
        playSound(SIGN_OFF_SOUND);
      }
    });

    previousOnlineBuddyIdsRef.current = currentOnlineBuddyIds;
  }, [hasLoadedBuddies, onlineBuddies, playSound]);

  const loadConversation = useCallback(
    async (buddyId: string) => {
      if (!userId) {
        return;
      }

      setIsChatLoading(true);
      setChatError(null);

      const chatFilter = `and(sender_id.eq.${userId},receiver_id.eq.${buddyId}),and(sender_id.eq.${buddyId},receiver_id.eq.${userId})`;
      const { data, error } = await supabase
        .from('messages')
        .select('id,sender_id,receiver_id,content,created_at')
        .or(chatFilter)
        .order('created_at', { ascending: true })
        .limit(200);

      if (activeChatBuddyIdRef.current !== buddyId) {
        return;
      }

      if (error) {
        setChatMessages([]);
        setChatError(error.message);
        setIsChatLoading(false);
        return;
      }

      setChatMessages((data ?? []) as ChatMessage[]);
      setIsChatLoading(false);
    },
    [userId],
  );

  const openChatWindowForId = useCallback(
    (buddyId: string) => {
      setOpenChatBuddyIds([buddyId]);
      setSelectedBuddyId(buddyId);
      setActiveChatBuddyId(buddyId);
      activeChatBuddyIdRef.current = buddyId;
      void loadConversation(buddyId);
    },
    [loadConversation],
  );

  const handleAcceptPendingRequest = useCallback(
    (senderId: string) => {
      setPendingRequestError(null);
      setPendingRequests((previous) => previous.filter((request) => request.senderId !== senderId));
      setTemporaryChatAllowedIds((previous) =>
        previous.includes(senderId) ? previous : [...previous, senderId],
      );
      openChatWindowForId(senderId);
    },
    [openChatWindowForId],
  );

  const handleDeclinePendingRequest = useCallback((senderId: string) => {
    setPendingRequestError(null);
    setPendingRequests((previous) => previous.filter((request) => request.senderId !== senderId));
  }, []);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const globalMessagesChannel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const incomingMessage = payload.new as ChatMessage;
        if (!incomingMessage?.id || incomingMessage.receiver_id !== userId) {
          return;
        }

        const senderId = incomingMessage.sender_id;
        const isBuddy = acceptedBuddyIdsRef.current.has(senderId);
        const isTemporarilyAllowed = temporaryChatAllowedIdsRef.current.has(senderId);

        if (!isBuddy && !isTemporarilyAllowed) {
          const alreadyPending = pendingRequestsRef.current.some((request) => request.senderId === senderId);
          if (alreadyPending) {
            playIncomingAlert();
            return;
          }

          void (async () => {
            const { data: senderProfile } = await supabase
              .from('users')
              .select('id,screenname,status_msg')
              .eq('id', senderId)
              .maybeSingle();

            const profile = senderProfile as UserProfile | null;
            const senderScreenname =
              profile?.screenname?.trim() || profile?.email?.split('@')[0] || 'Unknown User';
            const senderStatus = profile?.status_msg ?? null;

            setTemporaryChatProfiles((previous) => ({
              ...previous,
              [senderId]: {
                screenname: senderScreenname,
                status_msg: senderStatus,
              },
            }));
            setPendingRequestError(null);
            setPendingRequests((previous) =>
              previous.some((request) => request.senderId === senderId)
                ? previous
                : [...previous, { senderId, screenname: senderScreenname }],
            );
            playIncomingAlert();
          })();
          return;
        }

        playIncomingAlert();

        if (!openChatBuddyIdsRef.current.includes(senderId)) {
          openChatWindowForId(senderId);
        }

        if (activeChatBuddyIdRef.current === senderId) {
          setChatMessages((previous) =>
            previous.some((message) => message.id === incomingMessage.id)
              ? previous
              : [...previous, incomingMessage],
          );
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(globalMessagesChannel);
    };
  }, [openChatWindowForId, playIncomingAlert, userId]);

  const handleSignOff = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleSetupSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) {
      return;
    }

    const nextStatus = setupDraft.trim() || 'Available';
    const formattedStatus = formatRichText(nextStatus, setupFormat);
    setIsSavingSetup(true);
    setSetupError(null);

    const { error } = await supabase
      .from('users')
      .update({ status_msg: formattedStatus })
      .eq('id', userId);

    setIsSavingSetup(false);

    if (error) {
      setSetupError(error.message);
      return;
    }

    setStatusMsg(formattedStatus);
    setShowSetupWindow(false);
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) {
      return;
    }

    const query = searchTerm.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    const { data, error } = await supabase
      .from('users')
      .select('id,screenname,status_msg')
      .ilike('screenname', `%${query}%`)
      .neq('id', userId)
      .order('screenname', { ascending: true })
      .limit(15);

    setIsSearching(false);

    if (error) {
      setSearchError(error.message);
      return;
    }

    setSearchResults((data ?? []) as UserProfile[]);
  };

  const handleAddBuddy = async (profile: UserProfile) => {
    if (!userId) {
      return;
    }

    setIsAddingBuddyId(profile.id);
    setSearchError(null);

    const { error } = await supabase.from('buddies').upsert(
      {
        user_id: userId,
        buddy_id: profile.id,
        status: 'accepted',
      },
      { onConflict: 'user_id,buddy_id' },
    );

    setIsAddingBuddyId(null);

    if (error) {
      setSearchError(error.message);
      return;
    }

    setShowAddWindow(false);
    setSearchTerm('');
    setSearchResults([]);
    await loadBuddies(userId);
  };

  const handleAddBuddyFromPendingRequest = useCallback(
    async (senderId: string) => {
      if (!userId) {
        return;
      }

      setPendingRequestError(null);
      setIsProcessingRequestId(senderId);

      const { error } = await supabase.from('buddies').upsert(
        {
          user_id: userId,
          buddy_id: senderId,
          status: 'accepted',
        },
        { onConflict: 'user_id,buddy_id' },
      );

      setIsProcessingRequestId(null);

      if (error) {
        setPendingRequestError(error.message);
        return;
      }

      setPendingRequests((previous) => previous.filter((request) => request.senderId !== senderId));
      setTemporaryChatAllowedIds((previous) =>
        previous.includes(senderId) ? previous : [...previous, senderId],
      );
      await loadBuddies(userId);
      openChatWindowForId(senderId);
    },
    [loadBuddies, openChatWindowForId, userId],
  );

  const handleOpenChat = (buddyId: string) => {
    openChatWindowForId(buddyId);
  };

  const handleSendMessage = useCallback(
    async (content: string) => {
      if (!userId || !activeChatBuddyId) {
        return;
      }

      setIsSendingMessage(true);
      setChatError(null);

      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: userId,
          receiver_id: activeChatBuddyId,
          content,
        })
        .select('id,sender_id,receiver_id,content,created_at')
        .single();

      setIsSendingMessage(false);

      if (error) {
        setChatError(error.message);
        throw error;
      }

      const insertedMessage = data as ChatMessage;
      setChatMessages((previous) =>
        previous.some((message) => message.id === insertedMessage.id)
          ? previous
          : [...previous, insertedMessage],
      );
    },
    [activeChatBuddyId, userId],
  );

  const openSetupWindow = () => {
    setSetupDraft(htmlToPlainText(statusMsg));
    setSetupFormat(detectRichTextFormat(statusMsg));
    setSetupError(null);
    setShowSetupWindow(true);
  };

  const openAddWindow = () => {
    setSearchTerm('');
    setSearchResults([]);
    setSearchError(null);
    setShowAddWindow(true);
  };

  const openRoomsWindow = () => {
    setRoomNameDraft(activeRoom?.name ?? '');
    setRoomJoinError(null);
    setShowRoomsWindow(true);
  };

  const handleJoinRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) {
      return;
    }

    const roomName = roomNameDraft.trim();
    if (!roomName) {
      setRoomJoinError('Enter a room name to join.');
      return;
    }

    setIsJoiningRoom(true);
    setRoomJoinError(null);

    let resolvedRoom: ChatRoom | null = null;

    const { data: existingRoom, error: existingRoomError } = await supabase
      .from('chat_rooms')
      .select('id,name')
      .eq('name', roomName)
      .maybeSingle();

    if (existingRoomError && existingRoomError.code !== 'PGRST116') {
      setIsJoiningRoom(false);
      setRoomJoinError(existingRoomError.message);
      return;
    }

    if (existingRoom) {
      resolvedRoom = existingRoom as ChatRoom;
    } else {
      const { data: createdRoom, error: createRoomError } = await supabase
        .from('chat_rooms')
        .insert({ name: roomName })
        .select('id,name')
        .single();

      if (createRoomError && createRoomError.code !== '23505') {
        setIsJoiningRoom(false);
        setRoomJoinError(createRoomError.message);
        return;
      }

      if (createdRoom) {
        resolvedRoom = createdRoom as ChatRoom;
      }
    }

    if (!resolvedRoom) {
      const { data: racedRoom, error: racedRoomError } = await supabase
        .from('chat_rooms')
        .select('id,name')
        .eq('name', roomName)
        .maybeSingle();

      if (racedRoomError) {
        setIsJoiningRoom(false);
        setRoomJoinError(racedRoomError.message);
        return;
      }

      resolvedRoom = racedRoom as ChatRoom | null;
    }

    setIsJoiningRoom(false);

    if (!resolvedRoom) {
      setRoomJoinError('Could not join room right now.');
      return;
    }

    setActiveRoom(resolvedRoom);
    setShowRoomsWindow(false);
  };

  const closeChatWindow = () => {
    if (activeChatBuddyId) {
      setOpenChatBuddyIds((previous) => previous.filter((buddyId) => buddyId !== activeChatBuddyId));
    }
    setActiveChatBuddyId(null);
    activeChatBuddyIdRef.current = null;
    setChatMessages([]);
    setChatError(null);
    setIsChatLoading(false);
  };

  const activePendingRequest = pendingRequests[0] ?? null;

  return (
    <main className="min-h-[100dvh] flex items-start justify-center p-3 sm:justify-end sm:p-8">
      <div className="w-full max-w-[340px] sm:max-w-[260px]">
        <RetroWindow title="Buddy List">
          <div className="font-sans text-sm pb-2 border-b border-os-dark-grey mb-2 flex justify-between items-end">
            <div>
              <p className="text-xs text-os-dark-grey">Logged in as:</p>
              <p className="font-bold text-os-blue text-base">{screenname}</p>
              <div
                className="aim-rich-html max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap text-[11px] italic text-os-dark-grey"
                dangerouslySetInnerHTML={{
                  __html: sanitizeRichTextHtml(statusMsg || 'Available'),
                }}
              />
            </div>
            <button
              onClick={handleSignOff}
              className="text-xs text-blue-800 underline hover:text-blue-600 cursor-pointer"
            >
              Sign Off
            </button>
          </div>

          <div className="bg-white border-2 border-[#0a0a0a] border-b-white border-r-white h-80 p-1 overflow-y-auto shadow-window-in font-sans text-sm select-none">
            <div className="mb-2">
              <p className="font-bold text-black cursor-pointer">
                ▼ Buddies ({onlineBuddies.length}/{acceptedBuddies.length})
              </p>
              {isBootstrapping && (
                <p className="pl-4 italic text-os-dark-grey text-xs">Dialing in...</p>
              )}
              {!isBootstrapping && isLoadingBuddies && (
                <p className="pl-4 italic text-os-dark-grey text-xs">Loading your buddy list...</p>
              )}
              {!isBootstrapping && !isLoadingBuddies && acceptedBuddies.length === 0 && (
                <p className="pl-4 italic text-os-dark-grey text-xs">List is empty.</p>
              )}
              {!isBootstrapping &&
                onlineBuddies.map((buddy) => (
                  <button
                    key={buddy.id}
                    type="button"
                    onClick={() => handleOpenChat(buddy.id)}
                    className={`w-full cursor-pointer px-1 py-[2px] text-left ${
                      selectedBuddyId === buddy.id ? 'bg-os-blue text-white' : 'hover:bg-[#dbe7ff]'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span className={selectedBuddyId === buddy.id ? 'text-white' : 'text-green-700'}>
                        ●
                      </span>
                      <span className="truncate font-bold">{buddy.screenname}</span>
                    </div>
                    <div
                      className={`aim-rich-html pl-4 text-[10px] italic overflow-hidden text-ellipsis whitespace-nowrap ${
                        selectedBuddyId === buddy.id ? 'text-[#d7e4ff]' : 'text-os-dark-grey'
                      }`}
                      dangerouslySetInnerHTML={{
                        __html: sanitizeRichTextHtml(buddy.status_msg || 'No away message.'),
                      }}
                    />
                  </button>
                ))}
            </div>

            <div>
              <p className="font-bold text-os-dark-grey cursor-pointer">
                ▼ Offline ({offlineBuddies.length}/{acceptedBuddies.length})
              </p>
              {offlineBuddies.map((buddy) => (
                <button
                  key={buddy.id}
                  type="button"
                  onClick={() => handleOpenChat(buddy.id)}
                  className={`w-full cursor-pointer px-1 py-[2px] text-left ${
                    selectedBuddyId === buddy.id ? 'bg-os-blue text-white' : 'hover:bg-[#efefef]'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span className={selectedBuddyId === buddy.id ? 'text-white' : 'text-os-dark-grey'}>
                      ○
                    </span>
                    <span className="truncate font-bold">{buddy.screenname}</span>
                  </div>
                  <div
                    className={`aim-rich-html pl-4 text-[10px] italic overflow-hidden text-ellipsis whitespace-nowrap ${
                      selectedBuddyId === buddy.id ? 'text-[#d7e4ff]' : 'text-os-dark-grey'
                    }`}
                    dangerouslySetInnerHTML={{
                      __html: sanitizeRichTextHtml(buddy.status_msg || 'No away message.'),
                    }}
                  />
                </button>
              ))}
            </div>

            {pendingBuddies.length > 0 && (
              <div className="mt-2">
                <p className="font-bold text-os-dark-grey cursor-pointer">
                  ▼ Pending ({pendingBuddies.length})
                </p>
                {pendingBuddies.map((buddy) => (
                  <p key={buddy.id} className="pl-4 text-xs italic text-os-dark-grey truncate">
                    {buddy.screenname}
                  </p>
                ))}
              </div>
            )}
          </div>

          <div className="mt-2 flex gap-1 justify-between">
            <button
              type="button"
              onClick={openSetupWindow}
              className="flex-1 bg-os-grey border-2 border-white border-b-[#0a0a0a] border-r-[#0a0a0a] p-1 text-xs font-bold active:border-t-[#0a0a0a] active:border-l-[#0a0a0a] active:border-b-white active:border-r-white cursor-pointer"
            >
              Setup
            </button>
            <button
              type="button"
              onClick={openAddWindow}
              className="flex-1 bg-os-grey border-2 border-white border-b-[#0a0a0a] border-r-[#0a0a0a] p-1 text-xs font-bold active:border-t-[#0a0a0a] active:border-l-[#0a0a0a] active:border-b-white active:border-r-white cursor-pointer"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => {
                if (selectedBuddy) {
                  handleOpenChat(selectedBuddy.id);
                }
              }}
              disabled={!selectedBuddy}
              className="flex-1 bg-os-grey border-2 border-white border-b-[#0a0a0a] border-r-[#0a0a0a] p-1 text-xs font-bold active:border-t-[#0a0a0a] active:border-l-[#0a0a0a] active:border-b-white active:border-r-white cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
            >
              Chat
            </button>
            <button
              type="button"
              onClick={openRoomsWindow}
              className="flex-1 bg-os-grey border-2 border-white border-b-[#0a0a0a] border-r-[#0a0a0a] p-1 text-[10px] font-bold active:border-t-[#0a0a0a] active:border-l-[#0a0a0a] active:border-b-white active:border-r-white cursor-pointer"
            >
              Chat Rooms
            </button>
          </div>
        </RetroWindow>
      </div>

      {showSetupWindow && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/25 p-3">
          <div className="w-full max-w-sm">
            <RetroWindow title="Buddy Setup">
              <form onSubmit={handleSetupSave} className="flex flex-col gap-2 text-xs">
                <label className="font-bold">Away message:</label>
                <RichTextToolbar value={setupFormat} onChange={setSetupFormat} />
                <textarea
                  value={setupDraft}
                  onChange={(event) => setSetupDraft(event.target.value)}
                  className="min-h-[76px] w-full resize-none border-2 border-[#0a0a0a] border-b-white border-r-white p-1 bg-white focus:outline-none shadow-window-in"
                  maxLength={240}
                  placeholder="Out grabbing pizza..."
                  rows={3}
                />
                <div className="border border-[#8b93ac] bg-white px-2 py-1">
                  <p className="mb-1 text-[11px] font-bold text-os-dark-grey">Preview:</p>
                  <div
                    className="aim-rich-html text-xs"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeRichTextHtml(
                        formatRichText(setupDraft || 'Your away message preview.', setupFormat),
                      ),
                    }}
                  />
                </div>
                {setupError && <p className="text-red-700">{setupError}</p>}
                <div className="flex gap-1 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowSetupWindow(false)}
                    className="bg-os-grey border-2 border-white border-b-[#0a0a0a] border-r-[#0a0a0a] px-2 py-1 font-bold active:border-t-[#0a0a0a] active:border-l-[#0a0a0a] active:border-b-white active:border-r-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSetup}
                    className="bg-os-grey border-2 border-white border-b-[#0a0a0a] border-r-[#0a0a0a] px-2 py-1 font-bold active:border-t-[#0a0a0a] active:border-l-[#0a0a0a] active:border-b-white active:border-r-white cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isSavingSetup ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </form>
            </RetroWindow>
          </div>
        </div>
      )}

      {showRoomsWindow && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30 p-3">
          <div className="w-full max-w-sm">
            <RetroWindow title="Join a Chat Room">
              <form onSubmit={handleJoinRoom} className="flex flex-col gap-2 text-xs">
                <label htmlFor="room-name-input" className="font-bold">
                  Room name:
                </label>
                <input
                  id="room-name-input"
                  value={roomNameDraft}
                  onChange={(event) => setRoomNameDraft(event.target.value)}
                  className="w-full border-2 border-[#0a0a0a] border-b-white border-r-white bg-white p-1 focus:outline-none shadow-window-in"
                  placeholder="cool_kids_club"
                  maxLength={80}
                />
                <p className="text-[11px] text-os-dark-grey">If the room does not exist, it will be created.</p>
                {roomJoinError && (
                  <p className="border border-red-700 bg-[#ffe9e9] px-2 py-1 text-red-700">{roomJoinError}</p>
                )}
                <div className="flex justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setShowRoomsWindow(false)}
                    className="cursor-pointer border-2 border-white border-b-[#0a0a0a] border-r-[#0a0a0a] bg-os-grey px-2 py-1 font-bold active:border-t-[#0a0a0a] active:border-l-[#0a0a0a] active:border-b-white active:border-r-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isJoiningRoom}
                    className="cursor-pointer border-2 border-white border-b-[#0a0a0a] border-r-[#0a0a0a] bg-os-grey px-2 py-1 font-bold active:border-t-[#0a0a0a] active:border-l-[#0a0a0a] active:border-b-white active:border-r-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isJoiningRoom ? 'Joining...' : 'Join'}
                  </button>
                </div>
              </form>
            </RetroWindow>
          </div>
        </div>
      )}

      {activePendingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-3">
          <div className="w-full max-w-sm">
            <RetroWindow title="Incoming Message">
              <div className="flex flex-col gap-3 text-xs">
                <p>
                  <span className="font-bold text-os-blue">{activePendingRequest.screenname}</span> is trying to
                  send you a message, but they are not on your Buddy List.
                </p>
                {pendingRequestError && (
                  <p className="border border-red-700 bg-[#ffe9e9] px-2 py-1 text-red-700">
                    {pendingRequestError}
                  </p>
                )}
                <div className="flex flex-wrap justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => handleAcceptPendingRequest(activePendingRequest.senderId)}
                    className="cursor-pointer border-2 border-white border-b-[#0a0a0a] border-r-[#0a0a0a] bg-os-grey px-2 py-1 font-bold active:border-t-[#0a0a0a] active:border-l-[#0a0a0a] active:border-b-white active:border-r-white"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeclinePendingRequest(activePendingRequest.senderId)}
                    className="cursor-pointer border-2 border-white border-b-[#0a0a0a] border-r-[#0a0a0a] bg-os-grey px-2 py-1 font-bold active:border-t-[#0a0a0a] active:border-l-[#0a0a0a] active:border-b-white active:border-r-white"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    disabled={isProcessingRequestId === activePendingRequest.senderId}
                    onClick={() => void handleAddBuddyFromPendingRequest(activePendingRequest.senderId)}
                    className="cursor-pointer border-2 border-white border-b-[#0a0a0a] border-r-[#0a0a0a] bg-os-grey px-2 py-1 font-bold active:border-t-[#0a0a0a] active:border-l-[#0a0a0a] active:border-b-white active:border-r-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isProcessingRequestId === activePendingRequest.senderId ? 'Adding...' : 'Add Buddy'}
                  </button>
                </div>
              </div>
            </RetroWindow>
          </div>
        </div>
      )}

      {showAddWindow && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/25 p-3">
          <div className="w-full max-w-md">
            <RetroWindow title="Add Buddy">
              <div className="flex flex-col gap-2 text-xs">
                <form onSubmit={handleSearch} className="flex gap-1">
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="w-full border-2 border-[#0a0a0a] border-b-white border-r-white p-1 bg-white focus:outline-none shadow-window-in"
                    placeholder="Search screennames..."
                  />
                  <button
                    type="submit"
                    className="bg-os-grey border-2 border-white border-b-[#0a0a0a] border-r-[#0a0a0a] px-2 py-1 font-bold active:border-t-[#0a0a0a] active:border-l-[#0a0a0a] active:border-b-white active:border-r-white cursor-pointer"
                  >
                    Find
                  </button>
                </form>

                {searchError && <p className="text-red-700">{searchError}</p>}

                <div className="max-h-56 overflow-y-auto border-2 border-[#0a0a0a] border-b-white border-r-white bg-white p-1 shadow-window-in">
                  {isSearching && (
                    <p className="p-2 text-os-dark-grey italic">Searching screennames...</p>
                  )}
                  {!isSearching && searchTerm.trim() !== '' && searchResults.length === 0 && (
                    <p className="p-2 text-os-dark-grey italic">No screennames found.</p>
                  )}
                  {!isSearching &&
                    searchResults.map((profile) => (
                      <div
                        key={profile.id}
                        className="mb-1 flex items-center justify-between gap-2 border border-os-light-grey p-1"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-bold">{profile.screenname || 'Unknown User'}</p>
                          <div
                            className="aim-rich-html truncate italic text-[10px] text-os-dark-grey"
                            dangerouslySetInnerHTML={{
                              __html: sanitizeRichTextHtml(profile.status_msg || 'No away message.'),
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddBuddy(profile)}
                          disabled={isAddingBuddyId === profile.id}
                          className="shrink-0 bg-os-grey border-2 border-white border-b-[#0a0a0a] border-r-[#0a0a0a] px-2 py-[2px] font-bold active:border-t-[#0a0a0a] active:border-l-[#0a0a0a] active:border-b-white active:border-r-white cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {isAddingBuddyId === profile.id ? 'Adding...' : 'Add'}
                        </button>
                      </div>
                    ))}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddWindow(false)}
                    className="bg-os-grey border-2 border-white border-b-[#0a0a0a] border-r-[#0a0a0a] px-2 py-1 font-bold active:border-t-[#0a0a0a] active:border-l-[#0a0a0a] active:border-b-white active:border-r-white cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </RetroWindow>
          </div>
        </div>
      )}

      {activeChatBuddy && userId && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/20 p-2 sm:items-center sm:justify-end sm:p-6">
          <div className="w-full max-w-md">
            <ChatWindow
              buddyScreenname={activeChatBuddy.screenname}
              buddyStatusMessage={activeChatBuddy.status_msg}
              currentUserId={userId}
              messages={chatMessages}
              onSendMessage={handleSendMessage}
              onClose={closeChatWindow}
              isLoading={isChatLoading}
              isSending={isSendingMessage}
            />
            {chatError && (
              <p className="mt-1 border border-red-700 bg-[#ffe9e9] px-2 py-1 text-xs text-red-800">
                {chatError}
              </p>
            )}
          </div>
        </div>
      )}

      {activeRoom && userId && (
        <GroupChatWindow
          roomId={activeRoom.id}
          roomName={activeRoom.name}
          currentUserId={userId}
          currentUserScreenname={screenname}
          onClose={() => setActiveRoom(null)}
        />
      )}
    </main>
  );
}
