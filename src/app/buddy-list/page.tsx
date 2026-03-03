'use client';

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ChatWindow, { ChatMessage } from '@/components/ChatWindow';
import GroupChatWindow from '@/components/GroupChatWindow';
import { getAccessTokenOrNull, getSessionOrNull } from '@/lib/authClient';
import { supabase } from '@/lib/supabase';
import { normalizeRoomKey, sameRoom } from '@/lib/roomName';
import RetroWindow from '@/components/RetroWindow';
import { useChatContext } from '@/context/ChatContext';

interface UserProfile {
  id: string;
  email?: string | null;
  screenname: string | null;
  status: string | null;
  away_message: string | null;
  status_msg: string | null;
}

interface BuddyRelationshipRow {
  buddy_id: string;
  status: 'pending' | 'accepted';
}

interface Buddy {
  id: string;
  screenname: string;
  status: string | null;
  away_message: string | null;
  status_msg: string | null;
  relationshipStatus: 'pending' | 'accepted';
}

interface PendingRequest {
  senderId: string;
  screenname: string;
}

export interface TemporaryChatProfile {
  screenname: string;
  status: string | null;
  away_message: string | null;
  status_msg: string | null;
}

interface ChatRoom {
  id: string;
  name: string;
}

interface AdminMeResponse {
  isAdmin: boolean;
}

interface AdminTicketResponse {
  ok: boolean;
  ticket: string;
  expiresAt: string;
}

const SIGN_ON_SOUND = '/signon.wav';
const SIGN_OFF_SOUND = '/doorslam.wav';
const INCOMING_MESSAGE_SOUND = '/imrcv.wav';
const NEW_MESSAGE_SOUND = '/newmessage.wav';
const BUDDY_LIST_PATH = '/buddy-list';
const AVAILABLE_STATUS = 'Available';
const AWAY_STATUS = 'Away';
const KNOWN_STATUSES = ['Available', 'Away', 'Invisible', 'Busy', 'Be Right Back'] as const;

function normalizeStatusLabel(input: string | null | undefined): string {
  const value = (input ?? '').trim();
  if (!value) {
    return AVAILABLE_STATUS;
  }

  const match = KNOWN_STATUSES.find((status) => status.toLowerCase() === value.toLowerCase());
  return match ?? value;
}

function parseLegacyStatusMessage(rawStatus: string | null | undefined): {
  status: string;
  awayMessage: string;
} {
  const raw = (rawStatus ?? '').trim();
  if (!raw) {
    return { status: AVAILABLE_STATUS, awayMessage: '' };
  }

  for (const option of KNOWN_STATUSES) {
    const pattern = new RegExp(`^${option}\\s*(?:-|:)\\s*`, 'i');
    const match = raw.match(pattern);
    if (match) {
      const trailing = raw.slice(match[0].length).trim();
      return {
        status: option,
        awayMessage: option === AWAY_STATUS ? trailing : '',
      };
    }

    if (raw.toLowerCase() === option.toLowerCase()) {
      return { status: option, awayMessage: '' };
    }
  }

  return { status: AVAILABLE_STATUS, awayMessage: '' };
}

function composeStatusMessage(status: string, awayMessage: string | null | undefined): string {
  const normalizedStatus = normalizeStatusLabel(status);
  const trimmedAwayMessage = (awayMessage ?? '').trim();
  if (normalizedStatus === AWAY_STATUS && trimmedAwayMessage) {
    return `${AWAY_STATUS} - ${trimmedAwayMessage}`;
  }

  return normalizedStatus;
}

