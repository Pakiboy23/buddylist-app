'use client';

import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Window from '@/components/Window';
import RichTextToolbar from '@/components/RichTextToolbar';
import {
  CHAT_MEDIA_MAX_ATTACHMENTS,
  type ChatMediaAttachmentRecord,
  formatFileSize,
  uploadChatMediaFile,
  validateChatMediaFile,
} from '@/lib/chatMedia';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_RICH_TEXT_FORMAT,
  formatRichText,
  htmlToPlainText,
  RichTextFormat,
  sanitizeRichTextHtml,
} from '@/lib/richText';
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
  initialUnreadCount?: number;
  initialDraft?: string;
  typingUsers?: string[];
  onDraftChange?: (draft: string) => void;
  onQueueRoomMessage?: (payload: { roomId: string; content: string; clientMessageId?: string }) => void;
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

export default function GroupChatWindow({
  roomId,
  roomName,
  currentUserId,
  currentUserScreenname,
  initialUnreadCount = 0,
  initialDraft = '',
  typingUsers = [],
  onDraftChange,
  onQueueRoomMessage,
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

  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(initialDraft);
  const [format, setFormat] = useState<RichTextFormat>(DEFAULT_RICH_TEXT_FORMAT);
  const [showFormatting, setShowFormatting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeletingMessageId, setIsDeletingMessageId] = useState<string | null>(null);
  const [reactionRows, setReactionRows] = useState<RoomMessageReactionRow[]>([]);
  const [attachmentRows, setAttachmentRows] = useState<RoomMessageAttachmentRow[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [reactionError, setReactionError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentLoadError, setAttachmentLoadError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [hasLiveMessageSinceOpen, setHasLiveMessageSinceOpen] = useState(false);
  const [typingMap, setTypingMap] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const roomChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentAtRef = useRef(0);
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    screennameMapRef.current = screennameMap;
  }, [screennameMap]);

  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);

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
  }, [messages, roomId]);

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
  }, [messages, roomId]);

  const ensureScreennames = useCallback(async (userIds: string[]) => {
    const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
    if (uniqueUserIds.length === 0) {
      return;
    }

    const missingIds = uniqueUserIds.filter((userId) => !screennameMapRef.current[userId]);
    if (missingIds.length === 0) {
      return;
    }

    const { data, error: profileError } = await supabase
      .from('users')
      .select('id,screenname')
      .in('id', missingIds);

    if (profileError) {
      console.error('Failed to load room user profiles:', profileError.message);
      return;
    }

    const profiles = (data ?? []) as RoomProfile[];
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
  }, [currentUserId, currentUserScreenname]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

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
    `inline-flex h-7 min-w-7 items-center justify-center rounded-lg border px-1.5 text-[11px] font-semibold text-slate-700 transition ${
      active
        ? 'border-blue-400/70 bg-blue-50 text-blue-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]'
        : 'border-slate-200 bg-white hover:bg-slate-50'
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

  const attachmentsByMessageId = useMemo(() => {
    const grouped = new Map<string, RoomMessageAttachmentRow[]>();
    for (const attachment of attachmentRows) {
      const existing = grouped.get(attachment.message_id) ?? [];
      existing.push(attachment);
      grouped.set(attachment.message_id, existing);
    }
    return grouped;
  }, [attachmentRows]);

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

  return (
    <div className="fixed inset-0 z-50">
      <Window
        title={`#${roomName}`}
        variant="minimal_shell"
        minimalTitleText={`Chat Room: ${roomName}`}
        onMinimalClose={onBack}
        onMinimalSignOff={onSignOff}
      >
        <div className="flex h-full min-h-0 flex-col rounded-[1.4rem] border border-white/60 bg-white/65 text-[11px] backdrop-blur-xl">
          <div className="m-2 mb-0 flex min-h-0 flex-1 flex-col overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
            <p className="mb-0.5 font-bold text-slate-700">Room: #{roomName}</p>
            <p className="mb-2 truncate text-[11px] text-slate-500">
              Participants:{' '}
              {participants.length === 0
                ? 'No one else is here yet.'
                : participants
                    .map((participant) =>
                      participant.userId === currentUserId ? `${participant.screenname} (You)` : participant.screenname,
                    )
                    .join(', ')}
            </p>

            <div className="mb-2 rounded-xl border border-white/60 bg-white/70 backdrop-blur-sm px-2 py-1 text-[11px] text-slate-700">
              <div className="flex items-center gap-2">
                <label htmlFor="room-search-input" className="shrink-0 font-bold">
                  Search:
                </label>
                <input
                  id="room-search-input"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={`Find in #${roomName}`}
                  className="h-6 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-1.5 text-[11px] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  disabled={!searchQuery}
                  className="h-6 shrink-0 rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold text-slate-700 disabled:opacity-50"
                >
                  Clear
                </button>
              </div>
              {normalizedSearchQuery ? (
                <p className="mt-1 text-[10px] text-slate-500">
                  {searchMatchCount} {searchMatchCount === 1 ? 'match' : 'matches'}
                </p>
              ) : null}
            </div>

            {isLoadingMessages && <p className="italic text-slate-500">Loading room history...</p>}
            {!isLoadingMessages && messages.length === 0 && (
              <p className="italic text-slate-500">No messages yet. Start the room conversation.</p>
            )}
            {!isLoadingMessages && (
              <div className="space-y-1">
                {messages.map((message, index) => {
                  const senderName = screennameMap[message.sender_id] || 'Unknown User';
                  const isMine = message.sender_id === currentUserId;
                  const isDeleted = Boolean(message.deleted_at);
                  const isEditing = editingMessageId === message.id;
                  const isMatch = normalizedSearchQuery ? Boolean(messageMatches.get(message.id)) : false;
                  const senderClassName = isMine
                    ? 'text-blue-600'
                    : getStableSenderColorClass(message.sender_id);
                  const plainMessageText = htmlToPlainText(message.content).toLowerCase();
                  const isMentioningCurrentUser =
                    !isMine &&
                    plainMessageText.includes(`@${currentUserScreenname.trim().toLowerCase()}`);
                  const timestampDate = new Date(message.created_at);
                  const timestamp = timestampDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const fullTimestamp = timestampDate.toLocaleString();
                  const reactionSummary = reactionSummaryByMessageId.get(message.id);
                  const reactionEntries = reactionSummary
                    ? Object.entries(reactionSummary)
                        .filter(([, count]) => count > 0)
                        .sort((left, right) => right[1] - left[1])
                    : [];
                  const messageAttachments = attachmentsByMessageId.get(message.id) ?? [];
                  const isEdited = Boolean(message.edited_at && !message.deleted_at);

                  return (
                    <div
                      key={message.id}
                      className={
                        normalizedSearchQuery
                          ? isMatch
                            ? 'rounded bg-[#fffbe7] px-1'
                            : 'px-1 opacity-50'
                          : isMentioningCurrentUser
                            ? 'rounded bg-[#fffbe7] px-1'
                            : undefined
                      }
                    >
                      {separatorIndex === index ? (
                        <p className="new-messages-separator">New messages</p>
                      ) : null}
                      <div className={`flex w-full flex-col ${isMine ? 'items-end' : 'items-start'} mb-2`}>
                        {!isMine ? (
                          <span className={`mb-1 ml-1 text-[10px] font-medium ${senderClassName}`}>
                            {senderName}
                          </span>
                        ) : null}
                        <div
                          className={`group relative flex max-w-[80%] flex-col px-3 py-2 shadow-sm ${
                            isMine
                              ? 'rounded-2xl rounded-br-[4px] bg-blue-500 text-white'
                              : 'rounded-2xl rounded-bl-[4px] bg-white border border-slate-200 text-slate-900'
                          }`}
                        >
                          {isEditing ? (
                            <div className="flex flex-col gap-2">
                              <input
                                value={editDraft}
                                onChange={(event) => setEditDraft(event.target.value)}
                                className="min-w-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[13px] text-slate-900 focus:outline-none"
                                maxLength={1500}
                              />
                              <div className="flex gap-2 justify-end">
                                <button
                                  type="button"
                                  onClick={cancelEditingMessage}
                                  className="rounded-lg bg-white/20 px-2 py-1 text-[11px] font-semibold"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void saveEditedMessage(message.id)}
                                  disabled={isSavingEdit || !editDraft.trim()}
                                  className="rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-blue-600 disabled:opacity-60"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ) : isDeleted ? (
                            <span className={`italic ${isMine ? 'text-blue-100' : 'text-slate-500'} text-[13px]`}>
                              This message was deleted.
                            </span>
                          ) : (
                            <span
                              className="rich-html text-[14px] leading-snug"
                              dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(message.content) }}
                            />
                          )}

                          {!isDeleted && messageAttachments.length > 0 ? (
                            <div className="mt-2 space-y-1">
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
                                    className={`block truncate text-[12px] underline ${isMine ? 'text-blue-100' : 'text-blue-600'}`}
                                    title={attachment.storage_path}
                                  >
                                    📎 {attachment.file_name}
                                    {attachment.size_bytes ? ` (${formatFileSize(attachment.size_bytes)})` : ''}
                                  </a>
                                );
                              })}
                            </div>
                          ) : null}

                          {isMine && !isDeleted && !isEditing ? (
                            <div className="absolute right-full top-1/2 mr-2 -translate-y-1/2 opacity-0 transition-opacity group-hover:opacity-100 flex items-center gap-1.5 bg-slate-100 px-2 py-1 rounded-full shadow-sm border border-slate-200">
                              <button
                                type="button"
                                onClick={() => startEditingMessage(message)}
                                className="text-[11px] font-medium text-slate-600 hover:text-blue-600"
                              >
                                Edit
                              </button>
                              <div className="w-px h-3 bg-slate-300" />
                              <button
                                type="button"
                                onClick={() => void softDeleteMessage(message.id)}
                                disabled={isDeletingMessageId === message.id}
                                className="text-[11px] font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </div>

                        <div className={`mt-1 flex items-center gap-1 px-1 text-[10px] text-slate-400 ${isMine ? 'justify-end' : 'justify-start'}`}>
                          <span title={fullTimestamp}>{timestamp}</span>
                          {isEdited ? <span>· edited</span> : null}
                        </div>

                        {!isDeleted && reactionEntries.length > 0 ? (
                          <div className={`mt-0.5 flex flex-wrap items-center gap-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                            {reactionEntries.map(([emoji, count]) => (
                              <span
                                key={`${message.id}-${emoji}`}
                                className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-600 shadow-sm"
                              >
                                {emoji} {count}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          {reactionError ? <p className="mx-2 mt-1 text-[10px] text-red-700">{reactionError}</p> : null}
          {attachmentLoadError ? <p className="mx-2 mt-1 text-[10px] text-red-700">{attachmentLoadError}</p> : null}

          <div className="mx-2 mb-2 flex items-center gap-1 rounded-xl border border-slate-200 bg-white/80 px-1 py-1">
            <button
              type="button"
              onClick={() => setShowFormatting((previous) => !previous)}
              className={xpTinyToolbarButtonClass(showFormatting)}
              aria-label="Toggle formatting"
              title="Toggle formatting"
            >
              A
            </button>
            <button type="button" onClick={toggleBold} className={xpTinyToolbarButtonClass(format.bold)} aria-label="Bold">
              B
            </button>
            <button type="button" onClick={toggleItalic} className={xpTinyToolbarButtonClass(format.italic)} aria-label="Italic">
              I
            </button>
            <button
              type="button"
              onClick={toggleUnderline}
              className={xpTinyToolbarButtonClass(format.underline)}
              aria-label="Underline"
            >
              <span className="underline">U</span>
            </button>
            <button
              type="button"
              disabled
              className={`${xpTinyToolbarButtonClass()} opacity-70`}
              aria-label="Link"
              title="Link"
            >
              🔗
            </button>
            <button
              type="button"
              className={xpTinyToolbarButtonClass()}
              aria-label="Emoji picker coming soon"
              title="Emoji picker coming soon"
            >
              ☺
            </button>
            <button
              type="button"
              onClick={() => attachmentInputRef.current?.click()}
              className={xpTinyToolbarButtonClass(pendingAttachments.length > 0)}
              aria-label="Attach files"
              title="Attach files"
            >
              📎
            </button>
            <input
              ref={attachmentInputRef}
              type="file"
              multiple
              onChange={(event) => handleSelectAttachments(event.target.files)}
              className="hidden"
            />
            <button
              type="button"
              onClick={onLeave}
              className={`${xpTinyToolbarButtonClass()} ml-auto text-[#7b1f1f]`}
              aria-label="Leave room"
              title="Leave room"
            >
              X
            </button>
          </div>

          {showFormatting ? (
            <div className="mx-2 mb-2 rounded-xl border border-slate-200 bg-white/80 p-1">
              <RichTextToolbar value={format} onChange={setFormat} />
            </div>
          ) : null}

          {typingText ? (
            <p className="mx-2 mb-1 text-[11px] italic text-blue-600">{typingText}</p>
          ) : null}

          {pendingAttachments.length > 0 ? (
            <div className="mx-2 mb-2 space-y-1 rounded-xl border border-slate-200 bg-white/70 p-1">
              {pendingAttachments.map((file, index) => (
                <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[10px] text-slate-700">
                    📎 {file.name} ({formatFileSize(file.size)})
                  </span>
                  <button
                    type="button"
                    onClick={() => removePendingAttachment(index)}
                    className="rounded-lg border border-slate-200 bg-white px-1 text-[10px] font-bold text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          ) : null}
          {attachmentError ? <p className="mx-2 mb-1 text-[10px] text-red-700">{attachmentError}</p> : null}

          <div className="m-2 mt-0 flex items-stretch gap-2">
            <form
              onSubmit={handleSendMessage}
              className="flex h-16 flex-1 items-stretch gap-2 rounded-xl border border-slate-200 bg-white p-1"
            >
              <textarea
                value={draft}
                onChange={(event) => handleDraftChange(event.target.value)}
                onKeyDown={handleDraftKeyDown}
                placeholder={`Message #${roomName}`}
                className="h-full min-h-0 flex-1 resize-none bg-white px-2 py-1 text-[11px] focus:outline-none"
                maxLength={1500}
                rows={2}
              />
              <button
                type="submit"
                disabled={isSending || (!draft.trim() && pendingAttachments.length === 0)}
                className="min-w-[82px] rounded-xl border border-blue-500/70 bg-gradient-to-b from-blue-500 to-blue-600 px-3 text-[11px] font-semibold text-white shadow-[0_8px_18px_rgba(37,99,235,0.3)] disabled:opacity-60"
              >
                {isSending ? '...' : 'Send'}
              </button>
            </form>
          </div>

          <p className="mx-2 mb-2 text-[11px] text-slate-500">
            Enter to send. Cmd/Ctrl + Enter for a new line.
          </p>
          {error && <p className="mx-2 mb-2 text-[11px] text-red-700">{error}</p>}
        </div>
      </Window>
    </div>
  );
}
