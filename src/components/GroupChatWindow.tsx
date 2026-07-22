'use client';

import { FormEvent, KeyboardEvent, type CSSProperties, type MutableRefObject, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import AppIcon from '@/components/AppIcon';
import ProfileAvatar from '@/components/ProfileAvatar';
import RetroWindow from '@/components/RetroWindow';
import RichTextToolbar from '@/components/RichTextToolbar';
import SwipeActionFrame from '@/components/SwipeActionFrame';
import type { OutboxItem } from '@/lib/outbox';
import { getJSON, setJSON } from '@/lib/clientStorage';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { sendOrAcceptBuddyRequest, type BuddyRequestStatus } from '@/lib/buddyRequest';
import { countSeenByOthers, formatSeenByLabel } from '@/lib/roomReadReceipts';
import { useKeyboardViewport } from '@/hooks/useKeyboardViewport';
import { useSwipeBack } from '@/hooks/useSwipeBack';
import {
  formatConversationDividerLabel,
  formatConversationMetaTime,
  getConversationClusterMeta,
} from '@/lib/conversationPresentation';
import {
  isNativeIosShell,
  type NativeMilestoneOneRoomBridge,
  type NativeMilestoneOneRoomConversation,
} from '@/lib/nativeShell';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_RICH_TEXT_FORMAT,
  getRichTextPresentation,
  formatRichText,
  htmlToPlainText,
  isDefaultRichTextFormat,
  normalizeRichTextFormat,
  RICH_TEXT_FORMAT_STORAGE_KEY,
  RichTextFormat,
  sanitizeRichTextHtml,
} from '@/lib/richText';
import { MESSAGE_HIDDEN_PLACEHOLDER } from '@/lib/contentModeration';
import {
  EXTENDED_ROOM_PROFILE_SELECT_FIELDS,
  isProfileSchemaMissingError,
  LEGACY_ROOM_PROFILE_SELECT_FIELDS,
  withProfileSchemaDefaultsList,
} from '@/lib/profileSchema';
import { useChatContext } from '@/context/ChatContext';
import { createClientMessageId } from '@/lib/outbox';
import {
  LEGACY_ROOM_MESSAGE_SELECT_FIELDS,
  ROOM_MESSAGE_SELECT_FIELDS,
  isRoomMessageMetadataSchemaMissingError,
  sendRoomMessageWithClientMessageId,
} from '@/lib/messageIdempotency';

interface RoomMessage {
  id: string;
  room_id: string;
  user_id: string;
  body: string;
  created_at: string;
  flagged_at?: string | null;
}

interface RosterMember {
  user_id: string;
  last_seen_at: string;
}

interface RosterProfile {
  id: string;
  screenname: string;
  awayMessage: string | null;
  bio: string | null;
}

interface RoomParticipant {
  userId: string;
  screenname: string;
  onlineAt: string | null;
}

interface RoomPresenceMeta {
  screenname?: string;
  online_at?: string;
}

interface RoomTypingPayload {
  userId?: string;
  screenname?: string;
}

interface RoomProfile {
  id: string;
  screenname: string | null;
  buddy_icon_path: string | null;
}

interface BuddyStub {
  id: string;
  screenname: string;
}

interface GroupChatWindowProps {
  roomId: string;
  roomName: string;
  currentUserId: string;
  currentUserScreenname: string;
  currentUserBuddyIconPath?: string | null;
  initialUnreadCount?: number;
  initialDraft?: string;
  outboxItems?: OutboxItem[];
  typingUsers?: string[];
  onDraftChange?: (draft: string) => void;
  onQueueRoomMessage?: (payload: {
    roomId: string;
    content: string;
    clientMessageId?: string;
    errorMessage?: string;
  }) => boolean | void;
  onRetryOutboxMessage?: (itemId: string) => void;
  buddies?: BuddyStub[];
  onBack: () => void;
  onLeave: () => void;
  onSignOff?: () => void;
  reloadToken?: number;
  blockedUserIds?: string[];
  onReportRoomMessage?: (payload: {
    messageId: string;
    senderId: string;
    senderScreenname: string;
    contentPreview: string;
  }) => void;
  onBlockRoomUser?: (payload: { userId: string; screenname: string }) => void;
  nativeBridgeRef?: MutableRefObject<NativeMilestoneOneRoomBridge | null>;
  onNativeStateChange?: (conversation: NativeMilestoneOneRoomConversation) => void;
}

const GROUP_SENDER_COLOR_CLASSES = [
  'text-[var(--green)]',
  'text-[var(--lavender)]',
  'text-[var(--rose)]',
  'text-[var(--gold)]',
  'text-[color:color-mix(in_srgb,var(--rose)_78%,white)]',
  'text-[color:color-mix(in_srgb,var(--gold)_76%,white)]',
  'text-[color:color-mix(in_srgb,var(--lavender)_76%,white)]',
  'text-[color:color-mix(in_srgb,var(--green)_78%,white)]',
] as const;

function getStableSenderColorClass(senderId: string) {
  let hash = 0;
  for (let index = 0; index < senderId.length; index += 1) {
    hash = (hash * 31 + senderId.charCodeAt(index)) >>> 0;
  }
  return GROUP_SENDER_COLOR_CLASSES[hash % GROUP_SENDER_COLOR_CLASSES.length];
}

function getChatScrollBehavior(): ScrollBehavior {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return 'auto';
  }

  return 'smooth';
}

function loadStoredRichTextFormat() {
  return normalizeRichTextFormat(
    getJSON<Partial<RichTextFormat>>(RICH_TEXT_FORMAT_STORAGE_KEY, {
      fallback: DEFAULT_RICH_TEXT_FORMAT,
    }),
  );
}

