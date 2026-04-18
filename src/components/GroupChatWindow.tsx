'use client';

import { FormEvent, KeyboardEvent, type CSSProperties, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import AppIcon from '@/components/AppIcon';
import { MessageReactionPicker, MessageReactionStrip } from '@/components/MessageReactions';
import ProfileAvatar from '@/components/ProfileAvatar';
import RetroWindow from '@/components/RetroWindow';
import RichTextToolbar from '@/components/RichTextToolbar';
import SwipeActionFrame from '@/components/SwipeActionFrame';
import type { OutboxItem } from '@/lib/outbox';
import { getJSON, setJSON } from '@/lib/clientStorage';
import {
  CHAT_MEDIA_MAX_ATTACHMENTS,
  type ChatMediaAttachmentRecord,
  formatFileSize,
  uploadChatMediaFile,
  validateChatMediaFile,
} from '@/lib/chatMedia';
import { hapticLight, hapticSuccess, hapticWarning } from '@/lib/haptics';
import { useKeyboardViewport } from '@/hooks/useKeyboardViewport';
import { useSwipeBack } from '@/hooks/useSwipeBack';
import {
  formatConversationDividerLabel,
  formatConversationMetaTime,
  getConversationClusterMeta,
} from '@/lib/conversationPresentation';
import { buildReactionMutationKey, summarizeReactionRows } from '@/lib/messageReactions';
import { isNativeIosShell } from '@/lib/nativeShell';
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
import {
  EXTENDED_ROOM_PROFILE_SELECT_FIELDS,
  isProfileSchemaMissingError,
  LEGACY_ROOM_PROFILE_SELECT_FIELDS,
  withProfileSchemaDefaultsList,
} from '@/lib/profileSchema';
import { useChatContext } from '@/context/ChatContext';
import { createClientMessageId } from '@/lib/outbox';
import {
  ROOM_MESSAGE_SELECT_FIELDS,
  sendRoomMessageWithClientMessageId,
} from '@/lib/messageIdempotency';

interface RoomMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  client_msg_id?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
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

interface RoomMessageReactionRow {
  message_id: string;
  user_id: string;
  emoji: string;
}

interface RoomMessageAttachmentRow extends ChatMediaAttachmentRecord {
  message_id: string;
}

interface BuddyStub {
  id: string;
  screenname: string;
}

interface GroupChatWindowProps {
  roomId: string;
  roomName: string;
  roomKey?: string | null;
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
  }) => void;
  onRetryOutboxMessage?: (itemId: string) => void;
  inviteCode?: string | null;
  buddies?: BuddyStub[];
  onBack: () => void;
  onLeave: () => void;
  onSignOff?: () => void;
  reloadToken?: number;
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
  roomKey = null,
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
  inviteCode = null,
  buddies = [],
  onBack,
  onLeave,
  onSignOff,
  reloadToken = 0,
}: GroupChatWindowProps) {
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
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [showComposerTools, setShowComposerTools] = useState(false);
  const [mentioningMessageId, setMentioningMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeletingMessageId, setIsDeletingMessageId] = useState<string | null>(null);
  const [longPressMessageId, setLongPressMessageId] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reactionRows, setReactionRows] = useState<RoomMessageReactionRow[]>([]);
  const [pendingReactionKeys, setPendingReactionKeys] = useState<Set<string>>(() => new Set());
  const [attachmentRows, setAttachmentRows] = useState<RoomMessageAttachmentRow[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [reactionError, setReactionError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentLoadError, setAttachmentLoadError] = useState<string | null>(null);
  const [composerAreaHeight, setComposerAreaHeight] = useState(0);
  const [isComposerFocused, setIsComposerFocused] = useState(false);
  const [enableSupplementalRealtime, setEnableSupplementalRealtime] = useState(false);

  const [isClosing, setIsClosing] = useState(false);
  const [relativeTimeTick, setRelativeTimeTick] = useState(0);

  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [selectedInviteIds, setSelectedInviteIds] = useState<Set<string>>(() => new Set());
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const seenReactionKeysRef = useRef(new Set<string>());
  const [newReactionKeys, setNewReactionKeys] = useState<Set<string>>(() => new Set());

  const handleBack = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => onBack(), 190);
  }, [onBack]);

  const invitableBuddies = useMemo(() => {
    const memberIds = new Set(participants.map((p) => p.userId));
    return buddies.filter((b) => !memberIds.has(b.id));
  }, [buddies, participants]);

  const handleInviteConfirm = useCallback(async () => {
    if (selectedInviteIds.size === 0 || isInviting || !roomKey) return;
    setIsInviting(true);
    setInviteError(null);
    try {
      const inviteeIds = Array.from(selectedInviteIds);
      const results = await Promise.allSettled(
        inviteeIds.map((id) =>
          supabase.rpc('invite_to_room', {
            p_room_key: roomKey,
            p_invitee_id: id,
          }),
        ),
      );

      const failures = results.filter(
        (r) => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.error),
      );

      if (failures.length > 0) {
        const firstError = failures[0];
        const message =
          firstError.status === 'rejected'
            ? String(firstError.reason)
            : firstError.value.error!.message;
        if (import.meta.env.DEV) {
          console.error('[invite_to_room] RPC error:', message);
        }
        setInviteError(`Could not invite ${failures.length} buddy${failures.length > 1 ? 'ies' : ''}. ${message}`);
        return;
      }

      const invitedIds = inviteeIds.filter((_, i) => results[i].status === 'fulfilled');
      // Optimistically add invited buddies to the participants list.
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
      const message = err instanceof Error ? err.message : 'Unknown error';
      if (import.meta.env.DEV) {
        console.error('[invite_to_room] Unexpected error:', message);
      }
      setInviteError(`Invite failed: ${message}`);
    } finally {
      setIsInviting(false);
    }
  }, [buddies, isInviting, roomKey, selectedInviteIds]);

  const swipeBack = useSwipeBack({ onSwipeBack: handleBack });
  const [isSending, setIsSending] = useState(false);
  const [hasLiveMessageSinceOpen, setHasLiveMessageSinceOpen] = useState(false);
  const [typingMap, setTypingMap] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
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
    if (typeof window === 'undefined') {
      return;
    }

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let idleCallbackId: number | null = null;

    const enableRealtime = () => {
      setEnableSupplementalRealtime(true);
    };

    if ('requestIdleCallback' in window) {
      idleCallbackId = window.requestIdleCallback(enableRealtime, { timeout: 350 });
    } else {
      timeoutId = setTimeout(enableRealtime, 180);
    }

    return () => {
      if (idleCallbackId !== null && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleCallbackId);
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, []);

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

  useEffect(() => {
    const messageIds = messages.map((message) => message.id);
    if (messageIds.length === 0) {
      setReactionRows([]);
      return;
    }

    let isCancelled = false;

    const loadReactions = async () => {
      const { data, error } = await supabase
        .from('room_message_reactions')
        .select('message_id,user_id,emoji')
        .in('message_id', messageIds);

      if (isCancelled) {
        return;
      }

      if (error) {
        setReactionError(error.message);
        return;
      }

      setReactionError(null);
      setReactionRows((data ?? []) as RoomMessageReactionRow[]);
    };

    void loadReactions();

    return () => {
      isCancelled = true;
    };
  }, [messages]);

  useEffect(() => {
    if (!enableSupplementalRealtime) {
      return;
    }

    const messageIdSet = new Set(messages.map((message) => message.id));
    if (messageIdSet.size === 0) {
      return;
    }

    const channel = supabase
      .channel(`room_message_reactions:${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_message_reactions' }, (payload) => {
        const incoming = payload.new as RoomMessageReactionRow;
        if (!messageIdSet.has(incoming.message_id)) {
          return;
        }

        setReactionRows((previous) =>
          previous.some(
            (row) =>
              row.message_id === incoming.message_id && row.user_id === incoming.user_id && row.emoji === incoming.emoji,
          )
            ? previous
            : [...previous, incoming],
        );
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'room_message_reactions' }, (payload) => {
        const deleted = payload.old as RoomMessageReactionRow;
        if (!messageIdSet.has(deleted.message_id)) {
          return;
        }

        setReactionRows((previous) =>
          previous.filter(
            (row) =>
              !(
                row.message_id === deleted.message_id &&
                row.user_id === deleted.user_id &&
                row.emoji === deleted.emoji
              ),
          ),
        );
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enableSupplementalRealtime, messages, roomId]);

  useEffect(() => {
    const messageIds = messages.map((message) => message.id);
    if (messageIds.length === 0) {
      setAttachmentRows([]);
      return;
    }

    let isCancelled = false;
    const loadAttachments = async () => {
      const { data, error } = await supabase
        .from('room_message_attachments')
        .select('id,message_id,bucket,storage_path,file_name,mime_type,size_bytes')
        .in('message_id', messageIds)
        .order('created_at', { ascending: true });

      if (isCancelled) {
        return;
      }

      if (error) {
        setAttachmentLoadError(error.message);
        return;
      }

      setAttachmentLoadError(null);
      setAttachmentRows((data ?? []) as RoomMessageAttachmentRow[]);
    };

    void loadAttachments();
    return () => {
      isCancelled = true;
    };
  }, [messages]);

  useEffect(() => {
    if (!enableSupplementalRealtime) {
      return;
    }

    const messageIdSet = new Set(messages.map((message) => message.id));
    if (messageIdSet.size === 0) {
      return;
    }

    const channel = supabase
      .channel(`room_message_attachments:${roomId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'room_message_attachments' }, (payload) => {
        const incoming = payload.new as RoomMessageAttachmentRow;
        if (!messageIdSet.has(incoming.message_id)) {
          return;
        }
        setAttachmentRows((previous) =>
          previous.some((attachment) => attachment.id === incoming.id) ? previous : [...previous, incoming],
        );
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'room_message_attachments' }, (payload) => {
        const deleted = payload.old as { id?: string };
        if (typeof deleted.id !== 'string') {
          return;
        }
        setAttachmentRows((previous) => previous.filter((attachment) => attachment.id !== deleted.id));
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enableSupplementalRealtime, messages, roomId]);

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
    void clearUnreads(roomName);
  }, [clearUnreads, roomName]);

  useEffect(() => {
    let isCancelled = false;

    const loadInitialMessages = async () => {
      setIsLoadingMessages(true);
      setError(null);

      const { data, error: messagesError } = await supabase
        .from('room_messages')
        .select(ROOM_MESSAGE_SELECT_FIELDS)
        .eq('room_id', roomId)
        .order('created_at', { ascending: true })
        .limit(300);

      if (isCancelled) {
        return;
      }

      if (messagesError) {
        setMessages([]);
        setError(messagesError.message);
        setIsLoadingMessages(false);
        return;
      }

      const loadedMessages = (data ?? []) as RoomMessage[];
      setMessages(loadedMessages);
      setIsLoadingMessages(false);
      void ensureScreennames(loadedMessages.map((message) => message.sender_id));
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
        void clearUnreads(roomName);
        void ensureScreennames([incoming.sender_id]);
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
  }, [clearUnreads, currentUserId, currentUserScreenname, ensureScreennames, roomId, roomName]);

  const clearPendingAttachments = useCallback(() => {
    setPendingAttachments([]);
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = '';
    }
  }, []);

  const handleSelectAttachments = (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const selected = Array.from(files);
    const validationError = selected.map((file) => validateChatMediaFile(file)).find(Boolean);
    if (validationError) {
      setAttachmentError(validationError);
      return;
    }

    setAttachmentError(null);
    setShowComposerTools(true);
    setPendingAttachments((previous) => {
      const existingKeys = new Set(previous.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
      const combined = [...previous];
      for (const file of selected) {
        const key = `${file.name}:${file.size}:${file.lastModified}`;
        if (!existingKeys.has(key)) {
          combined.push(file);
          existingKeys.add(key);
        }
      }
      if (combined.length > CHAT_MEDIA_MAX_ATTACHMENTS) {
        setAttachmentError(`Max ${CHAT_MEDIA_MAX_ATTACHMENTS} attachments per message.`);
      }
      return combined.slice(0, CHAT_MEDIA_MAX_ATTACHMENTS);
    });
  };

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if ((!trimmed && pendingAttachments.length === 0) || isSending) {
      return;
    }

    setIsSending(true);
    setError(null);

    const formatted = trimmed
      ? formatRichText(trimmed, format)
      : pendingAttachments.length === 1
        ? 'Sent an attachment.'
        : 'Sent attachments.';
    const clientMessageId = createClientMessageId();
    const { data, error: sendError } = await sendRoomMessageWithClientMessageId({
      roomId,
      senderId: currentUserId,
      content: formatted,
      clientMessageId,
    });

    setIsSending(false);

    if (sendError) {
      const retryableNetworkError =
        pendingAttachments.length === 0 &&
        Boolean(trimmed) &&
        ((typeof navigator !== 'undefined' && !navigator.onLine) ||
          /network|fetch|offline|timeout/i.test(sendError.message));
      if (retryableNetworkError) {
        onQueueRoomMessage?.({
          roomId,
          content: formatted,
          clientMessageId,
          errorMessage: sendError.message,
        });
        setDraft('');
        onDraftChange?.('');
        setError('Offline: message queued and will retry automatically.');
      } else {
        setError(sendError.message);
      }
      return;
    }

    const insertedMessage = data as RoomMessage;
    if (pendingAttachments.length > 0) {
      const attachmentRowsToInsert: Array<{
        message_id: string;
        uploader_id: string;
        bucket: string;
        storage_path: string;
        file_name: string;
        mime_type: string;
        size_bytes: number;
      }> = [];

      for (const file of pendingAttachments) {
        try {
          const uploaded = await uploadChatMediaFile({ userId: currentUserId, file });
          attachmentRowsToInsert.push({
            message_id: insertedMessage.id,
            uploader_id: currentUserId,
            bucket: uploaded.bucket,
            storage_path: uploaded.storagePath,
            file_name: uploaded.fileName,
            mime_type: uploaded.mimeType,
            size_bytes: uploaded.sizeBytes,
          });
        } catch (uploadError) {
          const message =
            uploadError instanceof Error ? uploadError.message : 'Attachment upload failed.';
          setError(message);
        }
      }

      if (attachmentRowsToInsert.length > 0) {
        const { error: attachmentInsertError } = await supabase
          .from('room_message_attachments')
          .insert(attachmentRowsToInsert);
        if (attachmentInsertError) {
          setError(attachmentInsertError.message);
        }
      }
    }

    setMessages((previous) =>
      previous.some((message) => message.id === insertedMessage.id)
        ? previous
        : [...previous, insertedMessage],
    );
    setHasLiveMessageSinceOpen(true);
    setMentioningMessageId(null);
    setDraft('');
    onDraftChange?.('');
    clearPendingAttachments();
    setAttachmentError(null);
    if (typeof window !== 'undefined') {
      window.requestAnimationFrame(() => {
        focusComposer();
      });
    }
    void hapticSuccess();
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
    if (isSending || (!draft.trim() && pendingAttachments.length === 0)) {
      return;
    }

    textarea.form?.requestSubmit();
  };

  const notifyTyping = () => {
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
  };

  const handleDraftChange = (nextValue: string) => {
    setDraft(nextValue);
    onDraftChange?.(nextValue);
    if (nextValue.trim()) {
      notifyTyping();
    }
  };

  const removePendingAttachment = (targetIndex: number) => {
    setPendingAttachments((previous) => {
      const next = previous.filter((_, index) => index !== targetIndex);
      if (next.length === 0 && attachmentInputRef.current) {
        attachmentInputRef.current.value = '';
      }
      return next;
    });
  };

  const startEditingMessage = (message: RoomMessage) => {
    if (message.sender_id !== currentUserId || message.deleted_at) {
      return;
    }

    setEditingMessageId(message.id);
    setEditDraft(htmlToPlainText(message.content));
  };

  const cancelEditingMessage = () => {
    setEditingMessageId(null);
    setEditDraft('');
  };

  const saveEditedMessage = async (messageId: string) => {
    const trimmed = editDraft.trim();
    if (!trimmed || isSavingEdit) {
      return;
    }

    setIsSavingEdit(true);
    const updatedContent = formatRichText(trimmed, DEFAULT_RICH_TEXT_FORMAT);
    const { error } = await supabase
      .from('room_messages')
      .update({
        content: updatedContent,
        edited_at: new Date().toISOString(),
      })
      .eq('id', messageId)
      .eq('sender_id', currentUserId);

    setIsSavingEdit(false);
    if (error) {
      return;
    }

    cancelEditingMessage();
  };

  const softDeleteMessage = async (messageId: string) => {
    if (isDeletingMessageId === messageId) {
      return;
    }

    setIsDeletingMessageId(messageId);
    const { error } = await supabase
      .from('room_messages')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: currentUserId,
      })
      .eq('id', messageId)
      .eq('sender_id', currentUserId);
    setIsDeletingMessageId(null);

    if (error) {
      return;
    }

    if (editingMessageId === messageId) {
      cancelEditingMessage();
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
      if (next && pendingAttachments.length === 0) {
        setShowComposerTools(false);
      }
      return next;
    });
  };

  const startMentioningMessage = (message: RoomMessage) => {
    if (message.deleted_at) {
      return;
    }

    const senderName = screennameMap[message.sender_id] || 'Unknown User';
    const mentionPrefix = message.sender_id === currentUserId ? '' : `@${senderName} `;

    setMentioningMessageId(message.id);
    setLongPressMessageId(null);
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

  const toggleReaction = useCallback(
    async (messageId: string, emoji: string) => {
      const mutationKey = buildReactionMutationKey(messageId, emoji);
      if (pendingReactionKeys.has(mutationKey)) {
        return;
      }

      const hasExistingReaction = reactionRows.some(
        (row) => row.message_id === messageId && row.user_id === currentUserId && row.emoji === emoji,
      );

      setPendingReactionKeys((previous) => {
        const next = new Set(previous);
        next.add(mutationKey);
        return next;
      });
      setReactionError(null);
      setLongPressMessageId(null);
      setReactionRows((previous) =>
        hasExistingReaction
          ? previous.filter(
              (row) => !(row.message_id === messageId && row.user_id === currentUserId && row.emoji === emoji),
            )
          : [...previous, { message_id: messageId, user_id: currentUserId, emoji }],
      );
      void hapticLight();

      const { error } = hasExistingReaction
        ? await supabase
            .from('room_message_reactions')
            .delete()
            .eq('message_id', messageId)
            .eq('user_id', currentUserId)
            .eq('emoji', emoji)
        : await supabase.from('room_message_reactions').insert({
            message_id: messageId,
            user_id: currentUserId,
            emoji,
          });

      setPendingReactionKeys((previous) => {
        const next = new Set(previous);
        next.delete(mutationKey);
        return next;
      });

      if (!error) {
        return;
      }

      setReactionRows((previous) =>
        hasExistingReaction
          ? [...previous, { message_id: messageId, user_id: currentUserId, emoji }]
          : previous.filter(
              (row) => !(row.message_id === messageId && row.user_id === currentUserId && row.emoji === emoji),
            ),
      );
      setReactionError(error.message);
      void hapticWarning();
    },
    [currentUserId, pendingReactionKeys, reactionRows],
  );

  const xpTinyToolbarButtonClass = (active = false) =>
    `ui-focus-ring inline-flex h-7 min-w-7 items-center justify-center rounded-lg border px-1.5 text-[length:var(--ui-text-xs)] font-semibold text-slate-700 transition ${
      active
        ? 'border-[#E8608A]/40 bg-[#E8608A]/10 text-[#E8608A] shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:border-[#E8608A]/30 dark:bg-[#E8608A]/15 dark:text-[#E8608A]'
        : 'border-slate-200 bg-white/80 hover:bg-white dark:border-slate-700 dark:bg-[#13100E]/65 dark:text-slate-200 dark:hover:bg-[#13100E]'
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

  const reactionSummaryByMessageId = useMemo(
    () => summarizeReactionRows(reactionRows, currentUserId),
    [currentUserId, reactionRows],
  );

  useEffect(() => {
    const seenReactionKeys = seenReactionKeysRef.current;
    const newlyDiscoveredKeys: string[] = [];

    for (const [messageId, entries] of reactionSummaryByMessageId) {
      for (const entry of entries) {
        const emoji = entry.emoji;
        const reactionKey = `${messageId}-${emoji}`;
        if (!seenReactionKeys.has(reactionKey)) {
          seenReactionKeys.add(reactionKey);
          newlyDiscoveredKeys.push(reactionKey);
        }
      }
    }

    if (newlyDiscoveredKeys.length === 0) {
      return;
    }

    setNewReactionKeys((previous) => {
      const next = new Set(previous);
      newlyDiscoveredKeys.forEach((key) => next.add(key));
      return next;
    });

    const clearTimer = setTimeout(() => {
      setNewReactionKeys((previous) => {
        const next = new Set(previous);
        newlyDiscoveredKeys.forEach((key) => next.delete(key));
        return next;
      });
    }, 950);

    return () => clearTimeout(clearTimer);
  }, [reactionSummaryByMessageId]);

  const attachmentsByMessageId = useMemo(() => {
    const grouped = new Map<string, RoomMessageAttachmentRow[]>();
    for (const attachment of attachmentRows) {
      const existing = grouped.get(attachment.message_id) ?? [];
      existing.push(attachment);
      grouped.set(attachment.message_id, existing);
    }
    return grouped;
  }, [attachmentRows]);
  const richTextPresentationByMessageId = useMemo(() => {
    const presentation = new Map<string, ReturnType<typeof getRichTextPresentation>>();
    for (const message of messages) {
      presentation.set(message.id, getRichTextPresentation(message.content));
    }
    return presentation;
  }, [messages]);
  const messagesById = useMemo(() => {
    return new Map(messages.map((message) => [message.id, message] as const));
  }, [messages]);
  const mentioningMessage = mentioningMessageId ? messagesById.get(mentioningMessageId) ?? null : null;
  const visibleOutboxItems = useMemo(() => {
    const deliveredClientIds = new Set(
      messages
        .map((message) => message.client_msg_id)
        .filter((clientMessageId): clientMessageId is string => Boolean(clientMessageId)),
    );

    return outboxItems.filter((item) => !deliveredClientIds.has(item.id));
  }, [messages, outboxItems]);

  const normalizedInitialUnreadCount = Math.max(0, Math.floor(initialUnreadCount));
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const messageMatches = useMemo(() => {
    const matches = new Map<string, boolean>();
    if (!normalizedSearchQuery) {
      return matches;
    }

    for (const message of messages) {
      const plainText = htmlToPlainText(message.content).toLowerCase();
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
  const composerToolsExpanded = showComposerTools || pendingAttachments.length > 0;
  const attachmentSummaryLabel =
    pendingAttachments.length > 0
      ? `${pendingAttachments.length} file${pendingAttachments.length === 1 ? '' : 's'} ready`
      : null;

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
        xpSubtitleText={`${participants.length} participant${participants.length === 1 ? '' : 's'}`}
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
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[rgba(212,150,58,0.18)] bg-[rgba(212,150,58,0.14)] text-[15px] font-bold text-[var(--gold)]">
                    #
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-semibold text-slate-800 dark:text-slate-100">
                        #{roomName}
                      </span>
                      <span className="text-[11px] font-semibold text-[var(--gold)]">
                        {participants.length} online
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

                  {/* Members */}
                  <div className="rounded-[1rem] border border-white/60 bg-white/70 px-3 py-2 dark:border-slate-700 dark:bg-[#13100E]/55">
                    <p className="ui-section-kicker">
                      Members{participants.length > 0 ? ` · ${participants.length}` : ''}
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {participants.map((participant) => (
                        <li key={participant.userId} className="flex items-center gap-2">
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--green)]" aria-hidden="true" />
                          <span className="truncate text-[12px] font-semibold text-slate-800 dark:text-slate-100">
                            {participant.screenname}
                            {participant.userId === currentUserId ? (
                              <span className="ml-1 font-normal text-slate-400 dark:text-slate-500">(You)</span>
                            ) : null}
                          </span>
                        </li>
                      ))}
                      {participants.length === 0 ? (
                        <li className="text-[12px] text-slate-400 dark:text-slate-500">No one else here yet.</li>
                      ) : null}
                    </ul>
                  </div>
                  {/* Search */}
                  <div className="rounded-[1rem] border border-white/60 bg-white/70 px-3 py-2 dark:border-slate-700 dark:bg-[#13100E]/55">
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

                  {inviteCode ? (
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(`${window.location.origin}/join/${inviteCode}`)
                          .then(() => {
                            setShareLinkCopied(true);
                            setTimeout(() => setShareLinkCopied(false), 2000);
                          });
                      }}
                      className="ui-focus-ring ui-button-secondary ui-button-compact flex items-center gap-2"
                      title="Copy invite link"
                    >
                      <AppIcon kind="link" className="h-3.5 w-3.5 shrink-0" />
                      {shareLinkCopied ? 'Link copied!' : 'Share invite link'}
                    </button>
                  ) : null}
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
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-50">
                  <AppIcon kind="chat" className="h-7 w-7 text-violet-400" />
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
                  setLongPressMessageId(null);
                  setShowConversationMenu(false);
                }}
              >
                {messages.map((message, index) => {
                  const senderName = screennameMap[message.sender_id] || 'Unknown User';
                  const isMine = message.sender_id === currentUserId;
                  const isDeleted = Boolean(message.deleted_at);
                  const isEditing = editingMessageId === message.id;
                  const isMatch = normalizedSearchQuery ? Boolean(messageMatches.get(message.id)) : false;
                  const senderColorClass = isMine ? 'text-[var(--rose)]' : getStableSenderColorClass(message.sender_id);
                  const plainMessageText = htmlToPlainText(message.content).toLowerCase();
                  const isMentioningCurrentUser =
                    !isMine && plainMessageText.includes(`@${currentUserScreenname.trim().toLowerCase()}`);
                  const timestampDate = new Date(message.created_at);
                  const fullTimestamp = timestampDate.toLocaleString();
                  const reactionEntries = reactionSummaryByMessageId.get(String(message.id)) ?? [];
                  const activeReactionEmojis = reactionEntries
                    .filter((entry) => entry.reactedByMe)
                    .map((entry) => entry.emoji);
                  const messageAttachments = attachmentsByMessageId.get(message.id) ?? [];
                  const richTextPresentation = richTextPresentationByMessageId.get(message.id) ?? {
                    html: sanitizeRichTextHtml(message.content),
                    hasCustomStyling: false,
                  };
                  const hasCustomStyling = richTextPresentation.hasCustomStyling;
                  const isEdited = Boolean(message.edited_at && !message.deleted_at);
                  void relativeTimeTick;
                  const clusterMeta = getConversationClusterMeta(messages, index);
                  const dividerLabel = formatConversationDividerLabel(message.created_at);
                  const metaTimeLabel = formatConversationMetaTime(message.created_at);
                  const senderAvatar = !isMine ? (
                    clusterMeta.isFirstInRun ? (
                      <ProfileAvatar
                        screenname={senderName}
                        buddyIconPath={buddyIconMap[message.sender_id] ?? null}
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
                            enabled={!isMine && !isDeleted && !isEditing}
                            label="Mention"
                            onTrigger={() => startMentioningMessage(message)}
                            className="max-w-[82%]"
                          >
                            <div
                              className="group relative focus:outline-none"
                              tabIndex={!isDeleted && !isEditing ? 0 : undefined}
                              onTouchStart={() => {
                                if (isDeleted) return;
                                longPressTimerRef.current = setTimeout(() => {
                                  void hapticLight();
                                  setLongPressMessageId(message.id);
                                }, 500);
                              }}
                              onTouchEnd={() => {
                                if (longPressTimerRef.current) {
                                  clearTimeout(longPressTimerRef.current);
                                  longPressTimerRef.current = null;
                                }
                              }}
                              onTouchMove={() => {
                                if (longPressTimerRef.current) {
                                  clearTimeout(longPressTimerRef.current);
                                  longPressTimerRef.current = null;
                                }
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
                                className={`relative msg-enter px-3 py-2 ${
                                  hasCustomStyling
                                    ? 'text-[length:var(--ui-text-lg)] leading-[1.48]'
                                    : 'text-[length:var(--ui-text-md)] leading-[1.42]'
                                } ${
                                  clusterMeta.isLastInRun ? 'mb-2' : 'mb-0.5'
                                } ${
                                  isMine
                                    ? hasCustomStyling
                                      ? `rounded-[1.35rem] border border-blue-200/80 bg-white/96 text-slate-900 shadow-[0_10px_24px_rgba(37,99,235,0.16)] ${clusterMeta.isLastInRun ? 'rounded-br-[8px] bubble-tail-out' : ''}`
                                      : `rounded-[1.35rem] bg-[#E8608A]/22 text-white shadow-[0_8px_22px_rgba(232,96,138,0.26)] ${clusterMeta.isLastInRun ? 'rounded-br-[7px] bubble-tail-out' : ''}`
                                    : `rounded-[1.35rem] border border-white/70 bg-white/85 text-slate-800 shadow-sm backdrop-blur-sm dark:border-slate-700/70 dark:bg-[#13100E]/70 dark:text-slate-100 ${clusterMeta.isLastInRun ? 'rounded-bl-[7px] bubble-tail-in' : ''} ${isMentioningCurrentUser ? 'border-amber-300/70 bg-amber-50/80 dark:border-amber-400/35 dark:bg-amber-950/25' : ''}`
                                } ${isMatch ? 'ring-2 ring-amber-400' : ''} ${!isDeleted && !isEditing ? 'ui-focus-ring' : ''}`}
                              >
                                {isEditing ? (
                                  <div className="flex min-w-[200px] flex-col gap-2">
                                    <input
                                      value={editDraft}
                                      onChange={(event) => setEditDraft(event.target.value)}
                                      aria-label="Edit message"
                                      className={`ui-focus-ring w-full rounded-xl border bg-white/20 px-2.5 py-1.5 text-[length:var(--ui-text-sm)] ${
                                        isMine
                                          ? 'border-white/30 text-white placeholder-white/50'
                                          : 'border-slate-200 text-slate-800'
                                      }`}
                                      maxLength={1500}
                                      autoFocus
                                    />
                                    <div className="flex justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={cancelEditingMessage}
                                        className={`ui-focus-ring rounded-xl px-2.5 py-1 text-[length:var(--ui-text-xs)] font-semibold ${
                                          isMine ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void saveEditedMessage(message.id)}
                                        disabled={isSavingEdit || !editDraft.trim()}
                                        className={`ui-focus-ring rounded-xl px-2.5 py-1 text-[length:var(--ui-text-xs)] font-semibold disabled:opacity-60 ${
                                          isMine ? 'bg-white/30 text-white hover:bg-white/40' : 'bg-[#E8608A] text-white hover:bg-[#B93A67]'
                                        }`}
                                      >
                                        Save
                                      </button>
                                    </div>
                                  </div>
                                ) : isDeleted ? (
                                  <span className="italic opacity-50">Message deleted</span>
                                ) : (
                                  <span
                                    className={`aim-rich-html ${hasCustomStyling ? 'aim-rich-html--styled' : ''}`}
                                    dangerouslySetInnerHTML={{ __html: richTextPresentation.html }}
                                  />
                                )}
                                {isEdited && !isEditing ? (
                                  <span className={`ml-1.5 text-[length:var(--ui-text-2xs)] ${
                                    isMine ? (hasCustomStyling ? 'text-slate-400' : 'text-blue-200') : 'text-slate-400'
                                  }`}>(edited)</span>
                                ) : null}
                              </div>

                              {!isDeleted && !isEditing ? (
                                <div
                                  data-swipe-ignore="true"
                                  className={`absolute bottom-full right-0 z-10 mb-2 min-w-[15rem] rounded-2xl border border-white/70 bg-white/90 p-2 shadow-lg backdrop-blur-md ui-fade-in dark:border-slate-700/70 dark:bg-[#13100E]/88 ${
                                    longPressMessageId === message.id ? 'flex' : 'hidden group-hover:flex group-focus-within:flex'
                                  } flex-col gap-2`}
                                >
                                  <div className="space-y-1">
                                    <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                                      React
                                    </p>
                                    <MessageReactionPicker
                                      activeEmojis={activeReactionEmojis}
                                      disabledEmojis={activeReactionEmojis.filter((emoji) =>
                                        pendingReactionKeys.has(buildReactionMutationKey(message.id, emoji)),
                                      )}
                                      onPick={(emoji) => {
                                        void toggleReaction(message.id, emoji);
                                      }}
                                    />
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1">
                                    {!isMine ? (
                                      <button
                                        type="button"
                                        onClick={() => startMentioningMessage(message)}
                                        className="ui-focus-ring rounded-full px-2.5 py-1 text-[length:var(--ui-text-xs)] font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#13100E]"
                                        aria-label={`Mention ${senderName} from message sent at ${metaTimeLabel}`}
                                      >
                                        Mention
                                      </button>
                                    ) : null}
                                    {isMine ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            startEditingMessage(message);
                                            setLongPressMessageId(null);
                                          }}
                                          className="ui-focus-ring rounded-full px-2.5 py-1 text-[length:var(--ui-text-xs)] font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#13100E]"
                                          aria-label={`Edit message sent at ${metaTimeLabel}`}
                                        >
                                          Edit
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            void softDeleteMessage(message.id);
                                            setLongPressMessageId(null);
                                          }}
                                          disabled={isDeletingMessageId === message.id}
                                          className="ui-focus-ring rounded-full px-2.5 py-1 text-[length:var(--ui-text-xs)] font-semibold text-red-500 hover:bg-red-50 disabled:opacity-60"
                                          aria-label={`Delete message sent at ${metaTimeLabel}`}
                                        >
                                          {isDeletingMessageId === message.id ? '…' : 'Delete'}
                                        </button>
                                      </>
                                    ) : null}
                                  </div>
                                </div>
                              ) : null}

                              {!isDeleted && reactionEntries.length > 0 ? (
                                <MessageReactionStrip
                                  align={isMine ? 'end' : 'start'}
                                  animatedReactionKeys={newReactionKeys}
                                  disabledReactionKeys={pendingReactionKeys}
                                  entries={reactionEntries}
                                  messageId={message.id}
                                  onToggle={(emoji) => {
                                    void toggleReaction(message.id, emoji);
                                  }}
                                />
                              ) : null}

                              {!isDeleted && messageAttachments.length > 0 ? (
                                <div className={`-mt-1 mb-1 space-y-1 ${isMine ? 'text-right' : ''}`}>
                                  {messageAttachments.map((attachment) => {
                                    const { data } = supabase.storage
                                      .from(attachment.bucket)
                                      .getPublicUrl(attachment.storage_path);
                                    return (
                                      <a
                                        key={attachment.id}
                                        href={data.publicUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        className={`ui-focus-ring block rounded-lg text-[length:var(--ui-text-2xs)] underline ${isMine ? 'text-blue-200' : 'text-blue-600'}`}
                                        title={attachment.storage_path}
                                        aria-label={`Open attachment ${attachment.file_name}${attachment.size_bytes ? `, ${formatFileSize(attachment.size_bytes)}` : ''}`}
                                      >
                                        <span className="inline-flex items-center gap-1">
                                          <AppIcon kind="attachment" className="h-3 w-3" />
                                          <span>{attachment.file_name}</span>
                                        </span>
                                        {attachment.size_bytes ? ` (${formatFileSize(attachment.size_bytes)})` : ''}
                                      </a>
                                    );
                                  })}
                                </div>
                              ) : null}
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
                      ? 'border border-red-200/80 bg-red-50/90 text-red-950 shadow-[0_8px_24px_rgba(239,68,68,0.12)]'
                      : item.status === 'queued'
                        ? 'border border-amber-200/80 bg-amber-50/90 text-amber-950 shadow-[0_8px_24px_rgba(245,158,11,0.12)]'
                        : 'bg-[#E8608A]/75 text-white shadow-[0_2px_8px_rgba(232,96,138,0.28)]';

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

          {reactionError ? (
            <p role="alert" className="mx-3 mt-1 text-[length:var(--ui-text-2xs)] text-red-600">
              {reactionError}
            </p>
          ) : null}
          {attachmentLoadError ? (
            <p role="alert" className="mx-3 mt-1 text-[length:var(--ui-text-2xs)] text-red-600">
              {attachmentLoadError}
            </p>
          ) : null}
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
                    Mentioning {screennameMap[mentioningMessage.sender_id] || 'Unknown User'}
                  </p>
                  <p className="truncate text-[length:var(--ui-text-xs)] text-slate-600 dark:text-slate-200">
                    {mentioningMessage.deleted_at
                      ? 'Message deleted'
                      : htmlToPlainText(mentioningMessage.content).trim() || 'Original message'}
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
                {attachmentSummaryLabel ? (
                  <span className="ui-compose-summary-pill">{attachmentSummaryLabel}</span>
                ) : null}
                {normalizedSearchQuery ? (
                  <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
                    {searchMatchCount} result{searchMatchCount === 1 ? '' : 's'}
                  </span>
                ) : null}
              </div>
            </div>

            {(composerToolsExpanded || showFormatting) ? (
              <div className="ui-toolbar-surface space-y-3 rounded-2xl px-3 py-3">
                {composerToolsExpanded ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => attachmentInputRef.current?.click()}
                      className={`${xpTinyToolbarButtonClass(pendingAttachments.length > 0)} h-8 gap-1.5 px-3`}
                      aria-label={`Attach files to your message in room ${roomName}`}
                    >
                      <AppIcon kind="attachment" className="h-3.5 w-3.5" />
                      <span>Attachment</span>
                    </button>
                    <input
                      ref={attachmentInputRef}
                      type="file"
                      multiple
                      onChange={(event) => handleSelectAttachments(event.target.files)}
                      className="hidden"
                      aria-label={`Choose attachments for room ${roomName}`}
                    />
                  </div>
                ) : null}

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

                {pendingAttachments.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {pendingAttachments.map((file, index) => (
                      <div
                        key={`${file.name}-${file.size}-${file.lastModified}`}
                        className="ui-compose-summary-pill inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5"
                      >
                        <AppIcon kind="attachment" className="h-3 w-3 shrink-0" />
                        <span className="truncate text-[length:var(--ui-text-2xs)]">
                          {file.name}
                          {` · ${formatFileSize(file.size)}`}
                        </span>
                        <button
                          type="button"
                          onClick={() => removePendingAttachment(index)}
                          className="ui-focus-ring shrink-0 rounded-full p-0.5 text-slate-400 hover:text-slate-600 dark:text-slate-400 dark:hover:text-slate-200"
                          aria-label={`Remove attachment ${file.name}`}
                        >
                          <AppIcon kind="close" className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {attachmentError ? (
                  <p role="alert" className="text-[length:var(--ui-text-2xs)] text-red-600">
                    {attachmentError}
                  </p>
                ) : null}
              </div>
            ) : attachmentError ? (
              <p role="alert" className="text-[length:var(--ui-text-2xs)] text-red-600">
                {attachmentError}
              </p>
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
                className="min-h-[24px] flex-1 resize-none rounded-xl bg-transparent text-[length:var(--ui-text-md)] text-white placeholder-[#6B5B4E] focus:outline-none focus:border-[#E8608A]"
                style={composerTextStyle}
              />
              {(draft.trim() || pendingAttachments.length > 0) ? (
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
