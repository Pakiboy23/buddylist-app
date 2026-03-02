'use client';

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { useChatContext } from '@/context/ChatContext';

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
const STATUS_OPTIONS = ['Available', 'Away', 'Busy', 'Be Right Back'] as const;
const BUDDY_LIST_PATH = '/buddy-list';

type StatusType = (typeof STATUS_OPTIONS)[number];

function normalizeRoomKey(roomName: string) {
  return roomName.trim().replace(/^#+/, '').toLowerCase();
}

function buildStatusMessage(statusType: StatusType, customMessage: string) {
  const trimmedMessage = customMessage.trim();
  return trimmedMessage ? `${statusType} - ${trimmedMessage}` : statusType;
}

function extractStyledStatus(rawStatus: string | null | undefined): {
  statusType: StatusType;
  customMessage: string;
  customMessageHtml: string;
  customMessageFormat: RichTextFormat;
} {
  const raw = (rawStatus ?? '').trim();
  if (!raw) {
    return {
      statusType: 'Available',
      customMessage: '',
      customMessageHtml: '',
      customMessageFormat: { ...DEFAULT_RICH_TEXT_FORMAT },
    };
  }

  for (const option of STATUS_OPTIONS) {
    const match = raw.match(new RegExp(`^${option}\\s*(?:-|:)\\s*`, 'i'));
    if (!match) {
      if (raw.toLowerCase() === option.toLowerCase()) {
        return {
          statusType: option,
          customMessage: '',
          customMessageHtml: '',
          customMessageFormat: { ...DEFAULT_RICH_TEXT_FORMAT },
        };
      }

      continue;
    }

    const trailingHtml = raw.slice(match[0].length).trim();
    const sanitizedMessage = sanitizeRichTextHtml(trailingHtml);
    const plainMessage = htmlToPlainText(sanitizedMessage).trim();

    return {
      statusType: option,
      customMessage: plainMessage,
      customMessageHtml: sanitizedMessage || plainMessage,
      customMessageFormat: detectRichTextFormat(sanitizedMessage),
    };
  }

  const sanitizedMessage = sanitizeRichTextHtml(raw);
  return {
    statusType: 'Available',
    customMessage: htmlToPlainText(sanitizedMessage).trim(),
    customMessageHtml: sanitizedMessage,
    customMessageFormat: detectRichTextFormat(sanitizedMessage),
  };
}

function parseStatusMessage(rawStatus: string | null | undefined): {
  statusType: StatusType;
  customMessage: string;
  customMessageHtml: string;
  customMessageFormat: RichTextFormat;
} {
  return extractStyledStatus(rawStatus);
}

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
  const [statusType, setStatusType] = useState<StatusType>('Available');
  const [customMessage, setCustomMessage] = useState('');
  const [customMessageFormat, setCustomMessageFormat] = useState<RichTextFormat>({
    ...DEFAULT_RICH_TEXT_FORMAT,
  });
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const [buddyRows, setBuddyRows] = useState<Buddy[]>([]);
  const [isLoadingBuddies, setIsLoadingBuddies] = useState(false);
  const [hasLoadedBuddies, setHasLoadedBuddies] = useState(false);
  const [selectedBuddyId, setSelectedBuddyId] = useState<string | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());

  const [isSetupOpen, setIsSetupOpen] = useState(false);
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
  const searchParams = useSearchParams();
  const { activeRooms, unreadMessages, joinRoom, leaveRoom, clearUnreads, resetChatState } = useChatContext();

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
      const parsedStatus = parseStatusMessage(existingProfile?.status_msg);
      const resolvedStatus = buildStatusMessage(
        parsedStatus.statusType,
        parsedStatus.customMessageHtml || parsedStatus.customMessage,
      );
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
      setStatusType(parsedStatus.statusType);
      setCustomMessage(parsedStatus.customMessage);
      setCustomMessageFormat(parsedStatus.customMessageFormat);
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
            const parsedStatus = parseStatusMessage(updated.status_msg);
            setStatusMsg(
              buildStatusMessage(
                parsedStatus.statusType,
                parsedStatus.customMessageHtml || parsedStatus.customMessage,
              ),
            );
            setStatusType(parsedStatus.statusType);
            setCustomMessage(parsedStatus.customMessage);
            setCustomMessageFormat(parsedStatus.customMessageFormat);
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
    resetChatState();
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleSetupSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) {
      return;
    }

    const formattedCustomMessage = customMessage.trim()
      ? formatRichText(customMessage.trim(), customMessageFormat)
      : '';
    const formattedStatus = buildStatusMessage(statusType, formattedCustomMessage);
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
    setIsSetupOpen(false);
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

  const requestedRoomName = searchParams.get('room')?.trim() ?? '';

  const getUnreadCountForRoom = useCallback(
    (roomName: string) => {
      const normalized = normalizeRoomKey(roomName);
      if (!normalized) {
        return 0;
      }

      return Object.entries(unreadMessages).reduce((count, [key, value]) => {
        if (normalizeRoomKey(key) === normalized) {
          return count + value;
        }
        return count;
      }, 0);
    },
    [unreadMessages],
  );

  const resolveRoomByName = useCallback(async (roomNameInput: string, allowCreate: boolean) => {
    const roomName = roomNameInput.trim();
    if (!roomName) {
      return null;
    }

    let resolvedRoom: ChatRoom | null = null;

    const { data: existingRoom, error: existingRoomError } = await supabase
      .from('chat_rooms')
      .select('id,name')
      .eq('name', roomName)
      .maybeSingle();

    if (existingRoomError && existingRoomError.code !== 'PGRST116') {
      throw new Error(existingRoomError.message);
    }

    if (existingRoom) {
      resolvedRoom = existingRoom as ChatRoom;
    } else if (allowCreate) {
      const { data: createdRoom, error: createRoomError } = await supabase
        .from('chat_rooms')
        .insert({ name: roomName })
        .select('id,name')
        .single();

      if (createRoomError && createRoomError.code !== '23505') {
        throw new Error(createRoomError.message);
      }

      if (createdRoom) {
        resolvedRoom = createdRoom as ChatRoom;
      }
    }

    if (!resolvedRoom && allowCreate) {
      const { data: racedRoom, error: racedRoomError } = await supabase
        .from('chat_rooms')
        .select('id,name')
        .eq('name', roomName)
        .maybeSingle();

      if (racedRoomError) {
        throw new Error(racedRoomError.message);
      }

      resolvedRoom = racedRoom as ChatRoom | null;
    }

    return resolvedRoom;
  }, []);

  const openRoomView = useCallback(
    (room: ChatRoom) => {
      joinRoom(room.name);
      clearUnreads(room.name);
      setActiveRoom(room);
      router.replace(`${BUDDY_LIST_PATH}?room=${encodeURIComponent(room.name)}`, { scroll: false });
    },
    [clearUnreads, joinRoom, router],
  );

  const handleOpenActiveRoom = useCallback(
    async (roomName: string) => {
      if (!roomName.trim()) {
        return;
      }

      setRoomJoinError(null);
      setIsJoiningRoom(true);

      try {
        const resolvedRoom = await resolveRoomByName(roomName, false);
        if (!resolvedRoom) {
          leaveRoom(roomName);
          setRoomJoinError('That room no longer exists.');
          return;
        }

        openRoomView(resolvedRoom);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not open room right now.';
        setRoomJoinError(message);
      } finally {
        setIsJoiningRoom(false);
      }
    },
    [leaveRoom, openRoomView, resolveRoomByName],
  );

  const handleBackFromRoom = useCallback(() => {
    setActiveRoom(null);
    router.push(BUDDY_LIST_PATH);
  }, [router]);

  const handleLeaveRoom = useCallback(
    (roomName: string) => {
      const normalizedRoomName = roomName.trim();
      if (!normalizedRoomName) {
        return;
      }

      leaveRoom(normalizedRoomName);

      if (activeRoom && normalizeRoomKey(activeRoom.name) === normalizeRoomKey(normalizedRoomName)) {
        setActiveRoom(null);
        router.push(BUDDY_LIST_PATH);
      }
    },
    [activeRoom, leaveRoom, router],
  );

  const handleLeaveCurrentRoom = useCallback(() => {
    if (!activeRoom) {
      return;
    }

    handleLeaveRoom(activeRoom.name);
  }, [activeRoom, handleLeaveRoom]);

  useEffect(() => {
    if (!userId || !requestedRoomName) {
      return;
    }

    if (activeRoom && normalizeRoomKey(activeRoom.name) === normalizeRoomKey(requestedRoomName)) {
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        const resolvedRoom = await resolveRoomByName(requestedRoomName, false);
        if (isCancelled || !resolvedRoom) {
          return;
        }

        joinRoom(resolvedRoom.name);
        clearUnreads(resolvedRoom.name);
        setActiveRoom(resolvedRoom);
      } catch (error) {
        if (isCancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Could not open room from notification.';
        setRoomJoinError(message);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [activeRoom, clearUnreads, joinRoom, requestedRoomName, resolveRoomByName, userId]);

  const openSetupWindow = () => {
    const parsed = parseStatusMessage(statusMsg);
    setStatusType(parsed.statusType);
    setCustomMessage(parsed.customMessage);
    setCustomMessageFormat(parsed.customMessageFormat);
    setSetupError(null);
    setIsSetupOpen(true);
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

    try {
      const resolvedRoom = await resolveRoomByName(roomName, true);
      if (!resolvedRoom) {
        setRoomJoinError('Could not join room right now.');
        return;
      }

      openRoomView(resolvedRoom);
      setShowRoomsWindow(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not join room right now.';
      setRoomJoinError(message);
    } finally {
      setIsJoiningRoom(false);
    }
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
    <main className="h-[100dvh] overflow-hidden">
      <RetroWindow title="Buddy List">
        <div className="flex h-full min-h-0 flex-col">
          <div className="mb-3 flex items-end justify-between rounded-lg border border-blue-200 bg-white/90 px-3 py-2 font-sans text-sm shadow-sm">
            <div>
              <p className="text-xs text-blue-700/80">Signed in as</p>
              <p className="text-base font-bold text-blue-900">{screenname}</p>
              <div
                className="aim-rich-html max-w-[180px] overflow-hidden text-ellipsis whitespace-nowrap text-[11px] italic text-slate-600"
                dangerouslySetInnerHTML={{
                  __html: sanitizeRichTextHtml(statusMsg || 'Available'),
                }}
              />
            </div>
            <button
              onClick={handleSignOff}
              className="min-h-[44px] cursor-pointer rounded-full border border-blue-300 bg-gradient-to-b from-white via-blue-50 to-blue-100 px-4 py-2 text-sm font-semibold text-blue-800 shadow-sm transition hover:from-blue-50 hover:to-blue-200"
            >
              Sign Off
            </button>
          </div>

          <div className="min-h-0 flex-1 select-none overflow-y-auto rounded-xl border border-blue-200 bg-white/95 p-2 font-sans text-sm shadow-[inset_0_2px_7px_rgba(37,99,235,0.12)]">
            <div className="mb-2">
              <p className="cursor-pointer font-bold text-slate-800">
                ▼ Buddies ({onlineBuddies.length}/{acceptedBuddies.length})
              </p>
              {isBootstrapping && (
                <p className="pl-4 text-xs italic text-slate-500">Dialing in...</p>
              )}
              {!isBootstrapping && isLoadingBuddies && (
                <p className="pl-4 text-xs italic text-slate-500">Loading your buddy list...</p>
              )}
              {!isBootstrapping && !isLoadingBuddies && acceptedBuddies.length === 0 && (
                <p className="pl-4 text-xs italic text-slate-500">List is empty.</p>
              )}
              {!isBootstrapping &&
                onlineBuddies.map((buddy) => (
                  <button
                    key={buddy.id}
                    type="button"
                    onClick={() => handleOpenChat(buddy.id)}
                    className={`w-full cursor-pointer rounded-md px-2 py-1 text-left transition ${
                      selectedBuddyId === buddy.id
                        ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-sm'
                        : 'hover:bg-blue-50'
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      <span className={selectedBuddyId === buddy.id ? 'text-white' : 'text-emerald-600'}>
                        ●
                      </span>
                      <span className="truncate font-bold">{buddy.screenname}</span>
                    </div>
                    <div
                      className={`aim-rich-html overflow-hidden text-ellipsis whitespace-nowrap pl-4 text-[10px] italic ${
                        selectedBuddyId === buddy.id ? 'text-blue-100' : 'text-slate-500'
                      }`}
                      dangerouslySetInnerHTML={{
                        __html: sanitizeRichTextHtml(buddy.status_msg || 'No away message.'),
                      }}
                    />
                  </button>
                ))}
            </div>

            <div>
              <p className="cursor-pointer font-bold text-slate-600">
                ▼ Offline ({offlineBuddies.length}/{acceptedBuddies.length})
              </p>
              {offlineBuddies.map((buddy) => (
                <button
                  key={buddy.id}
                  type="button"
                  onClick={() => handleOpenChat(buddy.id)}
                  className={`w-full cursor-pointer rounded-md px-2 py-1 text-left transition ${
                    selectedBuddyId === buddy.id
                      ? 'bg-gradient-to-r from-blue-500 to-blue-700 text-white shadow-sm'
                      : 'hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-1">
                    <span className={selectedBuddyId === buddy.id ? 'text-white' : 'text-slate-500'}>
                      ○
                    </span>
                    <span className="truncate font-bold">{buddy.screenname}</span>
                  </div>
                  <div
                    className={`aim-rich-html overflow-hidden text-ellipsis whitespace-nowrap pl-4 text-[10px] italic ${
                      selectedBuddyId === buddy.id ? 'text-blue-100' : 'text-slate-500'
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
                <p className="cursor-pointer font-bold text-slate-600">
                  ▼ Pending ({pendingBuddies.length})
                </p>
                {pendingBuddies.map((buddy) => (
                  <p key={buddy.id} className="truncate pl-4 text-xs italic text-slate-500">
                    {buddy.screenname}
                  </p>
                ))}
              </div>
            )}

            <div className="mt-3">
              <p className="cursor-pointer font-bold text-slate-700">▼ Active Chats ({activeRooms.length})</p>
              {activeRooms.length === 0 ? (
                <p className="pl-4 text-xs italic text-slate-500">No active rooms.</p>
              ) : (
                activeRooms.map((roomName) => {
                  const unreadCount = getUnreadCountForRoom(roomName);

                  return (
                    <div key={roomName} className="mt-1 flex items-center gap-2 rounded-md bg-blue-50/50 p-1">
                      <button
                        type="button"
                        onClick={() => void handleOpenActiveRoom(roomName)}
                        className="flex min-h-[44px] flex-1 items-center justify-between rounded-md border border-blue-300 bg-gradient-to-b from-white via-blue-50 to-blue-200 px-3 py-2 text-left text-sm font-semibold text-blue-900 shadow-sm transition hover:from-blue-50 hover:to-blue-300"
                      >
                        <span className="truncate">{roomName}</span>
                        {unreadCount > 0 ? (
                          <span className="ml-2 px-2 py-0.5 rounded-full bg-gradient-to-b from-red-400 to-red-600 text-white text-[10px] font-bold border border-white shadow-sm shadow-black/50">
                            {unreadCount}
                          </span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleLeaveRoom(roomName)}
                        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-blue-300 bg-gradient-to-b from-white via-slate-100 to-slate-200 px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:from-slate-50 hover:to-slate-300"
                        aria-label={`Leave ${roomName}`}
                        title="Leave room"
                      >
                        X
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={openSetupWindow}
              className="min-h-[44px] cursor-pointer rounded-md border border-blue-300 bg-gradient-to-b from-white via-blue-50 to-blue-200 px-2 py-2 text-sm font-semibold text-blue-900 shadow-sm transition hover:from-blue-50 hover:to-blue-300"
            >
              Preferences
            </button>
            <button
              type="button"
              onClick={openAddWindow}
              className="min-h-[44px] cursor-pointer rounded-md border border-blue-300 bg-gradient-to-b from-white via-blue-50 to-blue-200 px-2 py-2 text-sm font-semibold text-blue-900 shadow-sm transition hover:from-blue-50 hover:to-blue-300"
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
              className="min-h-[44px] cursor-pointer rounded-md border border-blue-300 bg-gradient-to-b from-white via-blue-50 to-blue-200 px-2 py-2 text-sm font-semibold text-blue-900 shadow-sm transition hover:from-blue-50 hover:to-blue-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Chat
            </button>
            <button
              type="button"
              onClick={openRoomsWindow}
              className="min-h-[44px] cursor-pointer rounded-md border border-blue-300 bg-gradient-to-b from-white via-blue-50 to-blue-200 px-2 py-2 text-sm font-semibold text-blue-900 shadow-sm transition hover:from-blue-50 hover:to-blue-300"
            >
              Chat Rooms
            </button>
          </div>
        </div>
      </RetroWindow>

      {isSetupOpen && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md">
            <RetroWindow title="Preferences">
              <form onSubmit={handleSetupSave} className="space-y-4 text-sm">
                <div>
                  <label htmlFor="status-type-input" className="mb-1 block text-[12px] font-semibold text-slate-700">
                    Status
                  </label>
                  <select
                    id="status-type-input"
                    value={statusType}
                    onChange={(event) => setStatusType(event.target.value as StatusType)}
                    className="w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-slate-800 shadow-[inset_0_1px_3px_rgba(37,99,235,0.18)] focus:outline-none"
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </div>

                <RichTextToolbar value={customMessageFormat} onChange={setCustomMessageFormat} />

                <div>
                  <label
                    htmlFor="custom-message-input"
                    className="mb-1 block text-[12px] font-semibold text-slate-700"
                  >
                    Custom away message
                  </label>
                  <textarea
                    id="custom-message-input"
                    value={customMessage}
                    onChange={(event) => setCustomMessage(event.target.value)}
                    className="min-h-[96px] w-full resize-none rounded-md border border-blue-300 bg-white px-3 py-2 text-slate-800 shadow-[inset_0_2px_7px_rgba(30,64,175,0.18)] focus:outline-none"
                    style={{
                      fontFamily: customMessageFormat.fontFamily,
                      color: customMessageFormat.color,
                      fontWeight: customMessageFormat.bold ? 'bold' : 'normal',
                      fontStyle: customMessageFormat.italic ? 'italic' : 'normal',
                      textDecoration: customMessageFormat.underline ? 'underline' : 'none',
                    }}
                    maxLength={240}
                    placeholder="Out grabbing pizza..."
                    rows={4}
                  />
                </div>

                <div className="rounded-md border border-blue-100 bg-white/90 px-3 py-2">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-blue-700">Preview</p>
                  <div
                    className="aim-rich-html text-[12px] text-slate-600"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeRichTextHtml(
                        buildStatusMessage(
                          statusType,
                          customMessage.trim() ? formatRichText(customMessage.trim(), customMessageFormat) : '',
                        ),
                      ),
                    }}
                  />
                </div>

                {setupError && <p className="text-sm text-red-700">{setupError}</p>}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSetupOpen(false)}
                    className="cursor-pointer rounded-md border border-blue-300 bg-gradient-to-b from-white via-slate-100 to-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:from-slate-50 hover:to-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSetup}
                    className="cursor-pointer rounded-md border border-blue-500 bg-gradient-to-b from-blue-200 via-blue-300 to-blue-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:from-blue-300 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
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
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-sm">
            <RetroWindow title="Join a Chat Room">
              <form onSubmit={handleJoinRoom} className="flex flex-col gap-3 text-sm">
                <label htmlFor="room-name-input" className="font-semibold text-slate-700">
                  Room name:
                </label>
                <input
                  id="room-name-input"
                  value={roomNameDraft}
                  onChange={(event) => setRoomNameDraft(event.target.value)}
                  className="w-full rounded-md border border-blue-300 bg-white px-3 py-2 shadow-[inset_0_1px_3px_rgba(37,99,235,0.18)] focus:outline-none"
                  placeholder="cool_kids_club"
                  maxLength={80}
                />
                <p className="text-[12px] text-slate-500">If the room does not exist, it will be created.</p>
                {roomJoinError && (
                  <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {roomJoinError}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRoomsWindow(false)}
                    className="cursor-pointer rounded-md border border-blue-300 bg-gradient-to-b from-white via-slate-100 to-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:from-slate-50 hover:to-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isJoiningRoom}
                    className="cursor-pointer rounded-md border border-blue-500 bg-gradient-to-b from-blue-200 via-blue-300 to-blue-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:from-blue-300 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-sm">
            <RetroWindow title="Incoming Message">
              <div className="flex flex-col gap-3 text-sm text-slate-700">
                <p>
                  <span className="font-bold text-blue-700">{activePendingRequest.screenname}</span> is trying to
                  send you a message, but they are not on your Buddy List.
                </p>
                {pendingRequestError && (
                  <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {pendingRequestError}
                  </p>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleAcceptPendingRequest(activePendingRequest.senderId)}
                    className="cursor-pointer rounded-md border border-blue-300 bg-gradient-to-b from-white via-blue-50 to-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-900 shadow-sm transition hover:from-blue-50 hover:to-blue-300"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeclinePendingRequest(activePendingRequest.senderId)}
                    className="cursor-pointer rounded-md border border-blue-300 bg-gradient-to-b from-white via-slate-100 to-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:from-slate-50 hover:to-slate-300"
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    disabled={isProcessingRequestId === activePendingRequest.senderId}
                    onClick={() => void handleAddBuddyFromPendingRequest(activePendingRequest.senderId)}
                    className="cursor-pointer rounded-md border border-blue-500 bg-gradient-to-b from-blue-200 via-blue-300 to-blue-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:from-blue-300 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
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
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md">
            <RetroWindow title="Add Buddy">
              <div className="flex flex-col gap-3 text-sm">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className="w-full rounded-md border border-blue-300 bg-white px-3 py-2 shadow-[inset_0_1px_3px_rgba(37,99,235,0.18)] focus:outline-none"
                    placeholder="Search screennames..."
                  />
                  <button
                    type="submit"
                    className="cursor-pointer rounded-md border border-blue-300 bg-gradient-to-b from-white via-blue-50 to-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-900 shadow-sm transition hover:from-blue-50 hover:to-blue-300"
                  >
                    Find
                  </button>
                </form>

                {searchError && <p className="text-sm text-red-700">{searchError}</p>}

                <div className="max-h-56 overflow-y-auto rounded-lg border border-blue-200 bg-white p-2 shadow-[inset_0_2px_7px_rgba(37,99,235,0.12)]">
                  {isSearching && (
                    <p className="p-2 text-sm italic text-slate-500">Searching screennames...</p>
                  )}
                  {!isSearching && searchTerm.trim() !== '' && searchResults.length === 0 && (
                    <p className="p-2 text-sm italic text-slate-500">No screennames found.</p>
                  )}
                  {!isSearching &&
                    searchResults.map((profile) => (
                      <div
                        key={profile.id}
                        className="mb-2 flex items-center justify-between gap-2 rounded-md border border-blue-100 bg-blue-50/30 p-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-bold">{profile.screenname || 'Unknown User'}</p>
                          <div
                            className="aim-rich-html truncate text-[11px] italic text-slate-500"
                            dangerouslySetInnerHTML={{
                              __html: sanitizeRichTextHtml(profile.status_msg || 'No away message.'),
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleAddBuddy(profile)}
                          disabled={isAddingBuddyId === profile.id}
                          className="shrink-0 cursor-pointer rounded-md border border-blue-500 bg-gradient-to-b from-blue-200 via-blue-300 to-blue-500 px-3 py-1 text-xs font-semibold text-white shadow-sm transition hover:from-blue-300 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
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
                    className="cursor-pointer rounded-md border border-blue-300 bg-gradient-to-b from-white via-slate-100 to-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:from-slate-50 hover:to-slate-300"
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
        <>
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
            <p className="fixed bottom-3 left-3 right-3 z-50 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
              {chatError}
            </p>
          )}
        </>
      )}

      {activeRoom && userId && (
        <GroupChatWindow
          roomId={activeRoom.id}
          roomName={activeRoom.name}
          currentUserId={userId}
          currentUserScreenname={screenname}
          onBack={handleBackFromRoom}
          onLeave={handleLeaveCurrentRoom}
        />
      )}
    </main>
  );
}