function resolveStatusFields({
  status,
  awayMessage,
  statusMessage,
}: {
  status: string | null | undefined;
  awayMessage: string | null | undefined;
  statusMessage: string | null | undefined;
}) {
  const legacy = parseLegacyStatusMessage(statusMessage);
  const resolvedStatus = normalizeStatusLabel(status || legacy.status);
  const resolvedAwayMessage =
    (awayMessage ?? '').trim() || (resolvedStatus === AWAY_STATUS ? legacy.awayMessage : '');
  const resolvedStatusMessage = composeStatusMessage(resolvedStatus, resolvedAwayMessage);

  return {
    status: resolvedStatus,
    awayMessage: resolvedAwayMessage,
    statusMessage: resolvedStatusMessage,
  };
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

function BuddyListContent() {
  const [userId, setUserId] = useState<string | null>(null);
  const [screenname, setScreenname] = useState('Loading...');
  const [statusMsg, setStatusMsg] = useState(AVAILABLE_STATUS);
  const [userStatus, setUserStatus] = useState(AVAILABLE_STATUS);
  const [awayMessage, setAwayMessage] = useState('');
  const [showAwayModal, setShowAwayModal] = useState(false);
  const [awayText, setAwayText] = useState('');
  const [awayModalError, setAwayModalError] = useState<string | null>(null);
  const [isSavingAwayMessage, setIsSavingAwayMessage] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const [buddyRows, setBuddyRows] = useState<Buddy[]>([]);
  const [isLoadingBuddies, setIsLoadingBuddies] = useState(false);
  const [hasLoadedBuddies, setHasLoadedBuddies] = useState(false);
  const [selectedBuddyId, setSelectedBuddyId] = useState<string | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [isBuddiesOpen, setIsBuddiesOpen] = useState(true);
  const [isOfflineOpen, setIsOfflineOpen] = useState(true);
  const [isActiveChatsOpen, setIsActiveChatsOpen] = useState(true);

  const [isRecoverySetupOpen, setIsRecoverySetupOpen] = useState(false);
  const [recoveryCodeDraft, setRecoveryCodeDraft] = useState('');
  const [recoveryCodeConfirmDraft, setRecoveryCodeConfirmDraft] = useState('');
  const [recoverySetupError, setRecoverySetupError] = useState<string | null>(null);
  const [isSavingRecoveryCode, setIsSavingRecoveryCode] = useState(false);

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
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isAdminResetOpen, setIsAdminResetOpen] = useState(false);
  const [adminResetScreenname, setAdminResetScreenname] = useState('');
  const [adminResetError, setAdminResetError] = useState<string | null>(null);
  const [isIssuingAdminReset, setIsIssuingAdminReset] = useState(false);
  const [issuedAdminTicket, setIssuedAdminTicket] = useState<{ ticket: string; expiresAt: string } | null>(null);

  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [pendingRequestError, setPendingRequestError] = useState<string | null>(null);
  const [isProcessingRequestId, setIsProcessingRequestId] = useState<string | null>(null);
  const [temporaryChatAllowedIds, setTemporaryChatAllowedIds] = useState<string[]>([]);
  const [temporaryChatProfiles, setTemporaryChatProfiles] = useState<Record<string, TemporaryChatProfile>>({});

  const [activeChatBuddyId, setActiveChatBuddyId] = useState<string | null>(null);
  const [unreadDirectMessages, setUnreadDirectMessages] = useState<Record<string, number>>({});
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
  const playSound = useSoundPlayer();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeRooms, unreadMessages, joinRoom, leaveRoom, clearUnreads, resetChatState } = useChatContext();

  useEffect(() => {
    activeChatBuddyIdRef.current = activeChatBuddyId;
  }, [activeChatBuddyId]);

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

  const getAccessToken = useCallback(async () => {
    return getAccessTokenOrNull();
  }, []);

  const readApiError = async (response: Response) => {
    try {
      const payload = (await response.json()) as { error?: string };
      return payload.error ?? 'Request failed.';
    } catch {
      return 'Request failed.';
    }
  };

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
      .select('id,screenname,status,away_message,status_msg')
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
        status: profile?.status ?? null,
        away_message: profile?.away_message ?? null,
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
      const session = await getSessionOrNull();
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
        .select('id,email,screenname,status,away_message,status_msg')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Failed to fetch profile:', profileError.message);
      }

      const existingProfile = userProfile as UserProfile | null;
      const resolvedScreenname = existingProfile?.screenname?.trim() || fallbackName;
      const resolvedStatusState = resolveStatusFields({
        status: existingProfile?.status,
        awayMessage: existingProfile?.away_message,
        statusMessage: existingProfile?.status_msg,
      });
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
          status: resolvedStatusState.status,
          away_message: resolvedStatusState.awayMessage || null,
          status_msg: resolvedStatusState.statusMessage,
          is_online: true,
        },
        { onConflict: 'id' },
      );

      if (upsertError) {
        console.error('Failed to sync profile:', upsertError.message);
      }

      setUserId(session.user.id);
      setScreenname(resolvedScreenname);
      setStatusMsg(resolvedStatusState.statusMessage);
      setUserStatus(resolvedStatusState.status);
      setAwayMessage(resolvedStatusState.awayMessage);
      let hasRecoveryCode = true;
      const { data: recoveryData, error: recoveryError } = await supabase
        .from('account_recovery_codes')
        .select('user_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (recoveryError) {
        console.error('Failed to check recovery code status:', recoveryError.message);
      } else {
        hasRecoveryCode = Boolean(recoveryData);
      }

      setIsRecoverySetupOpen(!hasRecoveryCode);

      let adminFlag = false;
      if (session.access_token) {
        const adminResponse = await fetch('/api/admin/me', {
          method: 'GET',
          cache: 'no-store',
          headers: {
            authorization: `Bearer ${session.access_token}`,
          },
        });

        if (adminResponse.ok) {
          const adminPayload = (await adminResponse.json()) as AdminMeResponse;
          adminFlag = Boolean(adminPayload.isAdmin);
        } else {
          const adminError = await readApiError(adminResponse);
          console.error(`Admin check via /api/admin/me failed (${adminResponse.status}):`, adminError);
        }
      } else {
        console.warn('Admin check skipped because the access token was missing.');
      }

      if (!adminFlag) {
        const { data: adminFallbackData, error: adminFallbackError } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (adminFallbackError) {
          console.error('Fallback admin_users check failed:', adminFallbackError.message);
        } else {
          adminFlag = Boolean(adminFallbackData);
        }
      }

      setIsAdminUser(adminFlag);
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
              status:
                typeof updated.status === 'string'
                  ? updated.status
                  : updated.status === null
                    ? null
                    : buddy.status,
              away_message:
                typeof updated.away_message === 'string'
                  ? updated.away_message
                  : updated.away_message === null
                    ? null
                    : buddy.away_message,
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
          if (
            typeof updated.status === 'string' ||
            typeof updated.away_message === 'string' ||
            typeof updated.status_msg === 'string' ||
            updated.status === null ||
            updated.away_message === null ||
            updated.status_msg === null
          ) {
            const resolvedStatusState = resolveStatusFields({
              status: updated.status ?? userStatus,
              awayMessage: updated.away_message ?? awayMessage,
              statusMessage: updated.status_msg ?? statusMsg,
            });
            setStatusMsg(resolvedStatusState.statusMessage);
            setUserStatus(resolvedStatusState.status);
            setAwayMessage(resolvedStatusState.awayMessage);
          }
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(usersChannel);
    };
  }, [awayMessage, statusMsg, userId, userStatus]);

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
        status: temporaryProfile.status,
        away_message: temporaryProfile.away_message,
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
      status: null,
      away_message: null,
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

  const incrementUnreadDirectMessages = useCallback((buddyId: string) => {
    if (!buddyId) {
      return;
    }

    setUnreadDirectMessages((previous) => ({
      ...previous,
      [buddyId]: (previous[buddyId] ?? 0) + 1,
    }));
  }, []);

  const clearUnreadDirectMessages = useCallback((buddyId: string) => {
    if (!buddyId) {
      return;
    }

    setUnreadDirectMessages((previous) => {
      if (!(buddyId in previous)) {
        return previous;
      }

      const next = { ...previous };
      delete next[buddyId];
      return next;
    });
  }, []);

  const openChatWindowForId = useCallback(
    (buddyId: string) => {
      setSelectedBuddyId(buddyId);
      setActiveChatBuddyId(buddyId);
      activeChatBuddyIdRef.current = buddyId;
      clearUnreadDirectMessages(buddyId);
      router.replace(`${BUDDY_LIST_PATH}?dm=${encodeURIComponent(buddyId)}`, { scroll: false });
      void loadConversation(buddyId);
    },
    [clearUnreadDirectMessages, loadConversation, router],
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
              .select('id,screenname,status,away_message,status_msg')
              .eq('id', senderId)
              .maybeSingle();

            const profile = senderProfile as UserProfile | null;
            const senderScreenname =
              profile?.screenname?.trim() || profile?.email?.split('@')[0] || 'Unknown User';
            const resolvedSenderStatus = resolveStatusFields({
              status: profile?.status,
              awayMessage: profile?.away_message,
              statusMessage: profile?.status_msg,
            });

            setTemporaryChatProfiles((previous) => ({
              ...previous,
              [senderId]: {
                screenname: senderScreenname,
                status: resolvedSenderStatus.status,
                away_message: resolvedSenderStatus.awayMessage || null,
                status_msg: resolvedSenderStatus.statusMessage,
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

        if (activeChatBuddyIdRef.current === senderId) {
          clearUnreadDirectMessages(senderId);
          setChatMessages((previous) =>
            previous.some((message) => message.id === incomingMessage.id)
              ? previous
              : [...previous, incomingMessage],
          );
          return;
        }

        incrementUnreadDirectMessages(senderId);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(globalMessagesChannel);
    };
  }, [clearUnreadDirectMessages, incrementUnreadDirectMessages, playIncomingAlert, userId]);

  const handleSignOff = async () => {
    setUnreadDirectMessages({});
    await resetChatState();
    await supabase.auth.signOut();
    router.push('/');
  };

  const updateStatus = useCallback(
    async (newStatus: string, message: string | null) => {
      if (!userId) {
        return false;
      }

      const normalizedStatus = normalizeStatusLabel(newStatus);
      const normalizedAwayMessage = (message ?? '').trim();
      const nextAwayMessage = normalizedStatus === AWAY_STATUS ? normalizedAwayMessage : '';
      const nextStatusMessage = composeStatusMessage(normalizedStatus, nextAwayMessage);

      const { error } = await supabase
        .from('users')
        .update({
          status: normalizedStatus,
          away_message: nextAwayMessage || null,
          status_msg: nextStatusMessage,
        })
        .eq('id', userId);

      if (error) {
        console.error('Failed to update status:', error.message);
        setAwayModalError(error.message);
        return false;
      }

      setUserStatus(normalizedStatus);
      setAwayMessage(nextAwayMessage);
      setStatusMsg(nextStatusMessage);
      return true;
    },
    [userId],
  );

  const openAwayModal = useCallback(() => {
    setAwayText(awayMessage);
    setAwayModalError(null);
    setShowAwayModal(true);
  }, [awayMessage]);

  const handleSaveAwayMessage = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setAwayModalError(null);
      setIsSavingAwayMessage(true);

      const success = await updateStatus(AWAY_STATUS, awayText);
      setIsSavingAwayMessage(false);

      if (!success) {
        return;
      }

      setShowAwayModal(false);
    },
    [awayText, updateStatus],
  );

  const handleImBack = useCallback(() => {
    void updateStatus(AVAILABLE_STATUS, null);
  }, [updateStatus]);

  const handleSaveRecoveryCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = recoveryCodeDraft.trim();
    const confirm = recoveryCodeConfirmDraft.trim();

    if (!trimmed || !confirm) {
      setRecoverySetupError('Enter and confirm your recovery code.');
      return;
    }

    if (trimmed !== confirm) {
      setRecoverySetupError('Recovery code entries do not match.');
      return;
    }

    setIsSavingRecoveryCode(true);
    setRecoverySetupError(null);

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setRecoverySetupError('Session expired. Please sign on again.');
      setIsSavingRecoveryCode(false);
      return;
    }

    const response = await fetch('/api/auth/recovery/setup', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ recoveryCode: trimmed }),
    });

    if (!response.ok) {
      const errorMessage = await readApiError(response);
      setRecoverySetupError(errorMessage);
      setIsSavingRecoveryCode(false);
      return;
    }

    setRecoveryCodeDraft('');
    setRecoveryCodeConfirmDraft('');
    setIsRecoverySetupOpen(false);
    setIsSavingRecoveryCode(false);
  };

  const openAdminResetWindow = () => {
    setAdminResetScreenname('');
    setAdminResetError(null);
    setIssuedAdminTicket(null);
    setIsAdminResetOpen(true);
  };

  const handleIssueAdminResetTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = adminResetScreenname.trim();
    if (!target) {
      setAdminResetError('Enter a screen name.');
      return;
    }

    setIsIssuingAdminReset(true);
    setAdminResetError(null);
    setIssuedAdminTicket(null);

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setAdminResetError('Session expired. Please sign on again.');
      setIsIssuingAdminReset(false);
      return;
    }

    const response = await fetch('/api/admin/password-reset-ticket', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ screenname: target }),
    });

    if (!response.ok) {
      const errorMessage = await readApiError(response);
      setAdminResetError(errorMessage);
      setIsIssuingAdminReset(false);
      return;
    }

    const payload = (await response.json()) as AdminTicketResponse;
    setIssuedAdminTicket({
      ticket: payload.ticket,
      expiresAt: payload.expiresAt,
    });
    setIsIssuingAdminReset(false);
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
      .select('id,screenname,status,away_message,status_msg')
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
  const requestedDirectMessageUserId = searchParams.get('dm')?.trim() ?? '';

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
    async (room: ChatRoom) => {
      await joinRoom(room.name);
      await clearUnreads(room.name);
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
          await leaveRoom(roomName);
          setRoomJoinError('That room no longer exists.');
          return;
        }

        await openRoomView(resolvedRoom);
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
    async (roomName: string) => {
      const normalizedRoomName = roomName.trim();
      if (!normalizedRoomName) {
        return;
      }

      await leaveRoom(normalizedRoomName);

      if (activeRoom && sameRoom(activeRoom.name, normalizedRoomName)) {
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

    void handleLeaveRoom(activeRoom.name);
  }, [activeRoom, handleLeaveRoom]);

  useEffect(() => {
    if (!userId || !requestedRoomName) {
      return;
    }

    if (activeRoom && sameRoom(activeRoom.name, requestedRoomName)) {
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        const resolvedRoom = await resolveRoomByName(requestedRoomName, false);
        if (isCancelled || !resolvedRoom) {
          return;
        }

        await joinRoom(resolvedRoom.name);
        await clearUnreads(resolvedRoom.name);
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

  useEffect(() => {
    if (!userId || !requestedDirectMessageUserId || requestedRoomName) {
      return;
    }

    if (requestedDirectMessageUserId === userId) {
      router.replace(BUDDY_LIST_PATH, { scroll: false });
      return;
    }

    let isCancelled = false;

    void (async () => {
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('id,screenname,status,away_message,status_msg')
        .eq('id', requestedDirectMessageUserId)
        .maybeSingle();

      if (isCancelled) {
        return;
      }

      if (profileError) {
        console.error('Failed to load direct message profile:', profileError.message);
      } else if (profileData) {
        const profile = profileData as UserProfile;
        const resolvedProfileStatus = resolveStatusFields({
          status: profile.status,
          awayMessage: profile.away_message,
          statusMessage: profile.status_msg,
        });
        setTemporaryChatProfiles((previous) => ({
          ...previous,
          [requestedDirectMessageUserId]: {
            screenname: profile.screenname?.trim() || 'Unknown User',
            status: resolvedProfileStatus.status,
            away_message: resolvedProfileStatus.awayMessage || null,
            status_msg: resolvedProfileStatus.statusMessage,
          },
        }));
      }

      setTemporaryChatAllowedIds((previous) =>
        previous.includes(requestedDirectMessageUserId)
          ? previous
          : [...previous, requestedDirectMessageUserId],
      );

      setSelectedBuddyId(requestedDirectMessageUserId);
      router.replace(BUDDY_LIST_PATH, { scroll: false });
    })();

    return () => {
      isCancelled = true;
    };
  }, [requestedDirectMessageUserId, requestedRoomName, router, userId]);

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

      await openRoomView(resolvedRoom);
      setShowRoomsWindow(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not join room right now.';
      setRoomJoinError(message);
    } finally {
      setIsJoiningRoom(false);
    }
  };

  const closeChatWindow = () => {
    setActiveChatBuddyId(null);
    activeChatBuddyIdRef.current = null;
    setChatMessages([]);
    setChatError(null);
    setIsChatLoading(false);
    if (activeRoom) {
      router.replace(`${BUDDY_LIST_PATH}?room=${encodeURIComponent(activeRoom.name)}`, { scroll: false });
    } else {
      router.replace(BUDDY_LIST_PATH, { scroll: false });
    }
  };

  const isCurrentUserAway = normalizeStatusLabel(userStatus) === AWAY_STATUS;
  const activePendingRequest = pendingRequests[0] ?? null;
  const activeChatBuddyStatusMessage = activeChatBuddy
    ? resolveStatusFields({
        status: activeChatBuddy.status,
        awayMessage: activeChatBuddy.away_message,
        statusMessage: activeChatBuddy.status_msg,
      }).statusMessage
    : null;
  const xpRaisedButtonClass =
    'min-h-[28px] border border-[#7f7f7f] border-t-white border-l-white border-r-[#808080] border-b-[#808080] bg-[#ece9d8] px-1 text-[11px] font-bold text-[#1e395b] disabled:opacity-60';

  const handleOpenImFromActionBar = () => {
    const fallbackBuddyId =
      (selectedBuddyId && acceptedBuddies.some((buddy) => buddy.id === selectedBuddyId)
        ? selectedBuddyId
        : null) ??
      onlineBuddies[0]?.id ??
      acceptedBuddies[0]?.id ??
      null;

    if (!fallbackBuddyId) {
      return;
    }

    handleOpenChat(fallbackBuddyId);
  };

  const handleSetupAction = () => {
    if (!isAdminUser) {
      return;
    }

    openAdminResetWindow();
  };

  return (
    <main className="h-[100dvh] overflow-hidden">
      <RetroWindow
        title="Buddy List"
        variant="xp_shell"
        xpTitleText={screenname && screenname !== 'Loading...' ? `${screenname} - Buddy List` : 'AIM Buddy List'}
        onXpClose={handleSignOff}
        onXpSignOff={handleSignOff}
      >
        <div className="flex h-full min-h-0 flex-col p-2 font-[Tahoma,Arial,sans-serif] text-[11px]">
          <div className="mx-auto mb-2 flex h-[50px] w-full max-w-[320px] items-center justify-center border-2 border-t-[#808080] border-l-[#808080] border-b-white border-r-white bg-[#f5f5f5] text-[#666]">
            Ad Space 320x50
          </div>

          <div className="mb-2 border border-[#b8b8b8] bg-[#f4f7fc] p-2">
            <div className="min-w-0">
              <p className="uppercase tracking-wide text-[#546b88]">Signed in as</p>
              <p className="truncate text-[13px] font-bold text-[#1e395b]">{screenname}</p>
              <p className="mt-0.5 truncate italic text-[#5b708f]">{statusMsg || AVAILABLE_STATUS}</p>
            </div>

            {isCurrentUserAway ? (
              <div className="mt-2 flex flex-col items-center space-y-2 border-y border-gray-400 bg-[#ffffe1] p-3 text-center shadow-sm">
                <p className="text-[12px] font-semibold text-[#4d5874]">You are currently Away.</p>
                <p className="w-full break-words text-[11px] italic text-gray-600">
                  {awayMessage || 'Away from keyboard.'}
                </p>
                <button
                  type="button"
                  onClick={handleImBack}
                  className={xpRaisedButtonClass}
                >
                  I&apos;m Back
                </button>
              </div>
            ) : (
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  disabled
                  className="min-h-[28px] border border-[#7f7f7f] border-t-[#a7a7a7] border-l-[#a7a7a7] border-r-white border-b-white bg-[#dfe6f1] px-2 font-bold text-[#1e395b]"
                >
                  Available
                </button>
                <button type="button" onClick={openAwayModal} className={xpRaisedButtonClass}>
                  Set Away Message
                </button>
              </div>
            )}
            {awayModalError ? <p className="mt-2 font-semibold text-red-700">{awayModalError}</p> : null}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden border-2 border-t-[#808080] border-l-[#808080] border-b-white border-r-white bg-white">
            <div className="h-full overflow-y-auto">
              <div className="select-none">
                <button
                  type="button"
                  onClick={() => setIsBuddiesOpen((previous) => !previous)}
                  className="flex w-full items-center gap-2 border-y border-[#aab7cd] bg-gradient-to-b from-[#f3f6fb] to-[#dce6f6] px-2 py-1.5 text-left font-bold text-[#1e395b]"
                >
                  <span className="inline-flex h-3.5 w-3.5 items-center justify-center border border-[#7f7f7f] bg-[#ece9d8] text-[10px] leading-none">
                    {isBuddiesOpen ? '-' : '+'}
                  </span>
                  <span>Buddies ({onlineBuddies.length}/{acceptedBuddies.length})</span>
                </button>

                {isBuddiesOpen ? (
                  <div>
                    {isBootstrapping ? <p className="px-2 py-1 italic text-slate-500">Dialing in...</p> : null}
                    {!isBootstrapping && isLoadingBuddies ? (
                      <p className="px-2 py-1 italic text-slate-500">Loading your buddy list...</p>
                    ) : null}
                    {!isBootstrapping && !isLoadingBuddies && acceptedBuddies.length === 0 ? (
                      <p className="px-2 py-1 italic text-slate-500">List is empty.</p>
                    ) : null}
                    {!isBootstrapping &&
                      onlineBuddies.map((buddy) => {
                        const unreadDirectCount = unreadDirectMessages[buddy.id] ?? 0;
                        const isSelected = selectedBuddyId === buddy.id;
                        const resolvedBuddyStatus = resolveStatusFields({
                          status: buddy.status,
                          awayMessage: buddy.away_message,
                          statusMessage: buddy.status_msg,
                        });
                        const isBuddyAway = normalizeStatusLabel(resolvedBuddyStatus.status) === AWAY_STATUS;
                        const awayLine = resolvedBuddyStatus.awayMessage || 'Away';

                        return (
                          <button
                            key={buddy.id}
                            type="button"
                            onClick={() => handleOpenChat(buddy.id)}
                            className={`group flex min-h-[24px] w-full items-center justify-between border-b border-[#e5ecf5] px-2 py-1 text-left transition ${
                              isSelected
                                ? 'bg-[#316ac5] text-white'
                                : 'text-[#1e395b] hover:bg-[#316ac5] hover:text-white'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className={isSelected ? 'text-white' : 'text-emerald-600'}>
                                  {isBuddyAway ? '📜' : '●'}
                                </span>
                                <span
                                  className={`truncate font-bold ${
                                    isBuddyAway && !isSelected ? 'italic text-gray-500 group-hover:text-white' : ''
                                  }`}
                                >
                                  {buddy.screenname}
                                </span>
                              </div>
                              {isBuddyAway ? (
                                <p
                                  className={`w-full truncate pl-4 text-[10px] italic ${
                                    isSelected ? 'text-blue-100' : 'text-gray-500 group-hover:text-blue-100'
                                  }`}
                                  title={awayLine}
                                >
                                  {awayLine}
                                </p>
                              ) : null}
                            </div>
                            {unreadDirectCount > 0 ? (
                              <span className="ml-2 shrink-0 rounded-full border border-white bg-gradient-to-b from-red-400 to-red-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm shadow-black/50">
                                {unreadDirectCount}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}

                    {pendingBuddies.length > 0 ? (
                      <div className="border-b border-[#e5ecf5] px-2 py-1">
                        <p className="font-bold text-[#536b89]">Pending ({pendingBuddies.length})</p>
                        {pendingBuddies.map((buddy) => (
                          <p key={buddy.id} className="truncate italic text-slate-500">
                            {buddy.screenname}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="select-none">
                <button
                  type="button"
                  onClick={() => setIsOfflineOpen((previous) => !previous)}
                  className="flex w-full items-center gap-2 border-y border-[#aab7cd] bg-gradient-to-b from-[#f3f6fb] to-[#dce6f6] px-2 py-1.5 text-left font-bold text-[#1e395b]"
                >
                  <span className="inline-flex h-3.5 w-3.5 items-center justify-center border border-[#7f7f7f] bg-[#ece9d8] text-[10px] leading-none">
                    {isOfflineOpen ? '-' : '+'}
                  </span>
                  <span>Offline ({offlineBuddies.length}/{acceptedBuddies.length})</span>
                </button>

                {isOfflineOpen
                  ? offlineBuddies.map((buddy) => {
                      const unreadDirectCount = unreadDirectMessages[buddy.id] ?? 0;
                      const isSelected = selectedBuddyId === buddy.id;
                      const resolvedBuddyStatus = resolveStatusFields({
                        status: buddy.status,
                        awayMessage: buddy.away_message,
                        statusMessage: buddy.status_msg,
                      });
                      const isBuddyAway = normalizeStatusLabel(resolvedBuddyStatus.status) === AWAY_STATUS;
                      const awayLine = resolvedBuddyStatus.awayMessage || 'Away';

                      return (
                        <button
                          key={buddy.id}
                          type="button"
                          onClick={() => handleOpenChat(buddy.id)}
                          className={`group flex min-h-[24px] w-full items-center justify-between border-b border-[#e5ecf5] px-2 py-1 text-left transition ${
                            isSelected
                              ? 'bg-[#316ac5] text-white'
                              : 'text-[#1e395b] hover:bg-[#316ac5] hover:text-white'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={isSelected ? 'text-white' : 'text-slate-500'}>
                                {isBuddyAway ? '📜' : '○'}
                              </span>
                              <span
                                className={`truncate font-bold ${
                                  isBuddyAway && !isSelected ? 'italic text-gray-500 group-hover:text-white' : ''
                                }`}
                              >
                                {buddy.screenname}
                              </span>
                            </div>
                            {isBuddyAway ? (
                              <p
                                className={`w-full truncate pl-4 text-[10px] italic ${
                                  isSelected ? 'text-blue-100' : 'text-gray-500 group-hover:text-blue-100'
                                }`}
                                title={awayLine}
                              >
                                {awayLine}
                              </p>
                            ) : null}
                          </div>
                          {unreadDirectCount > 0 ? (
                            <span className="ml-2 shrink-0 rounded-full border border-white bg-gradient-to-b from-red-400 to-red-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm shadow-black/50">
                              {unreadDirectCount}
                            </span>
                          ) : null}
                        </button>
                      );
                    })
                  : null}
              </div>

              <div className="select-none">
                <button
                  type="button"
                  onClick={() => setIsActiveChatsOpen((previous) => !previous)}
                  className="flex w-full items-center gap-2 border-y border-[#aab7cd] bg-gradient-to-b from-[#f3f6fb] to-[#dce6f6] px-2 py-1.5 text-left font-bold text-[#1e395b]"
                >
                  <span className="inline-flex h-3.5 w-3.5 items-center justify-center border border-[#7f7f7f] bg-[#ece9d8] text-[10px] leading-none">
                    {isActiveChatsOpen ? '-' : '+'}
                  </span>
                  <span>Active Chats ({activeRooms.length})</span>
                </button>

                {isActiveChatsOpen ? (
                  activeRooms.length === 0 ? (
                    <p className="px-2 py-1 italic text-slate-500">No active rooms.</p>
                  ) : (
                    activeRooms.map((roomName) => {
                      const unreadCount = getUnreadCountForRoom(roomName);

                      return (
                        <div key={roomName} className="flex items-stretch border-b border-[#e5ecf5]">
                          <button
                            type="button"
                            onClick={() => void handleOpenActiveRoom(roomName)}
                            className="group flex min-h-[24px] flex-1 items-center justify-between px-2 py-1 text-left text-[#1e395b] transition hover:bg-[#316ac5] hover:text-white"
                          >
                            <span className="truncate font-bold">{roomName}</span>
                            {unreadCount > 0 ? (
                              <span className="ml-2 shrink-0 rounded-full border border-white bg-gradient-to-b from-red-400 to-red-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm shadow-black/50">
                                {unreadCount}
                              </span>
                            ) : null}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleLeaveRoom(roomName)}
                            className="inline-flex min-h-[24px] min-w-[24px] items-center justify-center border-l border-[#c3d4e6] bg-gradient-to-b from-[#fefefe] via-[#f4f4f4] to-[#dedede] px-2 text-[11px] font-bold text-[#7b1f1f] shadow-[inset_1px_1px_0_rgba(255,255,255,0.8)] transition hover:from-[#ffe7e7] hover:to-[#f0caca]"
                            aria-label={`Leave ${roomName}`}
                            title="Leave room"
                          >
                            X
                          </button>
                        </div>
                      );
                    })
                  )
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-2 border-t border-[#9a9a9a] bg-[#ece9d8] p-1">
            <div className="grid grid-cols-5 gap-1">
              <button type="button" onClick={handleOpenImFromActionBar} className={xpRaisedButtonClass}>
                IM
              </button>
              <button type="button" onClick={openRoomsWindow} className={xpRaisedButtonClass}>
                Chat
              </button>
              <button type="button" onClick={openAddWindow} className={xpRaisedButtonClass}>
                Info
              </button>
              <button type="button" onClick={openAwayModal} className={xpRaisedButtonClass}>
                Away
              </button>
              <button
                type="button"
                onClick={handleSetupAction}
                disabled={!isAdminUser}
                className={xpRaisedButtonClass}
              >
                Setup
              </button>
            </div>
          </div>
        </div>
      </RetroWindow>

      {isRecoverySetupOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md">
            <RetroWindow title="Set Recovery Code">
              <form onSubmit={handleSaveRecoveryCode} className="space-y-3 text-sm">
                <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                  You must set a recovery code before continuing. Store this safely. It is required for forgotten
                  password recovery.
                </p>

                <div>
                  <label htmlFor="recovery-code-input" className="mb-1 block text-[12px] font-semibold text-slate-700">
                    Recovery code
                  </label>
                  <input
                    id="recovery-code-input"
                    value={recoveryCodeDraft}
                    onChange={(event) => setRecoveryCodeDraft(event.target.value)}
                    className="w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm shadow-[inset_0_1px_3px_rgba(37,99,235,0.18)] focus:outline-none"
                    placeholder="MY-SECRET-CODE-2026"
                    minLength={8}
                    disabled={isSavingRecoveryCode}
                  />
                </div>

                <div>
                  <label
                    htmlFor="recovery-code-confirm-input"
                    className="mb-1 block text-[12px] font-semibold text-slate-700"
                  >
                    Confirm recovery code
                  </label>
                  <input
                    id="recovery-code-confirm-input"
                    value={recoveryCodeConfirmDraft}
                    onChange={(event) => setRecoveryCodeConfirmDraft(event.target.value)}
                    className="w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm shadow-[inset_0_1px_3px_rgba(37,99,235,0.18)] focus:outline-none"
                    placeholder="Repeat your code"
                    minLength={8}
                    disabled={isSavingRecoveryCode}
                  />
                </div>

                {recoverySetupError && (
                  <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {recoverySetupError}
                  </p>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSignOff()}
                    className="cursor-pointer rounded-md border border-blue-300 bg-gradient-to-b from-white via-slate-100 to-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:from-slate-50 hover:to-slate-300"
                  >
                    Sign Off
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingRecoveryCode}
                    className="cursor-pointer rounded-md border border-blue-500 bg-gradient-to-b from-blue-200 via-blue-300 to-blue-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:from-blue-300 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingRecoveryCode ? 'Saving...' : 'Save Recovery Code'}
                  </button>
                </div>
              </form>
            </RetroWindow>
          </div>
        </div>
      )}

      {isAdminResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md">
            <RetroWindow title="Admin Password Reset">
              <form onSubmit={handleIssueAdminResetTicket} className="space-y-3 text-sm">
                <p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[12px] text-blue-800">
                  Issue a one-time password reset ticket for out-of-band delivery.
                </p>
                <div>
                  <label htmlFor="admin-reset-screenname" className="mb-1 block text-[12px] font-semibold text-slate-700">
                    Target screen name
                  </label>
                  <input
                    id="admin-reset-screenname"
                    value={adminResetScreenname}
                    onChange={(event) => setAdminResetScreenname(event.target.value)}
                    className="w-full rounded-md border border-blue-300 bg-white px-3 py-2 text-sm shadow-[inset_0_1px_3px_rgba(37,99,235,0.18)] focus:outline-none"
                    placeholder="screenname"
                    disabled={isIssuingAdminReset}
                  />
                </div>

                {adminResetError && (
                  <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {adminResetError}
                  </p>
                )}

                {issuedAdminTicket && (
                  <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                    <p className="font-bold">One-time ticket (share securely):</p>
                    <p className="mt-1 break-all font-mono text-[13px] font-bold">{issuedAdminTicket.ticket}</p>
                    <p className="mt-1 text-[11px]">
                      Expires: {new Date(issuedAdminTicket.expiresAt).toLocaleString()}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(issuedAdminTicket.ticket);
                      }}
                      className="mt-2 rounded-md border border-amber-500 bg-gradient-to-b from-amber-100 to-amber-300 px-3 py-1 text-xs font-semibold text-amber-900"
                    >
                      Copy Ticket
                    </button>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAdminResetOpen(false)}
                    className="cursor-pointer rounded-md border border-blue-300 bg-gradient-to-b from-white via-slate-100 to-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:from-slate-50 hover:to-slate-300"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={isIssuingAdminReset}
                    className="cursor-pointer rounded-md border border-blue-500 bg-gradient-to-b from-blue-200 via-blue-300 to-blue-500 px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:from-blue-300 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isIssuingAdminReset ? 'Issuing...' : 'Issue Ticket'}
                  </button>
                </div>
              </form>
            </RetroWindow>
          </div>
        </div>
      )}

      {showAwayModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
          <div className="w-80 max-w-[90%] border-2 border-t-white border-l-white border-r-gray-500 border-b-gray-500 bg-[#eceeef] p-1 shadow-xl">
            <div className="mb-2 flex min-h-[28px] items-center bg-gradient-to-b from-blue-400 via-blue-500 to-blue-700 px-3">
              <p className="text-sm font-bold text-white [text-shadow:0_1px_0_rgba(0,0,0,0.35)]">
                Set Away Message
              </p>
            </div>

            <form onSubmit={handleSaveAwayMessage} className="space-y-3 px-2 pb-2 text-sm">
              <label htmlFor="away-message-input" className="block text-[12px] font-semibold text-[#1e395b]">
                Enter your Away Message:
              </label>
              <textarea
                id="away-message-input"
                value={awayText}
                onChange={(event) => setAwayText(event.target.value)}
                className="min-h-[104px] w-full resize-none border border-[#7F9DB9] bg-white p-2 text-sm shadow-inner focus:outline-none focus:ring-1 focus:ring-[#7F9DB9]"
                placeholder="Out for lunch..."
                maxLength={240}
              />

              {awayModalError ? (
                <p className="text-[12px] font-semibold text-red-700">{awayModalError}</p>
              ) : null}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAwayModal(false);
                    setAwayModalError(null);
                  }}
                  className="min-h-[34px] border-2 border-t-white border-l-white border-r-gray-500 border-b-gray-500 bg-[#eceeef] px-3 text-xs font-bold text-[#1e395b] shadow-[inset_1px_1px_0_rgba(255,255,255,0.8)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAwayMessage}
                  className="min-h-[34px] border-2 border-t-white border-l-white border-r-gray-500 border-b-gray-500 bg-[#eceeef] px-4 text-xs font-bold text-[#1e395b] shadow-[inset_1px_1px_0_rgba(255,255,255,0.8)] disabled:opacity-60"
                >
                  {isSavingAwayMessage ? 'Saving...' : 'OK'}
                </button>
              </div>
            </form>
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
                    searchResults.map((profile) => {
                      const resolvedProfileStatus = resolveStatusFields({
                        status: profile.status,
                        awayMessage: profile.away_message,
                        statusMessage: profile.status_msg,
                      });
                      const isProfileAway = normalizeStatusLabel(resolvedProfileStatus.status) === AWAY_STATUS;

                      return (
                        <div
                          key={profile.id}
                          className="mb-2 flex items-center justify-between gap-2 rounded-md border border-blue-100 bg-blue-50/30 p-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-bold">{profile.screenname || 'Unknown User'}</p>
                            <p className="truncate text-[11px] italic text-slate-500">
                              {isProfileAway
                                ? `📜 ${resolvedProfileStatus.awayMessage || 'Away'}`
                                : resolvedProfileStatus.statusMessage}
                            </p>
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
                      );
                    })}
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
            buddyStatusMessage={activeChatBuddyStatusMessage || AVAILABLE_STATUS}
            currentUserId={userId}
            messages={chatMessages}
            onSendMessage={handleSendMessage}
            onClose={closeChatWindow}
            onSignOff={handleSignOff}
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
          onSignOff={handleSignOff}
        />
      )}
    </main>
  );
}

export default function BuddyList() {
  return (
    <Suspense fallback={<main className="h-[100dvh] overflow-hidden bg-[#f8f9fa]" />}>
      <BuddyListContent />
    </Suspense>
  );
}
