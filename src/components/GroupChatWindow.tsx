'use client';

import { FormEvent, KeyboardEvent, type CSSProperties, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import AppIcon from '@/components/AppIcon';
import ProfileAvatar from '@/components/ProfileAvatar';
import RetroWindow from '@/components/RetroWindow';
import RichTextToolbar from '@/components/RichTextToolbar';
import type { OutboxItem } from '@/lib/outbox';
import { getJSON, setJSON } from '@/lib/clientStorage';
import {
  CHAT_MEDIA_MAX_ATTACHMENTS,
  type ChatMediaAttachmentRecord,
  formatFileSize,
  uploadChatMediaFile,
  validateChatMediaFile,
} from '@/lib/chatMedia';
import { hapticLight, hapticSuccess } from '@/lib/haptics';
import { useKeyboardViewport } from '@/hooks/useKeyboardViewport';
import { useSwipeBack } from '@/hooks/useSwipeBack';
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
  }) => void;
  onRetryOutboxMessage?: (itemId: string) => void;
  onBack: () => void;
  onLeave: () => void;
  onSignOff?: () => void;
  reloadToken?: number;
}

const GROUP_SENDER_COLOR_CLASSES = [
  'text-emerald-600',
  'text-violet-600',
  'text-rose-600',
  'text-amber-600',
  'text-cyan-600',
  'text-lime-600',
  'text-fuchsia-600',
  'text-sky-600',
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

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeletingMessageId, setIsDeletingMessageId] = useState<string | null>(null);
  const [longPressMessageId, setLongPressMessageId] = useState<string | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reactionRows, setReactionRows] = useState<RoomMessageReactionRow[]>([]);
  const [attachmentRows, setAttachmentRows] = useState<RoomMessageAttachmentRow[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [reactionError, setReactionError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentLoadError, setAttachmentLoadError] = useState<string | null>(null);
  const [composerAreaHeight, setComposerAreaHeight] = useState(0);
  const [enableSupplementalRealtime, setEnableSupplementalRealtime] = useState(false);

  const [isClosing, setIsClosing] = useState(false);
  const [relativeTimeTick, setRelativeTimeTick] = useState(0);
  const seenReactionKeysRef = useRef(new Set<string>());
  const [newReactionKeys, setNewReactionKeys] = useState<Set<string>>(() => new Set());

  const handleBack = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => onBack(), 190);
  }, [onBack]);

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
    composerRef.current?.focus();
  }, []);

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

    roomChannel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'room_messages', filter: `room_id=eq.${roomId}` },
      (payload) => {
        const incoming = payload.new as RoomMessage;
        if (!incoming?.id) {
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
      { event: 'UPDATE', schema: 'public', table: 'room_messages', filter: `room_id=eq.${roomId}` },
      (payload) => {
        const updated = payload.new as RoomMessage;
        if (!updated?.id) {
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

    roomChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
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
    setDraft('');
    onDraftChange?.('');
    clearPendingAttachments();
    setAttachmentError(null);
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

  const xpTinyToolbarButtonClass = (active = false) =>
    `ui-focus-ring inline-flex h-7 min-w-7 items-center justify-center rounded-lg border px-1.5 text-[length:var(--ui-text-xs)] font-semibold text-slate-700 transition ${
      active
        ? 'border-blue-400/70 bg-blue-50 text-blue-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:border-blue-400/50 dark:bg-blue-500/15 dark:text-blue-200'
        : 'border-slate-200 bg-white/80 hover:bg-white dark:border-slate-700 dark:bg-slate-950/65 dark:text-slate-200 dark:hover:bg-slate-900'
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

  const reactionSummaryByMessageId = useMemo(() => {
    const summary = new Map<string, Record<string, number>>();

    for (const row of reactionRows) {
      if (!summary.has(row.message_id)) {
        summary.set(row.message_id, {});
      }

      const target = summary.get(row.message_id);
      if (!target) {
        continue;
      }

      target[row.emoji] = (target[row.emoji] ?? 0) + 1;
    }

    return summary;
  }, [reactionRows]);

  useEffect(() => {
    const seenReactionKeys = seenReactionKeysRef.current;
    const newlyDiscoveredKeys: string[] = [];

    for (const [messageId, emojiSummary] of reactionSummaryByMessageId) {
      for (const emoji of Object.keys(emojiSummary)) {
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
        headerActions={(
          <button
            type="button"
            onClick={handleBack}
            className="ui-focus-ring ui-window-header-button px-2.5 text-[11px] font-semibold"
            aria-label={`Close room ${roomName}`}
            title="Close room"
          >
            Done
          </button>
        )}
        onXpClose={handleBack}
        onXpSignOff={onSignOff}
        style={chatShellStyle}
      >
        <div className="ui-window-panel flex h-full min-h-0 flex-col rounded-[1.4rem] text-[length:var(--ui-text-md)]">

          {/* Room header: name + participants */}
          <div
            className="ui-chat-header-card mx-3 mt-2.5 rounded-2xl px-3 py-2 text-[length:var(--ui-text-xs)]"
            role="region"
            aria-label={`${roomName} room header`}
          >
            <p className="font-semibold text-slate-700">#{roomName}</p>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex -space-x-2">
                {participants.slice(0, 4).map((participant) => (
                  <ProfileAvatar
                    key={participant.userId}
                    screenname={participant.screenname}
                    buddyIconPath={buddyIconMap[participant.userId] ?? null}
                    size="sm"
                    showStatusDot={false}
                    tone="violet"
                    className="ring-2 ring-white dark:ring-slate-950"
                  />
                ))}
              </div>
              {participants.length > 4 ? (
                <span className="text-[length:var(--ui-text-2xs)] font-semibold text-slate-400">
                  +{participants.length - 4}
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 truncate text-slate-500">
              {participants.length === 0
                ? 'No one else here yet.'
                : participants
                    .map((p) => (p.userId === currentUserId ? `${p.screenname} (You)` : p.screenname))
                    .join(', ')}
            </p>
          </div>

          {/* Search bar */}
          <div className="ui-search-surface mx-3 mt-1.5 rounded-2xl px-3 py-1.5">
            <label htmlFor={searchInputId} className="sr-only">
              Search room {roomName}
            </label>
            <div className="flex items-center gap-2">
              <svg
                className="h-3.5 w-3.5 shrink-0 text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                id={searchInputId}
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={`Search #${roomName}`}
                aria-describedby={normalizedSearchQuery ? searchResultsId : undefined}
                className="ui-focus-ring h-6 min-w-0 flex-1 rounded-lg bg-transparent text-[length:var(--ui-text-xs)] text-slate-700 placeholder-slate-400"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="ui-focus-ring shrink-0 rounded-full text-[length:var(--ui-text-2xs)] font-semibold text-slate-400 hover:text-slate-600"
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
                className="mt-0.5 text-[length:var(--ui-text-2xs)] text-slate-400"
              >
                {searchMatchCount} {searchMatchCount === 1 ? 'match' : 'matches'}
              </p>
            ) : null}
          </div>

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
              <div className="flex flex-col gap-0.5" onClick={() => setLongPressMessageId(null)}>
                {messages.map((message, index) => {
                  const senderName = screennameMap[message.sender_id] || 'Unknown User';
                  const isMine = message.sender_id === currentUserId;
                  const isDeleted = Boolean(message.deleted_at);
                  const isEditing = editingMessageId === message.id;
                  const isMatch = normalizedSearchQuery ? Boolean(messageMatches.get(message.id)) : false;
                  const senderColorClass = isMine ? 'text-blue-600' : getStableSenderColorClass(message.sender_id);
                  const plainMessageText = htmlToPlainText(message.content).toLowerCase();
                  const isMentioningCurrentUser =
                    !isMine && plainMessageText.includes(`@${currentUserScreenname.trim().toLowerCase()}`);
                  const timestampDate = new Date(message.created_at);
                  const fullTimestamp = timestampDate.toLocaleString();
                  const reactionSummary = reactionSummaryByMessageId.get(message.id);
                  const reactionEntries = reactionSummary
                    ? Object.entries(reactionSummary)
                        .filter(([, count]) => count > 0)
                        .sort((left, right) => right[1] - left[1])
                    : [];
                  const messageAttachments = attachmentsByMessageId.get(message.id) ?? [];
                  const richTextPresentation = richTextPresentationByMessageId.get(message.id) ?? {
                    html: sanitizeRichTextHtml(message.content),
                    hasCustomStyling: false,
                  };
                  const hasCustomStyling = richTextPresentation.hasCustomStyling;
                  const isEdited = Boolean(message.edited_at && !message.deleted_at);

                  // Group logic
                  const prevMessage = index > 0 ? messages[index - 1] : null;
                  const prevTime = prevMessage ? new Date(prevMessage.created_at).getTime() : 0;
                  const currTime = timestampDate.getTime();
                  const isFirstInRun = !prevMessage || prevMessage.sender_id !== message.sender_id || currTime - prevTime > 5 * 60 * 1000;
                  const showTimeDivider = !prevMessage || currTime - prevTime > 5 * 60 * 1000;
                  void relativeTimeTick;
                  const timestamp = formatRelativeTime(message.created_at);
                  const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
                  const isLastInRun = !nextMessage || nextMessage.sender_id !== message.sender_id;

                  return (
                    <div key={message.id} className="flex flex-col">
                      {separatorIndex === index ? (
                        <p className="aim-new-messages-separator my-2">New messages</p>
                      ) : showTimeDivider ? (
                        <p
                          className="my-2 text-center text-[length:var(--ui-text-2xs)] text-slate-400"
                          title={fullTimestamp}
                        >
                          {timestamp}
                        </p>
                      ) : null}

                      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${
                        normalizedSearchQuery && !isMatch ? 'opacity-35' : ''
                      } ${isMentioningCurrentUser && !normalizedSearchQuery ? 'opacity-100' : ''}`}>
                        <div
                          className="group relative max-w-[78%] focus:outline-none"
                          tabIndex={isMine && !isDeleted && !isEditing ? 0 : undefined}
                          onTouchStart={() => {
                            if (!isMine || isDeleted) return;
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
                          {/* Sender name label — only for first in a run from others */}
                          {!isMine && isFirstInRun ? (
                            <p className={`mb-0.5 ml-1 text-[length:var(--ui-text-2xs)] font-semibold ${senderColorClass}`}>
                              {senderName}
                            </p>
                          ) : null}

                          {/* Mention highlight pill */}
                          {isMentioningCurrentUser ? (
                            <div className="absolute -left-1 top-0 h-full w-0.5 rounded-full bg-amber-400" />
                          ) : null}

                          {/* Bubble */}
                          <div
                            className={`relative msg-enter px-3 py-2 ${
                              hasCustomStyling
                                ? 'text-[length:var(--ui-text-lg)] leading-[1.48]'
                                : 'text-[length:var(--ui-text-md)] leading-[1.42]'
                            } ${
                              isLastInRun ? 'mb-2' : 'mb-0.5'
                            } ${
                              isMine
                                ? hasCustomStyling
                                  ? `rounded-2xl border border-blue-200/80 bg-white/96 text-slate-900 shadow-[0_10px_24px_rgba(37,99,235,0.16)] ${isLastInRun ? 'rounded-br-[8px] bubble-tail-out' : ''}`
                                  : `rounded-2xl bg-blue-500 text-white shadow-[0_2px_8px_rgba(37,99,235,0.28)] ${isLastInRun ? 'rounded-br-[6px] bubble-tail-out' : ''}`
                                : `rounded-2xl border border-white/70 bg-white/85 text-slate-800 shadow-sm backdrop-blur-sm ${isLastInRun ? 'rounded-bl-[6px] bubble-tail-in' : ''} ${isMentioningCurrentUser ? 'border-amber-300/70 bg-amber-50/80' : ''}`
                            } ${isMatch ? 'ring-2 ring-amber-400' : ''} ${isMine && !isDeleted && !isEditing ? 'ui-focus-ring' : ''}`}
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
                                      isMine ? 'bg-white/30 text-white hover:bg-white/40' : 'bg-blue-500 text-white hover:bg-blue-600'
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

                          {/* Action bar — hover (desktop) + long-press (mobile) */}
                          {isMine && !isDeleted && !isEditing ? (
                            <div className={`absolute -top-8 right-0 items-center gap-0.5 rounded-full border border-white/70 bg-white/90 px-2 py-1 shadow-lg backdrop-blur-md ui-fade-in ${
                              longPressMessageId === message.id ? 'flex' : 'hidden group-hover:flex group-focus-within:flex'
                            }`}>
                              <button
                                type="button"
                                onClick={() => {
                                  startEditingMessage(message);
                                  setLongPressMessageId(null);
                                }}
                                className="ui-focus-ring rounded-full px-2.5 py-1 text-[length:var(--ui-text-xs)] font-semibold text-slate-600 hover:bg-slate-100"
                                aria-label={`Edit message sent at ${timestamp}`}
                              >
                                Edit
                              </button>
                              <span className="text-slate-300">·</span>
                              <button
                                type="button"
                                onClick={() => {
                                  void softDeleteMessage(message.id);
                                  setLongPressMessageId(null);
                                }}
                                disabled={isDeletingMessageId === message.id}
                                className="ui-focus-ring rounded-full px-2.5 py-1 text-[length:var(--ui-text-xs)] font-semibold text-red-500 hover:bg-red-50 disabled:opacity-60"
                                aria-label={`Delete message sent at ${timestamp}`}
                              >
                                {isDeletingMessageId === message.id ? '…' : 'Delete'}
                              </button>
                            </div>
                          ) : null}

                          {/* Reactions */}
                          {!isDeleted && reactionEntries.length > 0 ? (
                            <div className={`-mt-1 mb-1 flex flex-wrap gap-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
                              {reactionEntries.map(([emoji, count]) => {
                                const reactionKey = `${message.id}-${emoji}`;
                                const isNew = newReactionKeys.has(reactionKey);
                                return (
                                  <span
                                    key={reactionKey}
                                    className={`rounded-full border border-white/70 bg-white/85 px-1.5 py-[2px] text-[length:var(--ui-text-2xs)] text-slate-600 shadow-sm backdrop-blur-sm ${isNew ? 'reaction-pop' : ''}`}
                                  >
                                    {emoji} {count}
                                  </span>
                                );
                              })}
                            </div>
                          ) : null}

                          {/* Attachments */}
                          {!isDeleted && messageAttachments.length > 0 ? (
                            <div className={`-mt-1 mb-1 space-y-0.5 ${isMine ? 'text-right' : ''}`}>
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
                        : 'bg-blue-500/92 text-white shadow-[0_2px_8px_rgba(37,99,235,0.28)]';

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
          <div ref={composerAreaRef} className="mx-3 mt-2 space-y-1.5" style={composerAreaStyle}>
            {/* Formatting toolbar */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowFormatting((previous) => !previous)}
                className={`${xpTinyToolbarButtonClass(showFormatting || hasCustomFormatting)} px-2.5`}
                aria-label={showFormatting ? 'Hide formatting toolbar' : 'Show formatting toolbar'}
                aria-expanded={showFormatting}
                title="Text style"
              >
                <span className="inline-flex items-center gap-1">
                  <span>Style</span>
                  {hasCustomFormatting ? <span className="h-1.5 w-1.5 rounded-full bg-current" /> : null}
                </span>
              </button>
              <button
                type="button"
                onClick={toggleBold}
                className={xpTinyToolbarButtonClass(format.bold)}
                aria-label="Toggle bold"
                aria-pressed={format.bold}
              >
                <span className="font-bold">B</span>
              </button>
              <button
                type="button"
                onClick={toggleItalic}
                className={xpTinyToolbarButtonClass(format.italic)}
                aria-label="Toggle italic"
                aria-pressed={format.italic}
              >
                <span className="italic">I</span>
              </button>
              <button
                type="button"
                onClick={toggleUnderline}
                className={xpTinyToolbarButtonClass(format.underline)}
                aria-label="Toggle underline"
                aria-pressed={format.underline}
              >
                <span className="underline">U</span>
              </button>
              <button
                type="button"
                disabled
                className={`${xpTinyToolbarButtonClass()} opacity-50`}
                aria-label="Insert link coming soon"
              >
                <AppIcon kind="link" className="h-3.5 w-3.5" />
              </button>
              <button type="button" className={xpTinyToolbarButtonClass()} aria-label="Emoji picker coming soon">
                <AppIcon kind="smile" className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => attachmentInputRef.current?.click()}
                className={xpTinyToolbarButtonClass(pendingAttachments.length > 0)}
                aria-label={`Attach files to your message in room ${roomName}`}
              >
                <AppIcon kind="attachment" className="h-3.5 w-3.5" />
              </button>
              <input
                ref={attachmentInputRef}
                type="file"
                multiple
                onChange={(event) => handleSelectAttachments(event.target.files)}
                className="hidden"
                aria-label={`Choose attachments for room ${roomName}`}
              />
              {/* Leave room button, pushed to trailing edge */}
              <button
                type="button"
                onClick={onLeave}
                className="ui-focus-ring ui-button-danger ui-button-compact ml-auto inline-flex h-8 min-w-8 items-center justify-center px-2 text-[length:var(--ui-text-xs)]"
                aria-label={`Leave room ${roomName}`}
                title="Leave room"
              >
                Leave
              </button>
            </div>

            {showFormatting ? <RichTextToolbar value={format} onChange={setFormat} /> : null}

            {/* Pending attachments */}
            {pendingAttachments.length > 0 ? (
              <div className="ui-toolbar-surface space-y-1 rounded-2xl p-2">
                {pendingAttachments.map((file, index) => (
                  <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center gap-2">
                    <span className="min-w-0 flex flex-1 items-center gap-1 truncate text-[length:var(--ui-text-2xs)] text-slate-600">
                      <AppIcon kind="attachment" className="h-3 w-3 shrink-0" />
                      <span className="truncate">{file.name} ({formatFileSize(file.size)})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removePendingAttachment(index)}
                      className="ui-focus-ring ui-button-danger ui-button-compact shrink-0 px-1.5 text-[length:var(--ui-text-2xs)]"
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
                  if (typeof window === 'undefined') {
                    return;
                  }

                  window.requestAnimationFrame(() => {
                    scrollToLatestMessage();
                  });
                }}
                placeholder={`Message #${roomName}…`}
                rows={1}
                maxLength={1500}
                aria-describedby={composerHelpId}
                className="ui-focus-ring min-h-[24px] flex-1 resize-none rounded-xl bg-transparent text-[length:var(--ui-text-md)] text-slate-800 placeholder-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
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