export default function GroupChatWindow({
  roomId,
  roomName,
  currentUserId,
  currentUserScreenname,
  currentUserBuddyIconPath = null,
  initialUnreadCount = 0,
  initialDraft = '',
  outboxItems = [],
  typingUsers = [],
  onDraftChange,
  onQueueRoomMessage,
  onRetryOutboxMessage,
  buddies = [],
  onBack,
  onLeave,
  onSignOff,
  reloadToken = 0,
  blockedUserIds = [],
  onReportRoomMessage,
  onBlockRoomUser,
  nativeBridgeRef,
  onNativeStateChange,
}: GroupChatWindowProps) {
  const blockedUserIdSet = useMemo(() => new Set(blockedUserIds), [blockedUserIds]);
  const { clearUnreads } = useChatContext();
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [participants, setParticipants] = useState<RoomParticipant[]>([]);
  const [screennameMap, setScreennameMap] = useState<Record<string, string>>({
    [currentUserId]: currentUserScreenname,
  });
  const screennameMapRef = useRef<Record<string, string>>({});
  const [buddyIconMap, setBuddyIconMap] = useState<Record<string, string | null>>({
    [currentUserId]: currentUserBuddyIconPath,
  });
  const buddyIconMapRef = useRef<Record<string, string | null>>({});

  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(initialDraft);
  const [format, setFormat] = useState<RichTextFormat>(() => loadStoredRichTextFormat());
  const [showFormatting, setShowFormatting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showConversationMenu, setShowConversationMenu] = useState(false);
  const [showComposerTools, setShowComposerTools] = useState(false);
  const [mentioningMessageId, setMentioningMessageId] = useState<string | null>(null);
  const [longPressRoomMessageId, setLongPressRoomMessageId] = useState<string | null>(null);
  const longPressRoomTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [composerAreaHeight, setComposerAreaHeight] = useState(0);
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [relativeTimeTick, setRelativeTimeTick] = useState(0);

  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [selectedInviteIds, setSelectedInviteIds] = useState<Set<string>>(() => new Set());
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [rosterMembers, setRosterMembers] = useState<RosterMember[]>([]);
  const [memberLastSeenById, setMemberLastSeenById] = useState<Record<string, string>>({});
  const [isRosterInitialLoading, setIsRosterInitialLoading] = useState(true);
  const rosterLoadedOnceRef = useRef(false);
  const [rosterProfileId, setRosterProfileId] = useState<string | null>(null);
  const [rosterProfile, setRosterProfile] = useState<RosterProfile | null>(null);
  const [isLoadingRosterProfile, setIsLoadingRosterProfile] = useState(false);
  const [rosterProfileFeedback, setRosterProfileFeedback] = useState<string | null>(null);
  const [rosterProfileStatus, setRosterProfileStatus] = useState<BuddyRequestStatus | null>(null);
  const [isAddingRosterBuddy, setIsAddingRosterBuddy] = useState(false);

  const handleBack = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => onBack(), 190);
  }, [onBack]);

  const invitableBuddies = useMemo(() => {
    const memberIds = new Set(participants.map((p) => p.userId));
    return buddies.filter((b) => !memberIds.has(b.id));
  }, [buddies, participants]);

  const handleInviteConfirm = useCallback(async () => {
    if (selectedInviteIds.size === 0 || isInviting) return;
    setIsInviting(true);
    setInviteError(null);
    try {
      const { getAccessTokenOrNull } = await import('@/lib/authClient');
      const { getEdgeFunctionUrl } = await import('@/lib/appApi');
      const token = await getAccessTokenOrNull();
      const response = await fetch(getEdgeFunctionUrl('rooms-invite'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ roomId, buddyIds: Array.from(selectedInviteIds) }),
      });
      const result = (await response.json()) as { invited?: string[]; error?: string };
      if (!response.ok || result.error) {
        setInviteError(result.error ?? 'Invite failed.');
        return;
      }
      const invitedIds = result.invited ?? [];
      const invitedBuddies = buddies.filter((b) => invitedIds.includes(b.id));
      setParticipants((prev) => {
        const existingIds = new Set(prev.map((p) => p.userId));
        const additions = invitedBuddies
          .filter((b) => !existingIds.has(b.id))
          .map((b) => ({ userId: b.id, screenname: b.screenname, onlineAt: null }));
        return [...prev, ...additions];
      });
      setShowInviteSheet(false);
      setSelectedInviteIds(new Set());
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : 'Invite failed.');
    } finally {
      setIsInviting(false);
    }
  }, [buddies, isInviting, roomId, selectedInviteIds]);

  const swipeBack = useSwipeBack({ onSwipeBack: handleBack });
  const lastOwnMessage = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].user_id === currentUserId) {
        return messages[index];
      }
    }
    return null;
  }, [currentUserId, messages]);
  const lastOwnMessageSeenLabel = useMemo(
    () =>
      lastOwnMessage
        ? formatSeenByLabel(countSeenByOthers(memberLastSeenById, currentUserId, lastOwnMessage.created_at))
        : null,
    [currentUserId, lastOwnMessage, memberLastSeenById],
  );
  // Only presence-synced entries carry a non-null onlineAt; the invite flow
  // optimistically appends invitees with onlineAt: null, and those must not
  // light up as "actively in the room".
  const activeParticipantIds = useMemo(
    () =>
      new Set(
        participants
          .filter((participant) => participant.onlineAt !== null)
          .map((participant) => participant.userId),
      ),
    [participants],
  );
  const [isSending, setIsSending] = useState(false);
  const [hasLiveMessageSinceOpen, setHasLiveMessageSinceOpen] = useState(false);
  const [typingMap, setTypingMap] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const composerAreaRef = useRef<HTMLDivElement>(null);
  const searchInputId = useId();
  const searchResultsId = useId();
  const messagesLogId = useId();
  const composerInputId = useId();
  const composerHelpId = useId();
  const roomChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentAtRef = useRef(0);
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const { isKeyboardOpen, viewportHeight } = useKeyboardViewport();
  const nativeShellActive = isNativeIosShell();
  const hasCustomFormatting = !isDefaultRichTextFormat(format);
  const composerTextStyle: CSSProperties = {
    maxHeight: '88px',
    overflowY: 'auto',
    fontFamily: format.fontFamily,
    fontWeight: format.bold ? 'bold' : 'normal',
    fontStyle: format.italic ? 'italic' : 'normal',
    textDecoration: format.underline ? 'underline' : 'none',
  };
  const scrollToLatestMessage = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: getChatScrollBehavior(), block: 'end' });
  }, []);
  const focusComposer = useCallback(() => {
    composerRef.current?.focus();
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        scrollToLatestMessage();
      });
    }
  }, [scrollToLatestMessage]);

  useEffect(() => {
    screennameMapRef.current = screennameMap;
  }, [screennameMap]);

  useEffect(() => {
    buddyIconMapRef.current = buddyIconMap;
  }, [buddyIconMap]);

  useEffect(() => {
    setScreennameMap((previous) => ({
      ...previous,
      [currentUserId]: currentUserScreenname,
    }));
    setBuddyIconMap((previous) => ({
      ...previous,
      [currentUserId]: currentUserBuddyIconPath,
    }));
  }, [currentUserBuddyIconPath, currentUserId, currentUserScreenname]);

  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setRelativeTimeTick((previous) => previous + 1);
    }, 60_000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    setJSON(RICH_TEXT_FORMAT_STORAGE_KEY, normalizeRichTextFormat(format));
  }, [format]);

  useEffect(() => {
    const composerArea = composerAreaRef.current;
    if (!composerArea) {
      return;
    }

    const updateHeight = () => {
      setComposerAreaHeight(composerArea.getBoundingClientRect().height);
    };

    updateHeight();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => {
      updateHeight();
    });
    observer.observe(composerArea);

    return () => {
      observer.disconnect();
    };
  }, []);


  const ensureScreennames = useCallback(async (userIds: string[]) => {
    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
    if (uniqueUserIds.length === 0) {
      return;
    }

    const missingIds = uniqueUserIds.filter((userId) => !screennameMapRef.current[userId]);
    if (missingIds.length === 0) {
      return;
    }

    const runProfileQuery = async (fields: string) => {
      const { data, error } = await supabase.from('users').select(fields).in('id', missingIds);
      return {
        data: withProfileSchemaDefaultsList((data ?? []) as Partial<RoomProfile>[]),
        error,
      };
    };

    let { data, error: profileError } = await runProfileQuery(EXTENDED_ROOM_PROFILE_SELECT_FIELDS);

    if (isProfileSchemaMissingError(profileError)) {
      console.warn('Presence/profile migration missing in room header:', profileError?.message);
      ({ data, error: profileError } = await runProfileQuery(LEGACY_ROOM_PROFILE_SELECT_FIELDS));
    }

    if (profileError) {
      console.error('Failed to load room user profiles:', profileError.message);
      return;
    }

    const profiles = data as RoomProfile[];
    setScreennameMap((previous) => {
      const next = { ...previous };
      next[currentUserId] = currentUserScreenname;
      for (const profile of profiles) {
        next[profile.id] = profile.screenname?.trim() || 'Unknown User';
      }
      for (const missingId of missingIds) {
        if (!next[missingId]) {
          next[missingId] = 'Unknown User';
        }
      }
      screennameMapRef.current = next;
      setParticipants((previousParticipants) =>
        previousParticipants.map((participant) => ({
          ...participant,
          screenname: next[participant.userId] || participant.screenname,
        })),
      );
      return next;
    });
    setBuddyIconMap((previous) => {
      const next = {
        ...previous,
        [currentUserId]: currentUserBuddyIconPath,
      };
      for (const profile of profiles) {
        next[profile.id] = profile.buddy_icon_path ?? null;
      }
      for (const missingId of missingIds) {
        if (!(missingId in next)) {
          next[missingId] = null;
        }
      }
      buddyIconMapRef.current = next;
      return next;
    });
  }, [currentUserBuddyIconPath, currentUserId, currentUserScreenname]);

  const loadRoster = useCallback(async () => {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    // Full membership (no cutoff): rosterMembers keeps the 5-minute "active"
    // window, while the complete last_seen_at map powers "Seen by" counts on
    // own messages.
    const { data } = await supabase
      .from('room_memberships')
      .select('user_id, last_seen_at')
      .eq('room_id', roomId)
      .order('last_seen_at', { ascending: false });
    const allRows = (data ?? []) as RosterMember[];
    setMemberLastSeenById(
      Object.fromEntries(allRows.map((row) => [row.user_id, row.last_seen_at])),
    );
    const rows = allRows.filter((row) => row.last_seen_at >= cutoff);
    setRosterMembers(rows);
    void ensureScreennames(rows.map((r) => r.user_id));
    if (!rosterLoadedOnceRef.current) {
      rosterLoadedOnceRef.current = true;
      setIsRosterInitialLoading(false);
    }
  }, [roomId, ensureScreennames]);

  const openRosterProfile = useCallback(async (userId: string) => {
    if (userId === currentUserId) return;
    setRosterProfileId(userId);
    setRosterProfile(null);
    setRosterProfileFeedback(null);
    setRosterProfileStatus(null);
    setIsLoadingRosterProfile(true);
    try {
      const { data } = await supabase
        .from('users')
        .select('id, screenname, away_message, profile_bio')
        .eq('id', userId)
        .maybeSingle();
      if (data) {
        setRosterProfile({
          id: data.id as string,
          screenname: ((data.screenname as string) ?? '').trim() || screennameMapRef.current[userId] || 'Unknown User',
          awayMessage: (data.away_message as string | null) || null,
          bio: (data.profile_bio as string | null) || null,
        });
      }
    } finally {
      setIsLoadingRosterProfile(false);
    }
  }, [currentUserId]);

  const handleAddRosterBuddy = useCallback(async (userId: string) => {
    if (isAddingRosterBuddy) return;
    setIsAddingRosterBuddy(true);
    setRosterProfileFeedback(null);
    try {
      const result = await sendOrAcceptBuddyRequest(currentUserId, userId);
      setRosterProfileFeedback(result.feedback);
      setRosterProfileStatus(result.status);
    } catch {
      setRosterProfileFeedback('Could not send buddy request right now.');
      setRosterProfileStatus('error');
    } finally {
      setIsAddingRosterBuddy(false);
    }
  }, [currentUserId, isAddingRosterBuddy]);

  useEffect(() => {
    scrollToLatestMessage();
  }, [messages, scrollToLatestMessage]);

  useEffect(() => {
    if (typeof window === 'undefined' || !isKeyboardOpen) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      scrollToLatestMessage();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [composerAreaHeight, isKeyboardOpen, scrollToLatestMessage, viewportHeight]);

  useEffect(() => {
    void clearUnreads(roomId);
  }, [clearUnreads, roomId]);

  // 30s last_seen_at heartbeat — final update fires on unmount
  useEffect(() => {
    const updateLastSeen = () => {
      void supabase
        .from('room_memberships')
        .update({ last_seen_at: new Date().toISOString() })
        .eq('room_id', roomId)
        .eq('user_id', currentUserId);
    };
    const intervalId = setInterval(updateLastSeen, 30_000);
    return () => {
      clearInterval(intervalId);
      updateLastSeen();
    };
  }, [currentUserId, roomId]);

  // Roster — initial load + 60s refresh to expire departed members
  useEffect(() => {
    void loadRoster();
    const intervalId = setInterval(() => void loadRoster(), 60_000);
    return () => clearInterval(intervalId);
  }, [loadRoster]);

  useEffect(() => {
    let isCancelled = false;

    const loadInitialMessages = async () => {
      setIsLoadingMessages(true);
      setError(null);

      let data: unknown = null;
      let messagesError: { message?: string | null; code?: string | null } | null = null;

      const initial = await supabase
        .from('room_messages')
        .select(ROOM_MESSAGE_SELECT_FIELDS)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(300);
      data = initial.data;
      messagesError = initial.error;

      if (isRoomMessageMetadataSchemaMissingError(messagesError)) {
        const fallback = await supabase
          .from('room_messages')
          .select(LEGACY_ROOM_MESSAGE_SELECT_FIELDS)
          .eq('room_id', roomId)
          .order('created_at', { ascending: true })
          .limit(300);
        data = fallback.data;
        messagesError = fallback.error;
      }

      if (isCancelled) {
        return;
      }

      if (messagesError) {
        setMessages([]);
        setError(messagesError.message ?? 'Failed to load messages.');
        setIsLoadingMessages(false);
        return;
      }

      const loadedMessages = (data ?? []) as RoomMessage[];
      setMessages(loadedMessages);
      setIsLoadingMessages(false);
      void ensureScreennames(loadedMessages.map((message) => message.user_id));
    };

    void loadInitialMessages();

    return () => {
      isCancelled = true;
    };
  }, [ensureScreennames, reloadToken, roomId]);

  useEffect(() => {
    const roomChannel = supabase.channel(`active_chat_room:${roomId}`, {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });
    roomChannelRef.current = roomChannel;

    roomChannel.on('presence', { event: 'sync' }, () => {
      const presenceState = roomChannel.presenceState() as Record<string, RoomPresenceMeta[]>;
      const presentUserIds = Object.keys(presenceState);
      void ensureScreennames(presentUserIds);

      const nextParticipants = presentUserIds
        .map((userId) => {
          const metas = presenceState[userId] ?? [];
          const latestMeta = metas[metas.length - 1] ?? {};
          const resolvedScreenname =
            (typeof latestMeta.screenname === 'string' && latestMeta.screenname.trim()) ||
            screennameMapRef.current[userId] ||
            (userId === currentUserId ? currentUserScreenname : 'Unknown User');

          return {
            userId,
            screenname: resolvedScreenname,
            onlineAt: typeof latestMeta.online_at === 'string' ? latestMeta.online_at : null,
          };
        })
        .sort((left, right) =>
          left.screenname.localeCompare(right.screenname, undefined, { sensitivity: 'base' }),
        );

      setParticipants(nextParticipants);
    });

    // Server-side filter removed — filtering client-side to avoid JWT evaluation issues
    // in Capacitor WebSocket connections.
    roomChannel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'room_messages' },
      (payload) => {
        const incoming = payload.new as RoomMessage;
        if (!incoming?.id || incoming.room_id !== roomId) {
          return;
        }
        setMessages((previous) =>
          previous.some((message) => message.id === incoming.id) ? previous : [...previous, incoming],
        );
        setHasLiveMessageSinceOpen(true);
        void clearUnreads(roomId);
        void ensureScreennames([incoming.user_id]);
      },
    );

    roomChannel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'room_messages' },
      (payload) => {
        const updated = payload.new as RoomMessage;
        if (!updated?.id || updated.room_id !== roomId) {
          return;
        }

        setMessages((previous) =>
          previous.map((message) => (message.id === updated.id ? { ...message, ...updated } : message)),
        );
      },
    );

    // Roster: refresh on membership changes (client-side room filter, same as messages)
    roomChannel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'room_memberships' },
      (payload) => {
        const row = payload.new as { room_id?: string; user_id?: string; last_seen_at?: string };
        if (row.room_id !== roomId) return;
        void loadRoster();
      },
    );
    roomChannel.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'room_memberships' },
      (payload) => {
        const row = payload.new as { room_id?: string; user_id?: string; last_seen_at?: string };
        if (row.room_id !== roomId || !row.user_id || !row.last_seen_at) return;
        setMemberLastSeenById((prev) =>
          prev[row.user_id!] === row.last_seen_at ? prev : { ...prev, [row.user_id!]: row.last_seen_at! },
        );
        const cutoff = new Date(Date.now() - 5 * 60 * 1000).toISOString();
        setRosterMembers((prev) => {
          const next = prev.filter((m) => m.user_id !== row.user_id);
          if (row.last_seen_at! >= cutoff) {
            next.push({ user_id: row.user_id!, last_seen_at: row.last_seen_at! });
            next.sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at));
          }
          return next;
        });
        void ensureScreennames([row.user_id]);
      },
    );
    roomChannel.on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'room_memberships' },
      (payload) => {
        const row = payload.old as { room_id?: string; user_id?: string };
        if (row.room_id !== roomId) return;
        setRosterMembers((prev) => prev.filter((m) => m.user_id !== row.user_id));
        setMemberLastSeenById((prev) => {
          if (!row.user_id || !(row.user_id in prev)) return prev;
          const next = { ...prev };
          delete next[row.user_id];
          return next;
        });
      },
    );

    roomChannel.on('broadcast', { event: 'typing' }, (event) => {
      const payload = event.payload as RoomTypingPayload;
      const typingUserId = typeof payload.userId === 'string' ? payload.userId : '';
      if (!typingUserId || typingUserId === currentUserId) {
        return;
      }

      const typingScreenname =
        (typeof payload.screenname === 'string' && payload.screenname.trim()) ||
        screennameMapRef.current[typingUserId] ||
        'Unknown User';

      setTypingMap((previous) => ({
        ...previous,
        [typingUserId]: typingScreenname,
      }));

      if (typingTimeoutsRef.current[typingUserId]) {
        clearTimeout(typingTimeoutsRef.current[typingUserId]);
      }

      typingTimeoutsRef.current[typingUserId] = setTimeout(() => {
        setTypingMap((previous) => {
          if (!(typingUserId in previous)) {
            return previous;
          }

          const next = { ...previous };
          delete next[typingUserId];
          return next;
        });
      }, 3500);
    });

    // Explicitly sync the user's JWT to the realtime WebSocket connection.
    // In Capacitor, the HTTP session and WebSocket session can diverge without this.
    roomChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          await supabase.realtime.setAuth(session.access_token);
        }
        void roomChannel.track({
          user_id: currentUserId,
          screenname: currentUserScreenname,
          online_at: new Date().toISOString(),
        });
      }
    });

    return () => {
      roomChannelRef.current = null;
      void roomChannel.untrack();
      roomChannel.unsubscribe();
      Object.values(typingTimeoutsRef.current).forEach((timeoutId) => clearTimeout(timeoutId));
      typingTimeoutsRef.current = {};
    };
  }, [clearUnreads, currentUserId, currentUserScreenname, ensureScreennames, loadRoster, roomId, roomName]);


  const sendRoomContent = useCallback(async (
    content: string,
    options: { applyFormatting: boolean } = { applyFormatting: false },
  ) => {
    const trimmed = content.trim();
    if (!trimmed) {
      return { ok: false as const, error: 'Type a message first.' };
    }
    if (isSending) {
      return { ok: false as const, error: 'A message is already sending.' };
    }

    setIsSending(true);
    setError(null);

    const formatted = options.applyFormatting ? formatRichText(trimmed, format) : trimmed;
    const clientMessageId = createClientMessageId();
    const { data, error: sendError } = await sendRoomMessageWithClientMessageId({
      roomId,
      userId: currentUserId,
      body: formatted,
      clientMessageId,
    });

    setIsSending(false);

    if (sendError) {
      const retryableNetworkError =
        Boolean(trimmed) &&
        ((typeof navigator !== 'undefined' && !navigator.onLine) ||
          /network|fetch|offline|timeout/i.test(sendError.message));
      if (retryableNetworkError) {
        const queued = onQueueRoomMessage?.({
          roomId,
          content: formatted,
          clientMessageId,
          errorMessage: sendError.message,
        }) ?? false;
        if (queued) {
          setError('Offline: message queued and will retry automatically.');
          return { ok: true as const };
        }
      } else {
        setError(sendError.message);
      }
      return { ok: false as const, error: sendError.message };
    }

    const insertedMessage = data as RoomMessage;
    setMessages((previous) =>
      previous.some((message) => message.id === insertedMessage.id)
        ? previous
        : [...previous, insertedMessage],
    );
    setHasLiveMessageSinceOpen(true);
    setMentioningMessageId(null);
    void hapticSuccess();
    return { ok: true as const };
  }, [currentUserId, format, isSending, onQueueRoomMessage, roomId]);

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await sendRoomContent(draft, { applyFormatting: true });
    if (!result.ok) {
      return;
    }

    setDraft('');
    onDraftChange?.('');
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        focusComposer();
      });
    }
  };

  const handleDraftKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
      return;
    }

    const textarea = event.currentTarget;
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      const selectionStart = textarea.selectionStart ?? textarea.value.length;
      const selectionEnd = textarea.selectionEnd ?? textarea.value.length;
      const nextDraft = `${draft.slice(0, selectionStart)}\n${draft.slice(selectionEnd)}`;
      setDraft(nextDraft);
      onDraftChange?.(nextDraft);
      window.requestAnimationFrame(() => {
        textarea.selectionStart = selectionStart + 1;
        textarea.selectionEnd = selectionStart + 1;
      });
      return;
    }

    event.preventDefault();
    if (isSending || !draft.trim()) {
      return;
    }

    textarea.form?.requestSubmit();
  };

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSentAtRef.current < 1200) {
      return;
    }
    lastTypingSentAtRef.current = now;

    const roomChannel = roomChannelRef.current;
    if (!roomChannel) {
      return;
    }

    void roomChannel.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId: currentUserId,
        screenname: currentUserScreenname,
      },
    });
  }, [currentUserId, currentUserScreenname]);

  const handleDraftChange = (nextValue: string) => {
    setDraft(nextValue);
    onDraftChange?.(nextValue);
    if (nextValue.trim()) {
      notifyTyping();
    }
  };


  const toggleBold = () => {
    setFormat((previous) => ({ ...previous, bold: !previous.bold }));
  };

  const toggleItalic = () => {
    setFormat((previous) => ({ ...previous, italic: !previous.italic }));
  };

  const toggleUnderline = () => {
    setFormat((previous) => ({ ...previous, underline: !previous.underline }));
  };

  const toggleComposerTools = () => {
    setShowComposerTools((previous) => {
      const next = !previous;
      if (next) {
        setShowFormatting(false);
      }
      return next;
    });
  };

  const toggleComposerFormatting = () => {
    setShowFormatting((previous) => {
      const next = !previous;
      if (next) {
        setShowComposerTools(false);
      }
      return next;
    });
  };

  const startMentioningMessage = (message: RoomMessage) => {
    const senderName = screennameMap[message.user_id] || 'Unknown User';
    const mentionPrefix = message.user_id === currentUserId ? '' : `@${senderName} `;

    setMentioningMessageId(message.id);
    if (mentionPrefix) {
      setDraft((previous) => {
        if (previous.trimStart().toLowerCase().startsWith(mentionPrefix.trim().toLowerCase())) {
          return previous;
        }
        const next = previous ? `${mentionPrefix}${previous}` : mentionPrefix;
        onDraftChange?.(next);
        return next;
      });
    }
    void hapticLight();
    window.requestAnimationFrame(() => {
      focusComposer();
    });
  };

  const cancelMentionComposerContext = () => {
    setMentioningMessageId(null);
  };


  const xpTinyToolbarButtonClass = (active = false) =>
    `ui-focus-ring inline-flex h-7 min-w-7 items-center justify-center rounded-lg border px-1.5 text-[length:var(--ui-text-xs)] font-semibold text-slate-700 transition ${
      active
        ? 'border-[#E8A23A]/40 bg-[#E8A23A]/10 text-[#E8A23A] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:border-[#E8A23A]/30 dark:bg-[#E8A23A]/15 dark:text-[#E8A23A]'
        : 'border-slate-200 bg-white/80 hover:bg-white dark:border-slate-700 dark:bg-[#0F1424]/65 dark:text-slate-200 dark:hover:bg-[#0F1424]'
    }`;

  const resolvedTypingUsers = useMemo(() => {
    const names = [
      ...Object.values(typingMap).filter(Boolean),
      ...typingUsers.filter(Boolean),
    ].filter((name) => name !== currentUserScreenname);
    return Array.from(new Set(names));
  }, [currentUserScreenname, typingMap, typingUsers]);

  const typingText = useMemo(() => {
    if (resolvedTypingUsers.length === 0) {
      return null;
    }
    if (resolvedTypingUsers.length === 1) {
      return `${resolvedTypingUsers[0]} is typing...`;
    }
    if (resolvedTypingUsers.length === 2) {
      return `${resolvedTypingUsers[0]}, ${resolvedTypingUsers[1]} are typing...`;
    }
    return `${resolvedTypingUsers[0]}, ${resolvedTypingUsers[1]} +${resolvedTypingUsers.length - 2} more typing...`;
  }, [resolvedTypingUsers]);

  useEffect(() => {
    if (!nativeBridgeRef) {
      return;
    }

    const bridge: NativeMilestoneOneRoomBridge = {
      sendMessage: (content) => sendRoomContent(content),
      sendTypingPulse: notifyTyping,
    };
    nativeBridgeRef.current = bridge;

    return () => {
      if (nativeBridgeRef.current === bridge) {
        nativeBridgeRef.current = null;
      }
    };
  }, [nativeBridgeRef, notifyTyping, sendRoomContent]);

  useEffect(() => {
    if (!onNativeStateChange) {
      return;
    }

    onNativeStateChange({
      roomId,
      roomName,
      activeCount: activeParticipantIds.size,
      messages: messages.map((message) => {
        const viewerIsAuthor = message.user_id === currentUserId;
        const effectiveBody = message.flagged_at && !viewerIsAuthor
          ? MESSAGE_HIDDEN_PLACEHOLDER
          : message.body;
        return {
          id: message.id,
          senderId: message.user_id,
          senderScreenname:
            screennameMap[message.user_id] ||
            (viewerIsAuthor ? currentUserScreenname : 'Unknown User'),
          content: htmlToPlainText(effectiveBody),
          createdAt: message.created_at,
          isMine: viewerIsAuthor,
        };
      }),
      isLoading: isLoadingMessages,
      isSending,
      typingText,
      error,
    });
  }, [
    activeParticipantIds.size,
    currentUserId,
    currentUserScreenname,
    error,
    isLoadingMessages,
    isSending,
    messages,
    onNativeStateChange,
    roomId,
    roomName,
    screennameMap,
    typingText,
  ]);

  const richTextPresentationByMessageId = useMemo(() => {
    const presentation = new Map<string, ReturnType<typeof getRichTextPresentation>>();
    for (const message of messages) {
      const viewerIsAuthor = message.user_id === currentUserId;
      const effectiveBody =
        message.flagged_at && !viewerIsAuthor
          ? MESSAGE_HIDDEN_PLACEHOLDER
          : message.body;
      presentation.set(message.id, getRichTextPresentation(effectiveBody));
    }
    return presentation;
  }, [messages, currentUserId]);
  const messagesById = useMemo(() => {
    return new Map(messages.map((message) => [message.id, message] as const));
  }, [messages]);
  const mentioningMessage = mentioningMessageId ? messagesById.get(mentioningMessageId) ?? null : null;
  const visibleOutboxItems = outboxItems;

  const normalizedInitialUnreadCount = Math.max(0, Math.floor(initialUnreadCount));
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const messageMatches = useMemo(() => {
    const matches = new Map<string, boolean>();
    if (!normalizedSearchQuery) {
      return matches;
    }

    for (const message of messages) {
      const plainText = htmlToPlainText(message.body).toLowerCase();
      matches.set(message.id, plainText.includes(normalizedSearchQuery));
    }

    return matches;
  }, [messages, normalizedSearchQuery]);
  const searchMatchCount = useMemo(
    () => Array.from(messageMatches.values()).filter(Boolean).length,
    [messageMatches],
  );
  const separatorIndex =
    !isLoadingMessages &&
    !hasLiveMessageSinceOpen &&
    normalizedInitialUnreadCount > 0 &&
    messages.length > 0
      ? Math.max(0, messages.length - normalizedInitialUnreadCount)
      : null;
  const chatShellStyle =
    isKeyboardOpen && viewportHeight ? ({ height: `${viewportHeight}px` } satisfies CSSProperties) : undefined;
  const messagesAreaStyle =
    composerAreaHeight > 0
      ? ({ scrollPaddingBottom: `${composerAreaHeight + 16}px` } satisfies CSSProperties)
      : undefined;
  const composerAreaStyle = {
    paddingBottom: isKeyboardOpen ? '0.75rem' : 'calc(env(safe-area-inset-bottom) + 0.75rem)',
  } satisfies CSSProperties;
  const composerToolsExpanded = showComposerTools;

  return (
    <div
      className={`fixed inset-0 z-50 ${isClosing ? 'chat-slide-out' : 'chat-slide-in'}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Room chat ${roomName}`}
      {...swipeBack}
    >
      <RetroWindow
        title={`#${roomName}`}
        variant="xp_shell"
        xpTitleText={`#${roomName}`}
        xpSubtitleText={`${rosterMembers.length} active`}
        headerActions={
          nativeShellActive ? undefined : (
            <>
              <button
                type="button"
                onClick={handleBack}
                className="ui-focus-ring ui-window-header-button px-2.5 text-[11px] font-semibold"
                aria-label={`Close room ${roomName}`}
                title="Close room"
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => setShowConversationMenu((previous) => !previous)}
                className="ui-focus-ring ui-window-header-button px-2.5 text-[11px] font-semibold"
                aria-expanded={showConversationMenu}
                aria-label={`Open room controls for ${roomName}`}
              >
                <AppIcon kind="menu" className="h-4 w-4" />
              </button>
            </>
          )
        }
        onXpClose={handleBack}
        onXpSignOff={onSignOff}
        style={chatShellStyle}
        hideHeader={nativeShellActive}
      >
        <div className="ui-window-panel flex h-full min-h-0 flex-col rounded-[1.4rem] text-[length:var(--ui-text-md)]">
          <div className="mx-3 mt-3 space-y-2.5">
            <div
              className="ui-conversation-header rounded-[1.25rem] px-3.5 py-3"
              role="region"
              aria-label={`${roomName} room header`}
            >
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex flex-1 items-center gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[rgba(232,162,58,0.18)] bg-[rgba(232,162,58,0.14)] text-[15px] font-bold text-[var(--gold)]">
                    #
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-semibold text-slate-800 dark:text-slate-100">
                        #{roomName}
                      </span>
                      <span className="text-[11px] font-semibold text-[var(--gold)]">
                        {rosterMembers.length} active
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-[12px] text-slate-500 dark:text-slate-400">
                      {participants.length === 0
                        ? 'No one else here yet.'
                        : participants
                            .map((participant) =>
                              participant.userId === currentUserId ? `${participant.screenname} (You)` : participant.screenname,
                            )
                            .join(', ')}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConversationMenu((previous) => !previous)}
                  className="ui-focus-ring ui-conversation-action shrink-0"
                  aria-expanded={showConversationMenu}
                  aria-label={`Open room controls for ${roomName}`}
                >
                  <AppIcon kind="menu" className="h-4 w-4" />
                </button>
              </div>
            </div>

            {showConversationMenu ? (
              <div className="ui-conversation-menu rounded-[1.25rem] px-3.5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="ui-section-kicker">Room controls</p>
                    <p className="mt-1 text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                      Search the room and manage participation.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowConversationMenu(false)}
                    className="ui-focus-ring ui-conversation-action"
                    aria-label="Close room controls"
                  >
                    <AppIcon kind="close" className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-3 space-y-3">
                  {/* Invite */}
                  {invitableBuddies.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowInviteSheet(true);
                        setSelectedInviteIds(new Set());
                        setInviteError(null);
                      }}
                      className="ui-focus-ring ui-button-secondary ui-button-compact flex w-full items-center gap-2"
                    >
                      <AppIcon kind="add" className="h-3.5 w-3.5 shrink-0 text-[var(--rose)]" />
                      <span className="font-mono text-[11px] uppercase tracking-[0.1em]">Invite a buddy</span>
                    </button>
                  ) : null}

                  {/* Members — roster driven by last_seen_at (5-min window) */}
                  <div className="rounded-[1rem] border border-white/60 bg-white/70 px-3 py-2 dark:border-slate-700 dark:bg-[#0F1424]/55">
                    <p className="ui-section-kicker">
                      Active now{rosterMembers.length > 0 ? ` · ${rosterMembers.length}` : ''}
                    </p>
                    <ul className="mt-2 space-y-0.5">
                      {isRosterInitialLoading ? (
                        <>
                          {[0, 1, 2].map((i) => (
                            <li key={i} className="flex items-center gap-2 px-1 py-1">
                              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-slate-200 dark:bg-slate-700" />
                              <div className="ui-skeleton h-3 rounded-full" style={{ width: `${48 + i * 16}%` }} />
                            </li>
                          ))}
                        </>
                      ) : (
                        <>
                          {rosterMembers.map((member) => {
                            const screenname = screennameMap[member.user_id] || 'Unknown User';
                            const isMe = member.user_id === currentUserId;
                            return (
                              <li key={member.user_id}>
                                {isMe ? (
                                  <div className="flex items-center gap-2 px-1 py-1">
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--green)]" aria-hidden="true" />
                                    <span className="truncate text-[12px] font-semibold text-slate-800 dark:text-slate-100">
                                      {screenname}
                                      <span className="ml-1 font-normal text-slate-400 dark:text-slate-500">(You)</span>
                                    </span>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => void openRosterProfile(member.user_id)}
                                    className="ui-focus-ring flex w-full items-center gap-2 rounded-xl px-1 py-1 text-left transition hover:bg-slate-100/60 active:scale-[0.98] dark:hover:bg-white/5"
                                  >
                                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--green)]" aria-hidden="true" />
                                    <span className="truncate text-[12px] font-semibold text-slate-800 dark:text-slate-100">
                                      {screenname}
                                    </span>
                                    <AppIcon kind="chevron" className="ml-auto h-3 w-3 shrink-0 rotate-[-90deg] text-slate-400" />
                                  </button>
                                )}
                              </li>
                            );
                          })}
                          {rosterMembers.length === 0 ? (
                            <li className="py-1 text-[12px] text-slate-400 dark:text-slate-500">No recent activity yet.</li>
                          ) : null}
                        </>
                      )}
                    </ul>
                  </div>
                  {/* Search */}
                  <div className="rounded-[1rem] border border-white/60 bg-white/70 px-3 py-2 dark:border-slate-700 dark:bg-[#0F1424]/55">
                    <label htmlFor={searchInputId} className="ui-section-kicker">Search</label>
                    <div className="mt-2 flex items-center gap-2">
                      <AppIcon kind="search" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <input
                        id={searchInputId}
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder={`Search #${roomName}`}
                        aria-describedby={normalizedSearchQuery ? searchResultsId : undefined}
                        className="ui-focus-ring min-w-0 flex-1 rounded-xl bg-transparent py-1 text-[12px] text-slate-700 placeholder-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                      />
                      {searchQuery ? (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="ui-focus-ring ui-conversation-action"
                          aria-label="Clear room search"
                        >
                          <AppIcon kind="close" className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </div>
                    {normalizedSearchQuery ? (
                      <p
                        id={searchResultsId}
                        role="status"
                        aria-live="polite"
                        className="mt-2 text-[11px] text-slate-400 dark:text-slate-500"
                      >
                        {searchMatchCount} {searchMatchCount === 1 ? 'match' : 'matches'}
                      </p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={onLeave}
                    className="ui-focus-ring ui-button-danger ui-button-compact"
                    aria-label={`Leave room ${roomName}`}
                    title="Leave room"
                  >
                    Leave room
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          {/* Invite buddy picker sheet */}
          {showInviteSheet ? (
            <div
              className="absolute inset-0 z-30 flex flex-col justify-end"
              role="dialog"
              aria-modal="true"
              aria-label="Invite buddies to room"
            >
              <button
                type="button"
                className="absolute inset-0 bg-black/40"
                onClick={() => setShowInviteSheet(false)}
                aria-label="Close invite sheet"
              />
              <div className="relative z-10 rounded-t-[1.75rem] bg-[var(--bg2)] px-4 pb-8 pt-5">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--rose)]">
                    Invite to #{roomName}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowInviteSheet(false)}
                    className="ui-focus-ring ui-conversation-action"
                    aria-label="Close"
                  >
                    <AppIcon kind="close" className="h-3.5 w-3.5" />
                  </button>
                </div>

                {invitableBuddies.length === 0 ? (
                  <p className="mt-4 text-center text-[13px] text-slate-400">
                    All your buddies are already in this room.
                  </p>
                ) : (
                  <ul className="mt-3 max-h-64 space-y-1 overflow-y-auto">
                    {invitableBuddies.map((buddy) => {
                      const selected = selectedInviteIds.has(buddy.id);
                      return (
                        <li key={buddy.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedInviteIds((prev) => {
                                const next = new Set(prev);
                                if (next.has(buddy.id)) {
                                  next.delete(buddy.id);
                                } else {
                                  next.add(buddy.id);
                                }
                                return next;
                              });
                            }}
                            className={`ui-focus-ring flex w-full items-center gap-3 rounded-[0.875rem] px-3 py-2.5 text-left transition active:scale-[0.98] ${
                              selected
                                ? 'bg-[var(--rose)]/15'
                                : 'bg-white/5 hover:bg-white/10'
                            }`}
                          >
                            <span
                              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
                                selected
                                  ? 'border-[var(--rose)] bg-[var(--rose)]'
                                  : 'border-slate-600'
                              }`}
                              aria-hidden="true"
                            >
                              {selected ? (
                                <AppIcon kind="check" className="h-2.5 w-2.5 text-white" />
                              ) : null}
                            </span>
                            <span className="truncate text-[13px] font-semibold text-slate-100">
                              {buddy.screenname}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {inviteError ? (
                  <p className="mt-2 text-[11px] text-red-400">{inviteError}</p>
                ) : null}

                {invitableBuddies.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => void handleInviteConfirm()}
                    disabled={selectedInviteIds.size === 0 || isInviting}
                    className="ui-focus-ring ui-button-primary ui-button-compact mt-4 w-full justify-center disabled:opacity-40"
                  >
                    {isInviting
                      ? 'Inviting…'
                      : selectedInviteIds.size === 0
                        ? 'Select buddies'
                        : `Invite ${selectedInviteIds.size} ${selectedInviteIds.size === 1 ? 'buddy' : 'buddies'}`}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {/* Roster profile sheet */}
          {rosterProfileId ? (
            <div
              className="absolute inset-0 z-30 flex flex-col justify-end"
              role="dialog"
              aria-modal="true"
              aria-label="Member profile"
            >
              <button
                type="button"
                className="absolute inset-0 bg-black/40"
                onClick={() => {
                  setRosterProfileId(null);
                  setRosterProfile(null);
                  setRosterProfileFeedback(null);
                  setRosterProfileStatus(null);
                }}
                aria-label="Close profile"
              />
              <div className="relative z-10 rounded-t-[1.75rem] bg-[var(--bg2)] px-4 pb-8 pt-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--rose)]">
                    Member
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setRosterProfileId(null);
                      setRosterProfile(null);
                      setRosterProfileFeedback(null);
                      setRosterProfileStatus(null);
                    }}
                    className="ui-focus-ring ui-conversation-action"
                    aria-label="Close profile"
                  >
                    <AppIcon kind="close" className="h-3.5 w-3.5" />
                  </button>
                </div>

                {isLoadingRosterProfile ? (
                  <div className="space-y-3 py-4">
                    <div className="ui-skeleton mx-auto h-5 w-32 rounded-full" />
                    <div className="ui-skeleton h-4 w-full rounded-full" />
                    <div className="ui-skeleton h-4 w-3/4 rounded-full" />
                  </div>
                ) : rosterProfile ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-[22px] font-bold text-slate-100">{rosterProfile.screenname}</p>
                      {rosterProfile.awayMessage ? (
                        <p className="mt-1 text-[13px] text-slate-400">&ldquo;{rosterProfile.awayMessage}&rdquo;</p>
                      ) : null}
                      {rosterProfile.bio ? (
                        <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{rosterProfile.bio}</p>
                      ) : null}
                    </div>
                    {rosterProfileFeedback ? (
                      <p className="text-[12px] font-semibold text-[var(--green)]">{rosterProfileFeedback}</p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void handleAddRosterBuddy(rosterProfile.id)}
                      disabled={isAddingRosterBuddy || rosterProfileStatus !== null}
                      className="ui-focus-ring ui-button-primary ui-button-compact w-full justify-center disabled:opacity-40"
                    >
                      {isAddingRosterBuddy
                        ? 'Sending…'
                        : rosterProfileStatus === 'already_accepted'
                          ? 'Already in H.I.M. contacts'
                          : rosterProfileStatus === 'already_sent'
                            ? 'Request Pending'
                            : rosterProfileStatus === 'sent' || rosterProfileStatus === 'accepted_incoming'
                              ? 'Request Sent'
                              : 'Add to Buddylist'}
                    </button>
                    {(onReportRoomMessage || onBlockRoomUser) ? (
                      <div className="flex items-center justify-center gap-4 pt-1">
                        {onReportRoomMessage ? (
                          <button
                            type="button"
                            onClick={() => {
                              onReportRoomMessage({
                                messageId: '',
                                senderId: rosterProfile.id,
                                senderScreenname: rosterProfile.screenname,
                                contentPreview: '',
                              });
                              setRosterProfileId(null);
                              setRosterProfile(null);
                              setRosterProfileFeedback(null);
                              setRosterProfileStatus(null);
                            }}
                            className="ui-focus-ring text-[13px] font-semibold text-red-400 hover:text-red-300"
                            aria-label={`Report ${rosterProfile.screenname}`}
                            data-testid="roster-report"
                          >
                            Report
                          </button>
                        ) : null}
                        {onBlockRoomUser ? (
                          <button
                            type="button"
                            onClick={() => {
                              onBlockRoomUser({
                                userId: rosterProfile.id,
                                screenname: rosterProfile.screenname,
                              });
                              setRosterProfileId(null);
                              setRosterProfile(null);
                              setRosterProfileFeedback(null);
                              setRosterProfileStatus(null);
                            }}
                            className="ui-focus-ring text-[13px] font-semibold text-red-400 hover:text-red-300"
                            aria-label={`Block ${rosterProfile.screenname}`}
                            data-testid="roster-block"
                          >
                            Block
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="py-4 text-center text-[13px] text-slate-400">Could not load profile.</p>
                )}
              </div>
            </div>
          ) : null}

          {/* Messages area */}
          <div
            id={messagesLogId}
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            aria-busy={isLoadingMessages}
            aria-label={`Conversation in room ${roomName}`}
            className="ui-chat-log ui-chat-wallpaper mx-3 mt-1.5 min-h-0 flex-1 overflow-y-auto rounded-2xl px-3 py-3"
            style={messagesAreaStyle}
          >
            {isLoadingMessages && (
              <div className="flex flex-col gap-3 pt-2 ui-fade-in">
                {[45, 70, 35, 60, 50, 80].map((widthPercent, i) => (
                  <div key={i} className={`flex ${i % 3 === 0 ? 'justify-end' : 'justify-start'}`}>
                    <div className="ui-skeleton h-9 rounded-2xl" style={{ width: `${widthPercent}%` }} />
                  </div>
                ))}
              </div>
            )}
            {!isLoadingMessages && messages.length === 0 && (
              <div className="ui-empty-state h-full px-6 ui-fade-in">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-50 dark:bg-violet-950/25">
                  <AppIcon kind="chat" className="h-7 w-7 text-violet-400 dark:text-violet-300" />
                </div>
                <div>
                  <p className="text-[length:var(--ui-text-md)] font-semibold text-slate-500">No messages yet</p>
                  <p className="mt-0.5 text-[length:var(--ui-text-xs)] text-slate-400">
                    Be the first to say something in this room
                  </p>
                </div>
              </div>
            )}
            {!isLoadingMessages && (
              <div
                className="flex flex-col gap-0.5"
                onClick={() => {
                  setShowConversationMenu(false);
                  setLongPressRoomMessageId(null);
                }}
              >
                {messages.map((message, index) => {
                  if (blockedUserIdSet.has(message.user_id)) {
                    return null;
                  }
                  const senderName = screennameMap[message.user_id] || 'Unknown User';
                  const isMine = message.user_id === currentUserId;
                  const isMatch = normalizedSearchQuery ? Boolean(messageMatches.get(message.id)) : false;
                  const senderColorClass = isMine ? 'text-[var(--rose)]' : getStableSenderColorClass(message.user_id);
                  const plainMessageText = htmlToPlainText(message.body).toLowerCase();
                  const isMentioningCurrentUser =
                    !isMine && plainMessageText.includes(`@${currentUserScreenname.trim().toLowerCase()}`);
                  const timestampDate = new Date(message.created_at);
                  const fullTimestamp = timestampDate.toLocaleString();
                  const fallbackBody =
                    message.flagged_at && message.user_id !== currentUserId
                      ? MESSAGE_HIDDEN_PLACEHOLDER
                      : message.body;
                  const richTextPresentation = richTextPresentationByMessageId.get(message.id) ?? {
                    html: sanitizeRichTextHtml(fallbackBody),
                    hasCustomStyling: false,
                  };
                  const hasCustomStyling = richTextPresentation.hasCustomStyling;
                  void relativeTimeTick;
                  const clusterMeta = getConversationClusterMeta(messages, index);
                  const dividerLabel = formatConversationDividerLabel(message.created_at);
                  const metaTimeLabel = formatConversationMetaTime(message.created_at);
                  const senderAvatar = !isMine ? (
                    clusterMeta.isFirstInRun ? (
                      <ProfileAvatar
                        screenname={senderName}
                        buddyIconPath={buddyIconMap[message.user_id] ?? null}
                        presenceState={activeParticipantIds.has(message.user_id) ? 'available' : null}
                        tone="slate"
                        size="sm"
                        className="mb-1"
                        showStatusDot={false}
                      />
                    ) : (
                      <div className="h-9 w-9" />
                    )
                  ) : null;

                  return (
                    <div key={message.id} className="flex flex-col">
                      {separatorIndex === index ? (
                        <p className="aim-new-messages-separator my-2">New messages</p>
                      ) : clusterMeta.showTimeDivider ? (
                        <div className="my-3 flex items-center justify-center">
                          <p className="ui-message-divider" title={fullTimestamp}>
                            {dividerLabel}
                          </p>
                        </div>
                      ) : null}

                      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${
                        normalizedSearchQuery && !isMatch ? 'opacity-35' : ''
                      } ${isMentioningCurrentUser && !normalizedSearchQuery ? 'opacity-100' : ''}`}>
                        <div className={`flex w-full items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                          {senderAvatar}
                          <SwipeActionFrame
                            align="start"
                            enabled={!isMine}
                            label="Mention"
                            onTrigger={() => startMentioningMessage(message)}
                            className="max-w-[82%]"
                          >
                            <div
                              className="group relative focus:outline-none"
                              tabIndex={0}
                              onTouchStart={() => {
                                if (isMine) return;
                                longPressRoomTimerRef.current = setTimeout(() => {
                                  void hapticLight();
                                  setLongPressRoomMessageId(message.id);
                                }, 500);
                              }}
                              onTouchEnd={() => {
                                if (longPressRoomTimerRef.current) {
                                  clearTimeout(longPressRoomTimerRef.current);
                                  longPressRoomTimerRef.current = null;
                                }
                              }}
                              onTouchMove={() => {
                                if (longPressRoomTimerRef.current) {
                                  clearTimeout(longPressRoomTimerRef.current);
                                  longPressRoomTimerRef.current = null;
                                }
                              }}
                              onContextMenu={(event) => {
                                if (isMine) return;
                                event.preventDefault();
                                setLongPressRoomMessageId(message.id);
                              }}
                            >
                              {!isMine && clusterMeta.isFirstInRun ? (
                                <div className="mb-1 flex items-center gap-2 px-1">
                                  <span className={`ui-screenname text-[11px] font-semibold ${senderColorClass}`}>
                                    {senderName}
                                  </span>
                                  <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                                    {metaTimeLabel}
                                  </span>
                                </div>
                              ) : null}

                              {isMentioningCurrentUser ? (
                                <div className="absolute -left-1 top-0 h-full w-0.5 rounded-full bg-amber-400" />
                              ) : null}

                              <div
                                className={`relative msg-enter px-3 py-2 ui-focus-ring ${
                                  hasCustomStyling
                                    ? 'text-[length:var(--ui-text-lg)] leading-[1.48]'
                                    : 'text-[length:var(--ui-text-md)] leading-[1.42]'
                                } ${
                                  clusterMeta.isLastInRun ? 'mb-2' : 'mb-0.5'
                                } ${
                                  isMine
                                    ? hasCustomStyling
                                      ? `rounded-[1.35rem] border border-blue-200/80 bg-white/96 text-slate-900 shadow-[0_10px_24px_rgba(232,162,58,0.16)] dark:border-slate-600/60 dark:bg-[#151A30]/95 dark:text-slate-100 ${clusterMeta.isLastInRun ? 'rounded-br-[8px] bubble-tail-out' : ''}`
                                      : `rounded-[1.35rem] bg-[#E8A23A]/22 text-white shadow-[0_8px_22px_rgba(232,162,58,0.26)] ${clusterMeta.isLastInRun ? 'rounded-br-[7px] bubble-tail-out' : ''}`
                                    : `rounded-[1.35rem] border border-white/70 bg-white/85 text-slate-800 shadow-sm backdrop-blur-sm dark:border-slate-700/70 dark:bg-[#0F1424]/70 dark:text-slate-100 ${clusterMeta.isLastInRun ? 'rounded-bl-[7px] bubble-tail-in' : ''} ${isMentioningCurrentUser ? 'border-amber-300/70 bg-amber-50/80 dark:border-amber-400/35 dark:bg-amber-950/25' : ''}`
                                } ${isMatch ? 'ring-2 ring-amber-400' : ''}`}
                              >
                                <span
                                  className={`aim-rich-html ${hasCustomStyling ? 'aim-rich-html--styled' : ''}`}
                                  dangerouslySetInnerHTML={{ __html: richTextPresentation.html }}
                                />
                              </div>

                              {isMine && message.id === lastOwnMessage?.id && lastOwnMessageSeenLabel ? (
                                <p className="mb-1.5 pr-1 text-right text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400">
                                  {lastOwnMessageSeenLabel}
                                </p>
                              ) : null}

                              <div
                                data-swipe-ignore="true"
                                className={`absolute bottom-full right-0 z-10 mb-2 min-w-[10rem] flex-col gap-1 rounded-2xl border border-white/70 bg-white/90 p-2 shadow-lg backdrop-blur-md dark:border-slate-700/70 dark:bg-[#0F1424]/88 ${
                                  longPressRoomMessageId === message.id
                                    ? 'flex'
                                    : 'hidden group-hover:flex group-focus-within:flex'
                                }`}
                              >
                                {!isMine ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      startMentioningMessage(message);
                                      setLongPressRoomMessageId(null);
                                    }}
                                    className="ui-focus-ring rounded-full px-2.5 py-1 text-[length:var(--ui-text-xs)] font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#0F1424]"
                                    aria-label={`Mention ${senderName}`}
                                  >
                                    Mention
                                  </button>
                                ) : null}
                                {!isMine && onReportRoomMessage ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onReportRoomMessage({
                                        messageId: message.id,
                                        senderId: message.user_id,
                                        senderScreenname: senderName,
                                        contentPreview: plainMessageText,
                                      });
                                      setLongPressRoomMessageId(null);
                                    }}
                                    className="ui-focus-ring rounded-full px-2.5 py-1 text-[length:var(--ui-text-xs)] font-semibold text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30"
                                    aria-label={`Report message from ${senderName}`}
                                    data-testid="room-message-report"
                                  >
                                    Report
                                  </button>
                                ) : null}
                                {!isMine && onBlockRoomUser ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onBlockRoomUser({
                                        userId: message.user_id,
                                        screenname: senderName,
                                      });
                                      setLongPressRoomMessageId(null);
                                    }}
                                    className="ui-focus-ring rounded-full px-2.5 py-1 text-[length:var(--ui-text-xs)] font-semibold text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30"
                                    aria-label={`Block ${senderName}`}
                                    data-testid="room-message-block"
                                  >
                                    Block sender
                                  </button>
                                ) : null}
                              </div>
                            </div>
                          </SwipeActionFrame>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {visibleOutboxItems.map((item) => {
                  const richTextPresentation = getRichTextPresentation(item.content);
                  const hasCustomStyling = richTextPresentation.hasCustomStyling;
                  const timestampDate = new Date(item.createdAt);
                  const fullTimestamp = timestampDate.toLocaleString();
                  const timestamp = timestampDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  const statusLabel =
                    item.status === 'sending' ? 'Sending' : item.status === 'failed' ? 'Failed' : 'Queued';
                  const statusToneClass =
                    item.status === 'failed'
                      ? 'text-red-600'
                      : item.status === 'queued'
                        ? 'text-amber-600'
                        : 'text-slate-400';
                  const bubbleToneClass =
                    item.status === 'failed'
                      ? 'border border-red-200/80 bg-red-50/90 text-red-950 shadow-[0_8px_24px_rgba(239,68,68,0.12)] dark:border-red-500/30 dark:bg-red-950/25 dark:text-red-200'
                      : item.status === 'queued'
                        ? 'border border-amber-200/80 bg-amber-50/90 text-amber-950 shadow-[0_8px_24px_rgba(245,158,11,0.12)] dark:border-amber-500/30 dark:bg-amber-950/25 dark:text-amber-200'
                        : 'bg-[#E8A23A]/75 text-white shadow-[0_2px_8px_rgba(232,162,58,0.28)]';

                  return (
                    <div key={`outbox-${item.id}`} className="flex flex-col">
                      <p
                        className="my-2 text-center text-[length:var(--ui-text-2xs)] text-slate-400"
                        title={fullTimestamp}
                      >
                        {timestamp}
                      </p>
                      <div className="flex justify-end">
                        <div className="max-w-[78%]">
                          <div
                            className={`relative rounded-2xl rounded-br-[6px] px-3 py-2 ${
                              hasCustomStyling
                                ? 'text-[length:var(--ui-text-lg)] leading-[1.48]'
                                : 'text-[length:var(--ui-text-md)] leading-[1.42]'
                            } ${bubbleToneClass}`}
                          >
                            <span
                              className={`aim-rich-html ${hasCustomStyling ? 'aim-rich-html--styled' : ''}`}
                              dangerouslySetInnerHTML={{ __html: richTextPresentation.html }}
                            />
                          </div>
                          <div className="mt-1 flex flex-wrap items-center justify-end gap-2">
                            <span className={`text-[length:var(--ui-text-2xs)] font-semibold ${statusToneClass}`}>
                              {statusLabel}
                            </span>
                            {item.lastError ? (
                              <span
                                className="max-w-[12rem] truncate text-[length:var(--ui-text-2xs)] text-slate-400"
                                title={item.lastError}
                              >
                                {item.lastError}
                              </span>
                            ) : null}
                            {item.status !== 'sending' && onRetryOutboxMessage ? (
                              <button
                                type="button"
                                onClick={() => onRetryOutboxMessage(item.id)}
                                className="ui-focus-ring ui-button-secondary ui-button-compact rounded-full px-2 py-1 text-[length:var(--ui-text-2xs)]"
                                aria-label="Retry message"
                              >
                                Retry
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {error ? (
            <p role="alert" className="mx-3 mt-1 text-[length:var(--ui-text-2xs)] text-red-600">
              {error}
            </p>
          ) : null}

          {/* Typing indicator — ghost bubble */}
          {typingText ? (
            <div className="msg-enter mx-3 mt-1.5 flex items-end gap-2" role="status" aria-live="polite" aria-atomic="true">
              <div className="flex flex-col items-start gap-0.5">
                <div className="ui-panel-card flex items-center gap-1 rounded-2xl rounded-bl-sm px-4 py-3">
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
                </div>
                <span className="px-1 text-[length:var(--ui-text-2xs)] text-slate-400">{typingText}</span>
              </div>
            </div>
          ) : null}

          {/* Input area */}
          <div ref={composerAreaRef} className="mx-3 mt-2 space-y-2.5" style={composerAreaStyle}>
            {mentioningMessage ? (
              <div className="ui-compose-context-chip flex items-start justify-between gap-3 rounded-2xl px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[length:var(--ui-text-2xs)] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Mentioning {screennameMap[mentioningMessage.user_id] || 'Unknown User'}
                  </p>
                  <p className="truncate text-[length:var(--ui-text-xs)] text-slate-600 dark:text-slate-200">
                    {htmlToPlainText(mentioningMessage.body).trim() || 'Original message'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cancelMentionComposerContext}
                  className="ui-focus-ring rounded-full p-1 text-slate-400 hover:text-slate-600"
                  aria-label="Cancel mention context"
                >
                  <AppIcon kind="close" className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {!isComposerFocused ? (
                  <button
                    type="button"
                    onClick={focusComposer}
                    className={`${xpTinyToolbarButtonClass()} px-2.5`}
                    aria-label={`Reopen the keyboard in room ${roomName}`}
                    title="Keyboard"
                  >
                    Keyboard
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={toggleComposerTools}
                  className={`${xpTinyToolbarButtonClass(composerToolsExpanded)} px-2.5`}
                  aria-expanded={composerToolsExpanded}
                  aria-label={composerToolsExpanded ? 'Hide message tools' : 'Show message tools'}
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={toggleComposerFormatting}
                  className={`${xpTinyToolbarButtonClass(showFormatting || hasCustomFormatting)} px-2.5`}
                  aria-label={showFormatting ? 'Hide formatting toolbar' : 'Show formatting toolbar'}
                  aria-expanded={showFormatting}
                >
                  <span className="inline-flex items-center gap-1">
                    <span>Style</span>
                    {hasCustomFormatting ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
                  </span>
                </button>
              </div>
              <div className="flex items-center gap-2">
                {normalizedSearchQuery ? (
                  <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                    {searchMatchCount} result{searchMatchCount === 1 ? '' : 's'}
                  </span>
                ) : null}
              </div>
            </div>

            {(composerToolsExpanded || showFormatting) ? (
              <div className="ui-toolbar-surface space-y-3 rounded-2xl px-3 py-3">
                {showFormatting ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Text style
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={toggleBold}
                        className={`${xpTinyToolbarButtonClass(format.bold)} h-8 gap-1 px-3`}
                        aria-label="Toggle bold"
                        aria-pressed={format.bold}
                      >
                        <span className="font-bold">B</span>
                        <span>Bold</span>
                      </button>
                      <button
                        type="button"
                        onClick={toggleItalic}
                        className={`${xpTinyToolbarButtonClass(format.italic)} h-8 gap-1 px-3`}
                        aria-label="Toggle italic"
                        aria-pressed={format.italic}
                      >
                        <span className="italic">I</span>
                        <span>Italic</span>
                      </button>
                      <button
                        type="button"
                        onClick={toggleUnderline}
                        className={`${xpTinyToolbarButtonClass(format.underline)} h-8 gap-1 px-3`}
                        aria-label="Toggle underline"
                        aria-pressed={format.underline}
                      >
                        <span className="underline">U</span>
                        <span>Underline</span>
                      </button>
                    </div>
                    <RichTextToolbar value={format} onChange={setFormat} />
                  </div>
                ) : null}

              </div>
            ) : null}

            {/* Pill compose input */}
            <p id={composerHelpId} className="sr-only">
              Press Enter to send. Press Command or Control plus Enter to insert a line break.
            </p>
            <form
              onSubmit={handleSendMessage}
              className="ui-compose-surface flex items-end gap-2 rounded-2xl px-3.5 py-2.5"
            >
              <label htmlFor={composerInputId} className="sr-only">
                Message room {roomName}
              </label>
              <textarea
                id={composerInputId}
                ref={composerRef}
                value={draft}
                onChange={(event) => handleDraftChange(event.target.value)}
                onKeyDown={handleDraftKeyDown}
                onFocus={() => {
                  setIsComposerFocused(true);
                }}
                onBlur={() => {
                  setIsComposerFocused(false);
                }}
                placeholder={mentioningMessage ? `Reply in #${roomName}…` : `Message #${roomName}…`}
                rows={1}
                maxLength={1500}
                aria-describedby={composerHelpId}
                className="min-h-[24px] flex-1 resize-none rounded-xl bg-transparent text-[length:var(--ui-text-md)] text-white placeholder-[#6B5B4E] focus:outline-none focus:border-[#E8A23A]"
                style={composerTextStyle}
              />
              {draft.trim() ? (
                <button
                  type="submit"
                  disabled={isSending}
                  className="ui-focus-ring ui-button-primary mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-0 text-[length:var(--ui-text-md)] font-bold disabled:opacity-60"
                  aria-label={`Send message to room ${roomName}`}
                >
                  {isSending ? '…' : '↑'}
                </button>
              ) : null}
            </form>
          </div>
        </div>
      </RetroWindow>
    </div>
  );
}
