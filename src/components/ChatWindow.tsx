'use client';

import { FormEvent, KeyboardEvent, type CSSProperties, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import AppIcon from '@/components/AppIcon';
import ChatMediaGallerySheet, { type ChatMediaGalleryItem } from '@/components/ChatMediaGallerySheet';
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
  validateChatMediaFile,
} from '@/lib/chatMedia';
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
import { hapticLight, hapticSuccess, hapticWarning } from '@/lib/haptics';
import { playMessageSendSound, playUiSound } from '@/lib/sound';
import { useKeyboardViewport } from '@/hooks/useKeyboardViewport';
import { useSwipeBack } from '@/hooks/useSwipeBack';
import {
  formatConversationDividerLabel,
  formatConversationMetaTime,
  getConversationClusterMeta,
} from '@/lib/conversationPresentation';
import { isNativeIosShell } from '@/lib/nativeShell';
import type { ResolvedPresenceState } from '@/lib/presence';
import { supabase } from '@/lib/supabase';
import {
  DISAPPEARING_TIMER_OPTIONS,
  filterExpiredMessages,
  formatDisappearingTimerLabel,
} from '@/lib/trustSafety';

export interface ChatMessage {
  id: number;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  delivered_at?: string | null;
  read_at?: string | null;
  reply_to_message_id?: number | null;
  forward_source_message_id?: number | null;
  forward_source_sender_id?: string | null;
  expires_at?: string | null;
  preview_type?: string | null;
  client_msg_id?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
}

export interface ChatComposeSubmitPayload {
  content: string;
  attachments?: File[];
  replyToMessageId?: number | null;
  previewType?: 'text' | 'attachment' | 'forwarded' | 'voice_note' | 'buzz';
}

interface ChatWindowProps {
  buddyScreenname: string;
  buddyStatusMessage: string | null;
  buddyPresenceState: ResolvedPresenceState;
  buddyPresenceDetail: string;
  buddyStatusLine?: string | null;
  buddyBio?: string | null;
  buddyIconPath?: string | null;
  currentUserId: string;
  messages: ChatMessage[];
  outboxItems?: OutboxItem[];
  initialUnreadCount?: number;
  initialDraft?: string;
  typingText?: string | null;
  isPinned?: boolean;
  isMuted?: boolean;
  isArchived?: boolean;
  disappearingTimerSeconds?: number | null;
  onSendMessage: (payload: ChatComposeSubmitPayload) => Promise<void> | void;
  onTypingActivity?: () => void;
  onRetryOutboxMessage?: (itemId: string) => void;
  onDraftChange?: (draft: string) => void;
  onTogglePinned?: () => void;
  onToggleMuted?: () => void;
  onToggleArchived?: () => void;
  onSetDisappearingTimer?: (seconds: number | null) => void;
  onForwardMessage?: (message: ChatMessage) => void;
  onSaveMessage?: (message: ChatMessage) => void;
  onClose: () => void;
  onSignOff?: () => void;
  onOpenProfile?: () => void;
  onChangeTheme?: (themeKey: string | null) => void;
  onChangeWallpaper?: (wallpaperKey: string | null) => void;
  isSending?: boolean;
  isLoading?: boolean;
  themeKey?: string | null;
  wallpaperKey?: string | null;
  showReadReceipts?: boolean;
}

interface MessageReactionRow {
  message_id: number;
  user_id: string;
  emoji: string;
}

interface MessageAttachmentRow extends ChatMediaAttachmentRecord {
  message_id: number;
}

type MediaGalleryFilter = 'all' | 'media' | 'audio' | 'files';

const VOICE_NOTE_MIME_CANDIDATES = [
  'audio/mp4',
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/ogg;codecs=opus',
] as const;

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

function getSupportedVoiceNoteMimeType() {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }

  return VOICE_NOTE_MIME_CANDIDATES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) ?? '';
}

function getVoiceNoteExtension(mimeType: string) {
  if (mimeType.includes('mp4')) {
    return 'm4a';
  }
  if (mimeType.includes('ogg')) {
    return 'ogg';
  }
  return 'webm';
}

function formatRecordingDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function getAttachmentKind(mimeType: string | null | undefined) {
  const normalizedMimeType = (mimeType ?? '').toLowerCase();
  if (normalizedMimeType.startsWith('image/')) {
    return 'image' as const;
  }
  if (normalizedMimeType.startsWith('video/')) {
    return 'video' as const;
  }
  if (normalizedMimeType.startsWith('audio/')) {
    return 'audio' as const;
  }
  return 'file' as const;
}

export default function ChatWindow({
  buddyScreenname,
  buddyStatusMessage,
  buddyPresenceState,
  buddyPresenceDetail,
  buddyStatusLine = null,
  buddyBio = null,
  buddyIconPath = null,
  currentUserId,
  messages,
  outboxItems = [],
  initialUnreadCount = 0,
  initialDraft = '',
  typingText = null,
  isPinned = false,
  isMuted = false,
  isArchived = false,
  disappearingTimerSeconds = null,
  onSendMessage,
  onTypingActivity,
  onRetryOutboxMessage,
  onDraftChange,
  onTogglePinned,
  onToggleMuted,
  onToggleArchived,
  onSetDisappearingTimer,
  onForwardMessage,
  onSaveMessage,
  onClose,
  onSignOff,
  onOpenProfile,
  onChangeTheme,
  onChangeWallpaper,
  isSending = false,
  isLoading = false,
  themeKey = null,
  wallpaperKey = null,
  showReadReceipts = true,
}: ChatWindowProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [relativeTimeTick, setRelativeTimeTick] = useState(0);
  const [draft, setDraft] = useState(initialDraft);
  const [format, setFormat] = useState<RichTextFormat>(() => loadStoredRichTextFormat());
  const [showFormatting, setShowFormatting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeletingMessageId, setIsDeletingMessageId] = useState<number | null>(null);
  const [longPressMessageId, setLongPressMessageId] = useState<number | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reactionRows, setReactionRows] = useState<MessageReactionRow[]>([]);
  const [attachmentRows, setAttachmentRows] = useState<MessageAttachmentRow[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [reactionError, setReactionError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentLoadError, setAttachmentLoadError] = useState<string | null>(null);
  const [voiceNoteError, setVoiceNoteError] = useState<string | null>(null);
  const [enableSupplementalRealtime, setEnableSupplementalRealtime] = useState(false);
  const [composerAreaHeight, setComposerAreaHeight] = useState(0);
  const [replyingToMessageId, setReplyingToMessageId] = useState<number | null>(null);
  const [showMediaGallery, setShowMediaGallery] = useState(false);
  const [mediaGalleryFilter, setMediaGalleryFilter] = useState<MediaGalleryFilter>('all');
  const [showDisappearingMenu, setShowDisappearingMenu] = useState(false);
  const [showConversationMenu, setShowConversationMenu] = useState(false);
  const [showComposerTools, setShowComposerTools] = useState(false);
  const [isRequestingMicrophone, setIsRequestingMicrophone] = useState(false);
  const [isRecordingVoiceNote, setIsRecordingVoiceNote] = useState(false);
  const [voiceNoteElapsedSeconds, setVoiceNoteElapsedSeconds] = useState(0);
  const [expiryTick, setExpiryTick] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const composerAreaRef = useRef<HTMLDivElement>(null);
  const voiceNoteStreamRef = useRef<MediaStream | null>(null);
  const voiceNoteRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceNoteChunksRef = useRef<Blob[]>([]);
  const voiceNoteTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceNoteMimeTypeRef = useRef('');
  const searchInputId = useId();
  const searchResultsId = useId();
  const messagesLogId = useId();
  const composerInputId = useId();
  const composerHelpId = useId();
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
    scrollToLatestMessage();
  }, [messages, scrollToLatestMessage]);

  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);

  useEffect(() => {
    focusComposer();
  }, [focusComposer]);

  useEffect(() => {
    if (showConversationMenu) {
      return;
    }

    setShowDisappearingMenu(false);
  }, [showConversationMenu]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setRelativeTimeTick((previous) => previous + 1);
    }, 60_000);
    return () => clearInterval(intervalId);
  }, []);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    setTimeout(() => onClose(), 190);
  }, [onClose]);

  const swipeBack = useSwipeBack({ onSwipeBack: handleClose });

  useEffect(() => {
    if (!messages.some((message) => Boolean(message.expires_at))) {
      return;
    }

    const intervalId = setInterval(() => {
      setExpiryTick((previous) => previous + 1);
    }, 15000);

    return () => {
      clearInterval(intervalId);
    };
  }, [messages]);

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
    return () => {
      if (voiceNoteTimerRef.current) {
        clearInterval(voiceNoteTimerRef.current);
      }
      if (voiceNoteRecorderRef.current && voiceNoteRecorderRef.current.state !== 'inactive') {
        voiceNoteRecorderRef.current.onstop = null;
        voiceNoteRecorderRef.current.stop();
      }
      voiceNoteStreamRef.current?.getTracks().forEach((track) => track.stop());
      voiceNoteRecorderRef.current = null;
      voiceNoteStreamRef.current = null;
      voiceNoteTimerRef.current = null;
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
        .from('message_reactions')
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
      setReactionRows((data ?? []) as MessageReactionRow[]);
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
      .channel(`message_reactions:dm_window:${currentUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, (payload) => {
        const incoming = payload.new as MessageReactionRow;
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
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, (payload) => {
        const deleted = payload.old as MessageReactionRow;
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
  }, [currentUserId, enableSupplementalRealtime, messages]);

  useEffect(() => {
    const messageIds = messages.map((message) => message.id);
    if (messageIds.length === 0) {
      setAttachmentRows([]);
      return;
    }

    let isCancelled = false;
    const loadAttachments = async () => {
      const { data, error } = await supabase
        .from('message_attachments')
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
      setAttachmentRows((data ?? []) as MessageAttachmentRow[]);
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
      .channel(`message_attachments:dm_window:${currentUserId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_attachments' }, (payload) => {
        const incoming = payload.new as MessageAttachmentRow;
        if (!messageIdSet.has(incoming.message_id)) {
          return;
        }

        setAttachmentRows((previous) =>
          previous.some((attachment) => attachment.id === incoming.id) ? previous : [...previous, incoming],
        );
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_attachments' }, (payload) => {
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
  }, [currentUserId, enableSupplementalRealtime, messages]);

  const normalizedInitialUnreadCount = Math.max(0, Math.floor(initialUnreadCount));
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleMessages = useMemo(() => {
    const nowMs = Date.now() + expiryTick;
    return filterExpiredMessages(messages, nowMs);
  }, [expiryTick, messages]);
  const messageMatches = useMemo(() => {
    const matches = new Map<number, boolean>();
    if (!normalizedSearchQuery) {
      return matches;
    }

    for (const message of visibleMessages) {
      const plainText = htmlToPlainText(message.content).toLowerCase();
      matches.set(message.id, plainText.includes(normalizedSearchQuery));
    }

    return matches;
  }, [normalizedSearchQuery, visibleMessages]);
  const searchMatchCount = useMemo(
    () => Array.from(messageMatches.values()).filter(Boolean).length,
    [messageMatches],
  );
  const separatorIndex =
    !isLoading && normalizedInitialUnreadCount > 0 && visibleMessages.length > 0
      ? Math.max(0, visibleMessages.length - normalizedInitialUnreadCount)
      : null;

  const reactionSummaryByMessageId = useMemo(() => {
    const summary = new Map<number, Record<string, number>>();

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
    const grouped = new Map<number, MessageAttachmentRow[]>();
    for (const attachment of attachmentRows) {
      const existing = grouped.get(attachment.message_id) ?? [];
      existing.push(attachment);
      grouped.set(attachment.message_id, existing);
    }
    return grouped;
  }, [attachmentRows]);
  const richTextPresentationByMessageId = useMemo(() => {
    const presentation = new Map<number, ReturnType<typeof getRichTextPresentation>>();
    for (const message of visibleMessages) {
      presentation.set(message.id, getRichTextPresentation(message.content));
    }
    return presentation;
  }, [visibleMessages]);
  const visibleOutboxItems = useMemo(() => {
    const deliveredClientIds = new Set(
      visibleMessages
        .map((message) => message.client_msg_id)
        .filter((clientMessageId): clientMessageId is string => Boolean(clientMessageId)),
    );

    return outboxItems.filter((item) => !deliveredClientIds.has(item.id));
  }, [outboxItems, visibleMessages]);
  const messagesById = useMemo(() => {
    return new Map(visibleMessages.map((message) => [message.id, message] as const));
  }, [visibleMessages]);
  const latestOutgoingMessageId = useMemo(() => {
    for (let index = visibleMessages.length - 1; index >= 0; index -= 1) {
      const message = visibleMessages[index];
      if (message.sender_id === currentUserId && !message.deleted_at) {
        return message.id;
      }
    }
    return null;
  }, [currentUserId, visibleMessages]);
  const replyingToMessage = replyingToMessageId ? messagesById.get(replyingToMessageId) ?? null : null;
  const mediaGalleryItems = useMemo<ChatMediaGalleryItem[]>(() => {
    return visibleMessages
      .flatMap((message) => {
        const senderLabel = message.sender_id === currentUserId ? 'You' : buddyScreenname;
        return (attachmentsByMessageId.get(message.id) ?? []).map((attachment) => {
          const { data } = supabase.storage.from(attachment.bucket).getPublicUrl(attachment.storage_path);
          return {
            id: attachment.id,
            fileName: attachment.file_name,
            mimeType: attachment.mime_type,
            sizeBytes: attachment.size_bytes,
            publicUrl: data.publicUrl,
            createdAt: message.created_at,
            senderLabel,
          };
        });
      })
      .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  }, [attachmentsByMessageId, buddyScreenname, currentUserId, visibleMessages]);

  const clearPendingAttachments = useCallback(() => {
    setPendingAttachments([]);
    if (attachmentInputRef.current) {
      attachmentInputRef.current.value = '';
    }
  }, []);

  const appendPendingFiles = useCallback((selected: File[]) => {
    if (selected.length === 0) {
      return;
    }

    const validationError = selected.map((file) => validateChatMediaFile(file)).find(Boolean);
    if (validationError) {
      setAttachmentError(validationError);
      return;
    }

    setAttachmentError(null);
    setVoiceNoteError(null);
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
  }, []);

  const handleSelectAttachments = (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    appendPendingFiles(Array.from(files));
  };

  const stopVoiceNoteRecording = useCallback(
    async (mode: 'save' | 'discard') => {
      const recorder = voiceNoteRecorderRef.current;
      const stream = voiceNoteStreamRef.current;
      if (!recorder) {
        return;
      }

      const stopped = new Promise<void>((resolve) => {
        recorder.onstop = () => {
          const mimeType = voiceNoteMimeTypeRef.current || recorder.mimeType || 'audio/webm';
          const blob = new Blob(voiceNoteChunksRef.current, {
            type: mimeType || 'audio/webm',
          });
          voiceNoteChunksRef.current = [];
          stream?.getTracks().forEach((track) => track.stop());
          voiceNoteRecorderRef.current = null;
          voiceNoteStreamRef.current = null;
          voiceNoteMimeTypeRef.current = '';
          setIsRecordingVoiceNote(false);
          setVoiceNoteElapsedSeconds(0);
          if (voiceNoteTimerRef.current) {
            clearInterval(voiceNoteTimerRef.current);
            voiceNoteTimerRef.current = null;
          }

          if (mode === 'save' && blob.size > 0) {
            const extension = getVoiceNoteExtension(mimeType);
            const file = new File(
              [blob],
              `buddylist-voice-note-${Date.now()}.${extension}`,
              { type: mimeType || 'audio/webm', lastModified: Date.now() },
            );
            appendPendingFiles([file]);
          }

          resolve();
        };
      });

      if (recorder.state === 'inactive') {
        return;
      }

      recorder.stop();
      await stopped;
    },
    [appendPendingFiles],
  );

  const startVoiceNoteRecording = useCallback(async () => {
    if (isRecordingVoiceNote || isRequestingMicrophone) {
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceNoteError('Voice notes are not supported on this device.');
      return;
    }

    setVoiceNoteError(null);
    setAttachmentError(null);
    setIsRequestingMicrophone(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedVoiceNoteMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      voiceNoteRecorderRef.current = recorder;
      voiceNoteStreamRef.current = stream;
      voiceNoteMimeTypeRef.current = mimeType;
      voiceNoteChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          voiceNoteChunksRef.current.push(event.data);
        }
      };
      recorder.start();
      setVoiceNoteElapsedSeconds(0);
      setIsRecordingVoiceNote(true);
      if (voiceNoteTimerRef.current) {
        clearInterval(voiceNoteTimerRef.current);
      }
      voiceNoteTimerRef.current = setInterval(() => {
        setVoiceNoteElapsedSeconds((previous) => previous + 1);
      }, 1000);
      void hapticLight();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Microphone access failed.';
      setVoiceNoteError(message);
    } finally {
      setIsRequestingMicrophone(false);
    }
  }, [isRecordingVoiceNote, isRequestingMicrophone]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if ((!trimmed && pendingAttachments.length === 0) || isSending) {
      return;
    }

    try {
      const formatted = trimmed ? formatRichText(trimmed, format) : '';
      const includesOnlyAudioAttachment =
        pendingAttachments.length === 1 &&
        pendingAttachments[0] &&
        getAttachmentKind(pendingAttachments[0].type) === 'audio';
      await Promise.resolve(
        onSendMessage({
          content: formatted,
          attachments: pendingAttachments,
          replyToMessageId: replyingToMessageId,
          previewType:
            pendingAttachments.length > 0 && !trimmed
              ? includesOnlyAudioAttachment
                ? 'voice_note'
                : 'attachment'
              : 'text',
        }),
      );
      setDraft('');
      setReplyingToMessageId(null);
      onDraftChange?.('');
      clearPendingAttachments();
      setAttachmentError(null);
      setVoiceNoteError(null);
      if (typeof window !== 'undefined') {
        window.requestAnimationFrame(() => {
          focusComposer();
        });
      }
      void hapticSuccess();
      playMessageSendSound();
    } catch {
      void hapticWarning();
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
    if (isSending || (!draft.trim() && pendingAttachments.length === 0)) {
      return;
    }

    textarea.form?.requestSubmit();
  };

  const handleDraftChange = (nextValue: string) => {
    setDraft(nextValue);
    onDraftChange?.(nextValue);
    if (nextValue.trim()) {
      onTypingActivity?.();
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

  const startEditingMessage = (message: ChatMessage) => {
    if (message.sender_id !== currentUserId || message.deleted_at) {
      return;
    }

    void hapticLight();
    setEditingMessageId(message.id);
    setEditDraft(htmlToPlainText(message.content));
  };

  const cancelEditingMessage = () => {
    setEditingMessageId(null);
    setEditDraft('');
  };

  const saveEditedMessage = async (messageId: number) => {
    const trimmed = editDraft.trim();
    if (!trimmed || isSavingEdit) {
      return;
    }

    setIsSavingEdit(true);
    const updatedContent = formatRichText(trimmed, DEFAULT_RICH_TEXT_FORMAT);
    const { error } = await supabase
      .from('messages')
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

  const softDeleteMessage = async (messageId: number) => {
    if (isDeletingMessageId === messageId) {
      return;
    }

    setIsDeletingMessageId(messageId);
    const { error } = await supabase
      .from('messages')
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
      if (next && pendingAttachments.length === 0 && !isRecordingVoiceNote) {
        setShowComposerTools(false);
      }
      return next;
    });
  };

  const startReplyingToMessage = (message: ChatMessage) => {
    if (message.deleted_at) {
      return;
    }

    setReplyingToMessageId(message.id);
    setLongPressMessageId(null);
    void hapticLight();
    window.requestAnimationFrame(() => {
      focusComposer();
    });
  };

  const cancelReply = () => {
    setReplyingToMessageId(null);
  };

  const formatDeliveryStatus = (message: ChatMessage) => {
    if (message.read_at) {
      return {
        label: 'Read',
        detail: new Date(message.read_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
    }

    if (message.delivered_at) {
      return {
        label: 'Delivered',
        detail: null,
      };
    }

    return {
      label: 'Sent',
      detail: null,
    };
  };

  const renderAttachmentPreview = (
    attachment: MessageAttachmentRow,
    options: { isMine: boolean; previewType?: string | null },
  ) => {
    const kind = getAttachmentKind(attachment.mime_type);
    const { data } = supabase.storage.from(attachment.bucket).getPublicUrl(attachment.storage_path);
    const linkToneClass = options.isMine ? 'text-blue-200' : 'text-blue-600';

    if (kind === 'image') {
      return (
        <a
          key={attachment.id}
          href={data.publicUrl}
          target="_blank"
          rel="noreferrer"
          className="ui-focus-ring block overflow-hidden rounded-[1rem] border border-white/30 bg-black/5"
          aria-label={`Open image attachment ${attachment.file_name}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={data.publicUrl} alt={attachment.file_name} className="max-h-64 w-full object-cover" />
        </a>
      );
    }

    if (kind === 'video') {
      return (
        <video
          key={attachment.id}
          controls
          preload="metadata"
          playsInline
          className="block max-h-64 w-full rounded-[1rem] border border-white/30 bg-black/20"
          src={data.publicUrl}
        />
      );
    }

    if (kind === 'audio') {
      return (
        <div
          key={attachment.id}
          className={`rounded-[1rem] border px-3 py-2 ${
            options.isMine
              ? 'border-white/20 bg-white/10'
              : 'border-slate-200 bg-slate-100/80 dark:border-slate-700 dark:bg-slate-900/70'
          }`}
        >
          <div className="mb-2 flex items-center gap-2">
            <AppIcon kind="mic" className={`h-3.5 w-3.5 ${linkToneClass}`} />
            <p className={`text-[length:var(--ui-text-2xs)] font-semibold ${linkToneClass}`}>
              {options.previewType === 'voice_note' ? 'Voice note' : attachment.file_name}
              {attachment.size_bytes ? ` · ${formatFileSize(attachment.size_bytes)}` : ''}
            </p>
          </div>
          <audio controls preload="metadata" className="w-full" src={data.publicUrl} />
        </div>
      );
    }

    return (
      <a
        key={attachment.id}
        href={data.publicUrl}
        target="_blank"
        rel="noreferrer"
        className={`ui-focus-ring block rounded-lg text-[length:var(--ui-text-2xs)] underline ${linkToneClass}`}
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
  };

  const disappearingTimerShortLabel = formatDisappearingTimerLabel(disappearingTimerSeconds, { short: true });

  const xpTinyToolbarButtonClass = (active = false) =>
    `ui-focus-ring inline-flex h-7 min-w-7 items-center justify-center rounded-lg border px-1.5 text-[length:var(--ui-text-xs)] font-semibold text-slate-700 transition ${
      active
        ? 'border-blue-400/70 bg-blue-50 text-blue-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:border-blue-400/50 dark:bg-blue-500/15 dark:text-blue-200'
        : 'border-slate-200 bg-white/80 hover:bg-white dark:border-slate-700 dark:bg-slate-950/65 dark:text-slate-200 dark:hover:bg-slate-900'
    }`;
  const presenceToneClass =
    buddyPresenceState === 'away'
      ? 'text-amber-500'
      : buddyPresenceState === 'idle'
        ? 'text-sky-500'
        : buddyPresenceState === 'offline'
          ? 'text-slate-400'
          : 'text-emerald-500';
  const chatShellStyle =
    isKeyboardOpen && viewportHeight ? ({ height: `${viewportHeight}px` } satisfies CSSProperties) : undefined;
  const messagesAreaStyle =
    composerAreaHeight > 0
      ? ({ scrollPaddingBottom: `${composerAreaHeight + 16}px` } satisfies CSSProperties)
      : undefined;
  const composerAreaStyle = {
    paddingBottom: isKeyboardOpen ? '0.75rem' : 'calc(env(safe-area-inset-bottom) + 0.75rem)',
  } satisfies CSSProperties;
  const composerToolsExpanded = showComposerTools || pendingAttachments.length > 0 || isRecordingVoiceNote;
  const attachmentSummaryLabel =
    pendingAttachments.length > 0
      ? `${pendingAttachments.length} file${pendingAttachments.length === 1 ? '' : 's'} ready`
      : null;

  return (
    <div
      className={`fixed inset-0 z-40 ${isClosing ? 'chat-slide-out' : 'chat-slide-in'}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Chat with ${buddyScreenname}`}
      data-chat-theme={themeKey ?? undefined}
      {...swipeBack}
    >
      <RetroWindow
        title={`IM with ${buddyScreenname}`}
        variant="xp_shell"
        xpTitleText={`Instant Message — ${buddyScreenname}`}
        xpSubtitleText={buddyPresenceDetail}
        headerActions={
          nativeShellActive ? undefined : (
            <>
              <button
                type="button"
                onClick={handleClose}
                className="ui-focus-ring ui-window-header-button px-2.5 text-[11px] font-semibold"
                aria-label={`Close chat with ${buddyScreenname}`}
                title="Close chat"
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => setShowConversationMenu((previous) => !previous)}
                className="ui-focus-ring ui-window-header-button px-2.5 text-[11px] font-semibold"
                aria-expanded={showConversationMenu}
                aria-label={`Open conversation controls for ${buddyScreenname}`}
                title="Conversation controls"
              >
                <AppIcon kind="menu" className="h-4 w-4" />
              </button>
            </>
          )
        }
        onXpClose={handleClose}
        onXpSignOff={onSignOff}
        style={chatShellStyle}
        hideHeader={nativeShellActive}
      >
        <div className="ui-window-panel flex h-full min-h-0 flex-col rounded-[1.4rem] text-[length:var(--ui-text-md)]">
          <div className="mx-3 mt-3 space-y-2.5">
            <div className="ui-conversation-header rounded-[1.25rem] px-3.5 py-3">
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  onClick={onOpenProfile}
                  className="ui-focus-ring flex min-w-0 flex-1 items-center gap-3 text-left"
                  disabled={!onOpenProfile}
                  aria-label={
                    onOpenProfile ? `Open profile for ${buddyScreenname}` : `${buddyScreenname} profile is unavailable`
                  }
                >
                  <ProfileAvatar
                    screenname={buddyScreenname}
                    buddyIconPath={buddyIconPath}
                    presenceState={buddyPresenceState}
                    size="md"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-semibold text-slate-800 dark:text-slate-100">
                        {buddyScreenname}
                      </span>
                      <span className={`text-[11px] font-semibold ${presenceToneClass}`}>
                        {buddyPresenceDetail}
                      </span>
                    </div>
                    {buddyStatusLine ? (
                      <p className="mt-0.5 truncate text-[12px] text-slate-500 dark:text-slate-400">{buddyStatusLine}</p>
                    ) : null}
                    {buddyStatusMessage ? (
                      <p
                        className="aim-rich-html mt-0.5 truncate italic text-[11px] text-slate-400 dark:text-slate-500"
                        dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(buddyStatusMessage) }}
                      />
                    ) : buddyBio ? (
                      <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">{buddyBio}</p>
                    ) : null}
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setShowConversationMenu((previous) => !previous)}
                  className="ui-focus-ring ui-conversation-action shrink-0"
                  aria-expanded={showConversationMenu}
                  aria-label={`Open conversation controls for ${buddyScreenname}`}
                >
                  <AppIcon kind="menu" className="h-4 w-4" />
                </button>
              </div>
              {buddyPresenceState === 'away' && buddyStatusLine ? (
                <div className="mt-3 rounded-2xl bg-amber-50/90 px-3 py-2 text-[11px] font-medium text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
                  {buddyStatusLine}
                </div>
              ) : null}
            </div>

            {showConversationMenu ? (
              <div className="ui-conversation-menu rounded-[1.25rem] px-3.5 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="ui-section-kicker">Conversation controls</p>
                    <p className="mt-1 text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                      Search, appearance, and message behavior.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowConversationMenu(false)}
                    className="ui-focus-ring ui-conversation-action"
                    aria-label="Close conversation controls"
                  >
                    <AppIcon kind="close" className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-3 space-y-3">
                  <div className="rounded-[1rem] border border-white/60 bg-white/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/55">
                    <label htmlFor={searchInputId} className="ui-section-kicker">Search</label>
                    <div className="mt-2 flex items-center gap-2">
                      <AppIcon kind="search" className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <input
                        id={searchInputId}
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search this conversation"
                        aria-describedby={normalizedSearchQuery ? searchResultsId : undefined}
                        className="ui-focus-ring min-w-0 flex-1 rounded-xl bg-transparent py-1 text-[12px] text-slate-700 placeholder-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                      />
                      {searchQuery ? (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          className="ui-focus-ring ui-conversation-action"
                          aria-label="Clear conversation search"
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

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setMediaGalleryFilter('all');
                        setShowMediaGallery(true);
                        setShowConversationMenu(false);
                      }}
                      className="ui-focus-ring ui-button-secondary ui-button-compact"
                    >
                      Media
                    </button>
                    <button
                      type="button"
                      onClick={onTogglePinned}
                      className="ui-focus-ring ui-button-secondary ui-button-compact"
                      aria-pressed={isPinned}
                    >
                      {isPinned ? 'Pinned' : 'Pin'}
                    </button>
                    <button
                      type="button"
                      onClick={onToggleMuted}
                      className="ui-focus-ring ui-button-secondary ui-button-compact"
                      aria-pressed={isMuted}
                    >
                      {isMuted ? 'Muted' : 'Mute'}
                    </button>
                    <button
                      type="button"
                      onClick={onToggleArchived}
                      className="ui-focus-ring ui-button-secondary ui-button-compact"
                      aria-pressed={isArchived}
                    >
                      {isArchived ? 'Move to inbox' : 'Archive'}
                    </button>
                  </div>

                  <div className="rounded-[1rem] border border-white/60 bg-white/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/55">
                    <div className="flex items-center justify-between gap-2">
                      <span className="ui-section-kicker">Disappearing messages</span>
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setShowDisappearingMenu((previous) => !previous)}
                          className="ui-focus-ring ui-conversation-action"
                          aria-expanded={showDisappearingMenu}
                          aria-label={`Disappearing messages timer: ${formatDisappearingTimerLabel(disappearingTimerSeconds)}`}
                        >
                          {disappearingTimerShortLabel}
                        </button>
                        {showDisappearingMenu ? (
                          <div className="absolute right-0 top-[calc(100%+0.35rem)] z-10 min-w-[10rem] rounded-[1.1rem] border border-white/70 bg-white/95 p-1.5 shadow-[0_16px_36px_rgba(15,23,42,0.18)] backdrop-blur-md dark:border-slate-800 dark:bg-slate-950/95">
                            {DISAPPEARING_TIMER_OPTIONS.map((option) => (
                              <button
                                key={option ?? 'off'}
                                type="button"
                                onClick={() => {
                                  onSetDisappearingTimer?.(option);
                                  setShowDisappearingMenu(false);
                                }}
                                className={`ui-focus-ring flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[length:var(--ui-text-xs)] font-semibold ${
                                  disappearingTimerSeconds === option
                                    ? 'bg-blue-500 text-white'
                                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900'
                                }`}
                              >
                                <span>{option ? formatDisappearingTimerLabel(option) : 'Off'}</span>
                                {disappearingTimerSeconds === option ? <span>•</span> : null}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {onChangeTheme ? (
                    <div className="rounded-[1rem] border border-white/60 bg-white/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/55">
                      <span className="ui-section-kicker">Theme</span>
                      <div className="mt-2 flex items-center gap-1.5">
                        {([
                          { key: null, color: 'bg-blue-500' },
                          { key: 'rose', color: 'bg-rose-500' },
                          { key: 'violet', color: 'bg-violet-500' },
                          { key: 'emerald', color: 'bg-emerald-500' },
                          { key: 'amber', color: 'bg-amber-500' },
                          { key: 'sky', color: 'bg-sky-500' },
                        ] as const).map((themeOption) => (
                          <button
                            key={themeOption.key ?? 'default'}
                            type="button"
                            onClick={() => onChangeTheme(themeOption.key)}
                            className={`ui-focus-ring h-6 w-6 rounded-full ${themeOption.color} transition-transform hover:scale-110 ${
                              themeKey === themeOption.key ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-300 scale-110' : 'opacity-70'
                            }`}
                            title={themeOption.key ?? 'Default'}
                            aria-pressed={themeKey === themeOption.key}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {onChangeWallpaper ? (
                    <div className="rounded-[1rem] border border-white/60 bg-white/70 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/55">
                      <span className="ui-section-kicker">Wallpaper</span>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {([
                          { key: null, label: 'Dots', icon: '·' },
                          { key: 'grid', label: 'Grid', icon: '▦' },
                          { key: 'diamonds', label: 'Diamonds', icon: '◇' },
                          { key: 'waves', label: 'Waves', icon: '∿' },
                          { key: 'stars', label: 'Stars', icon: '✦' },
                          { key: 'none', label: 'None', icon: '∅' },
                        ] as const).map((wallpaperOption) => (
                          <button
                            key={wallpaperOption.key ?? 'default'}
                            type="button"
                            onClick={() => onChangeWallpaper(wallpaperOption.key)}
                            className={`ui-focus-ring flex h-7 min-w-7 items-center justify-center rounded-xl border px-2 text-[11px] transition-transform hover:scale-105 ${
                              wallpaperKey === wallpaperOption.key
                                ? 'border-slate-400 bg-white/85 font-bold text-slate-700 dark:bg-slate-800/80 dark:text-slate-200'
                                : 'border-slate-200 text-slate-400 dark:border-slate-700'
                            }`}
                            title={wallpaperOption.label}
                            aria-pressed={wallpaperKey === wallpaperOption.key}
                          >
                            {wallpaperOption.icon}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          {/* Messages area */}
          <div
            id={messagesLogId}
            role="log"
            aria-live="polite"
            aria-relevant="additions text"
            aria-busy={isLoading}
            aria-label={`Conversation with ${buddyScreenname}`}
            className={`ui-chat-log mx-3 mt-1.5 min-h-0 flex-1 overflow-y-auto rounded-2xl px-3 py-3 ${wallpaperKey === 'grid' ? 'ui-chat-wallpaper-grid' : wallpaperKey === 'diamonds' ? 'ui-chat-wallpaper-diamonds' : wallpaperKey === 'waves' ? 'ui-chat-wallpaper-waves' : wallpaperKey === 'stars' ? 'ui-chat-wallpaper-stars' : wallpaperKey === 'none' ? 'ui-chat-wallpaper-none' : 'ui-chat-wallpaper'}`}
            style={messagesAreaStyle}
          >
            {isLoading && (
              <div className="flex flex-col gap-3 pt-2 ui-fade-in">
                {[40, 65, 50, 75, 35, 60].map((widthPercent, i) => (
                  <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                    <div className="ui-skeleton h-9 rounded-2xl" style={{ width: `${widthPercent}%` }} />
                  </div>
                ))}
              </div>
            )}
            {!isLoading && visibleMessages.length === 0 && (
              <div className="ui-empty-state h-full px-6 ui-fade-in">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
                  <AppIcon kind="mail" className="h-7 w-7 text-blue-400" />
                </div>
                <div>
                  <p className="text-[length:var(--ui-text-md)] font-semibold text-slate-500">No messages yet</p>
                  <p className="mt-0.5 text-[length:var(--ui-text-xs)] text-slate-400">
                    Send a message to start the conversation
                  </p>
                </div>
              </div>
            )}
            {!isLoading && (
              <div
                className="flex flex-col gap-0.5"
                onClick={() => {
                  setLongPressMessageId(null);
                  setShowDisappearingMenu(false);
                  setShowConversationMenu(false);
                }}
              >
                {visibleMessages.map((message, index) => {
                  const isMine = message.sender_id === currentUserId;
                  const isDeleted = Boolean(message.deleted_at);
                  const isEditing = editingMessageId === message.id;
                  const isMatch = normalizedSearchQuery ? Boolean(messageMatches.get(message.id)) : false;
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
                  void relativeTimeTick;
                  const clusterMeta = getConversationClusterMeta(visibleMessages, index);
                  const dividerLabel = formatConversationDividerLabel(message.created_at);
                  const metaTimeLabel = formatConversationMetaTime(message.created_at);
                  const replySourceMessage = message.reply_to_message_id
                    ? messagesById.get(message.reply_to_message_id) ?? null
                    : null;
                  const incomingAvatar = !isMine ? (
                    clusterMeta.isFirstInRun ? (
                      <ProfileAvatar
                        screenname={buddyScreenname}
                        buddyIconPath={buddyIconPath}
                        presenceState={buddyPresenceState}
                        size="sm"
                        className="mb-1"
                      />
                    ) : (
                      <div className="h-9 w-9" />
                    )
                  ) : null;
                  const swipeLabel = isMine ? 'Reply' : 'Reply';

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

                      <div
                        className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${
                          normalizedSearchQuery && !isMatch ? 'opacity-35' : ''
                        }`}
                      >
                        <div className={`flex w-full items-end gap-2 ${isMine ? 'justify-end' : 'justify-start'}`}>
                          {incomingAvatar}
                          <SwipeActionFrame
                            align={isMine ? 'end' : 'start'}
                            enabled={!isDeleted && !isEditing && message.preview_type !== 'buzz'}
                            label={swipeLabel}
                            onTrigger={() => startReplyingToMessage(message)}
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
                                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-200">
                                    {buddyScreenname}
                                  </span>
                                  <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                                    {metaTimeLabel}
                                  </span>
                                </div>
                              ) : null}

                              {message.preview_type === 'buzz' && !isDeleted ? (
                                <div className="buzz-shake my-2 flex items-center justify-center gap-2 rounded-2xl border border-amber-300/60 bg-amber-50/80 px-4 py-2.5 text-[length:var(--ui-text-sm)] font-semibold text-amber-700 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-400">
                                  <AppIcon kind="bolt" className="h-4 w-4" />
                                  <span>
                                    {isMine ? 'You buzzed' : `${buddyScreenname} buzzed you`}
                                    <span className="ml-1 font-normal text-amber-500">!</span>
                                  </span>
                                </div>
                              ) : null}

                              {message.preview_type !== 'buzz' ? (
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
                                        ? `rounded-[1.35rem] border border-blue-200/80 bg-white/96 text-slate-900 shadow-[0_10px_24px_rgba(37,99,235,0.16)] ${
                                            clusterMeta.isLastInRun ? 'rounded-br-[8px] bubble-tail-out' : ''
                                          }`
                                        : `rounded-[1.35rem] text-white shadow-[0_8px_22px_rgba(37,99,235,0.26)] ${
                                            clusterMeta.isLastInRun ? 'rounded-br-[7px] bubble-tail-out' : ''
                                          }`
                                      : `rounded-[1.35rem] border border-white/70 bg-white/85 text-slate-800 shadow-sm backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-950/70 dark:text-slate-100 ${
                                          clusterMeta.isLastInRun ? 'rounded-bl-[7px] bubble-tail-in' : ''
                                        }`
                                  } ${isMatch ? 'ring-2 ring-amber-400' : ''} ${!isDeleted && !isEditing ? 'ui-focus-ring' : ''}`}
                                  style={isMine && !hasCustomStyling ? { background: 'var(--chat-accent, #3b82f6)' } : undefined}
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
                                        maxLength={1000}
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
                                    <div className="space-y-1.5">
                                      {message.forward_source_message_id ? (
                                        <p className={`text-[length:var(--ui-text-2xs)] font-semibold uppercase tracking-[0.14em] ${
                                          isMine ? (hasCustomStyling ? 'text-slate-400' : 'text-blue-200') : 'text-slate-400'
                                        }`}>
                                          Forwarded
                                        </p>
                                      ) : null}
                                      {replySourceMessage ? (
                                        <div
                                          className={`rounded-xl border px-2.5 py-1.5 text-[length:var(--ui-text-2xs)] ${
                                            isMine
                                              ? hasCustomStyling
                                                ? 'border-slate-200 bg-slate-100/80 text-slate-500'
                                                : 'border-white/20 bg-white/15 text-blue-100'
                                              : 'border-slate-200 bg-slate-100/80 text-slate-500 dark:border-slate-700 dark:bg-slate-900/65 dark:text-slate-300'
                                          }`}
                                        >
                                          <p className="font-semibold">
                                            {replySourceMessage.sender_id === currentUserId ? 'You' : buddyScreenname}
                                          </p>
                                          <p className="truncate">
                                            {replySourceMessage.deleted_at
                                              ? 'Message deleted'
                                              : htmlToPlainText(replySourceMessage.content) || 'Original message'}
                                          </p>
                                        </div>
                                      ) : null}
                                      <span
                                        className={`aim-rich-html ${hasCustomStyling ? 'aim-rich-html--styled' : ''}`}
                                        dangerouslySetInnerHTML={{ __html: richTextPresentation.html }}
                                      />
                                    </div>
                                  )}
                                  {isEdited && !isEditing ? (
                                    <span className={`ml-1.5 text-[length:var(--ui-text-2xs)] ${
                                      isMine ? (hasCustomStyling ? 'text-slate-400' : 'text-blue-200') : 'text-slate-400'
                                    }`}>
                                      (edited)
                                    </span>
                                  ) : null}
                                </div>
                              ) : null}

                              {!isDeleted && !isEditing ? (
                                <div
                                  data-swipe-ignore="true"
                                  className={`absolute -top-8 right-0 items-center gap-0.5 rounded-full border border-white/70 bg-white/90 px-2 py-1 shadow-lg backdrop-blur-md ui-fade-in dark:border-slate-700/70 dark:bg-slate-950/88 ${
                                    longPressMessageId === message.id ? 'flex' : 'hidden group-hover:flex group-focus-within:flex'
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => startReplyingToMessage(message)}
                                    className="ui-focus-ring rounded-full px-2.5 py-1 text-[length:var(--ui-text-xs)] font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                                    aria-label={`Reply to message sent at ${metaTimeLabel}`}
                                  >
                                    Reply
                                  </button>
                                  {onForwardMessage ? (
                                    <>
                                      <span className="text-slate-300">·</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onForwardMessage(message);
                                          setLongPressMessageId(null);
                                        }}
                                        className="ui-focus-ring rounded-full px-2.5 py-1 text-[length:var(--ui-text-xs)] font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                                        aria-label={`Forward message sent at ${metaTimeLabel}`}
                                      >
                                        Forward
                                      </button>
                                    </>
                                  ) : null}
                                  {onSaveMessage ? (
                                    <>
                                      <span className="text-slate-300">·</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onSaveMessage(message);
                                          setLongPressMessageId(null);
                                        }}
                                        className="ui-focus-ring rounded-full px-2.5 py-1 text-[length:var(--ui-text-xs)] font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                                        aria-label={`Save message sent at ${metaTimeLabel}`}
                                      >
                                        Save
                                      </button>
                                    </>
                                  ) : null}
                                  {isMine ? (
                                    <>
                                      <span className="text-slate-300">·</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          startEditingMessage(message);
                                          setLongPressMessageId(null);
                                        }}
                                        className="ui-focus-ring rounded-full px-2.5 py-1 text-[length:var(--ui-text-xs)] font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900"
                                        aria-label={`Edit message sent at ${metaTimeLabel}`}
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
                                        aria-label={`Delete message sent at ${metaTimeLabel}`}
                                      >
                                        {isDeletingMessageId === message.id ? '…' : 'Delete'}
                                      </button>
                                    </>
                                  ) : null}
                                </div>
                              ) : null}

                              {!isDeleted && reactionEntries.length > 0 ? (
                                <div className={`-mt-1 mb-1 flex flex-wrap gap-0.5 ${isMine ? 'justify-end' : 'justify-start'}`}>
                                  {reactionEntries.map(([emoji, count]) => (
                                    <span
                                      key={`${message.id}-${emoji}`}
                                      className="rounded-full border border-white/70 bg-white/85 px-1.5 py-[2px] text-[length:var(--ui-text-2xs)] text-slate-600 shadow-sm backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-950/85 dark:text-slate-200"
                                    >
                                      {emoji} {count}
                                    </span>
                                  ))}
                                </div>
                              ) : null}

                              {!isDeleted && messageAttachments.length > 0 ? (
                                <div className={`-mt-1 mb-1 space-y-1 ${isMine ? 'text-right' : ''}`}>
                                  {messageAttachments.map((attachment) =>
                                    renderAttachmentPreview(attachment, {
                                      isMine,
                                      previewType: message.preview_type,
                                    }),
                                  )}
                                </div>
                              ) : null}
                              {latestOutgoingMessageId === message.id && isMine && !isEditing && !isDeleted && message.preview_type !== 'buzz' ? (
                                <p className="mt-1 flex items-center justify-end gap-1 text-right text-[length:var(--ui-text-2xs)] text-slate-400">
                                  {showReadReceipts && message.read_at ? (
                                    <svg width="14" height="8" viewBox="0 0 14 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400" aria-hidden="true">
                                      <path d="M1 4l3 3L10 1" /><path d="M5 4l3 3 5-6" />
                                    </svg>
                                  ) : showReadReceipts && message.delivered_at ? (
                                    <svg width="14" height="8" viewBox="0 0 14 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400" aria-hidden="true">
                                      <path d="M1 4l3 3L10 1" /><path d="M5 4l3 3 5-6" />
                                    </svg>
                                  ) : (
                                    <svg width="10" height="8" viewBox="0 0 10 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-300" aria-hidden="true">
                                      <path d="M1 4l3 3 5-6" />
                                    </svg>
                                  )}
                                  <span>
                                    {showReadReceipts ? formatDeliveryStatus(message).label : 'Sent'}
                                    {showReadReceipts && formatDeliveryStatus(message).detail ? ` · ${formatDeliveryStatus(message).detail}` : ''}
                                  </span>
                                </p>
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
          {voiceNoteError ? (
            <p role="alert" className="mx-3 mt-1 text-[length:var(--ui-text-2xs)] text-red-600">
              {voiceNoteError}
            </p>
          ) : null}

          {/* Typing indicator — ghost bubble */}
          {typingText ? (
            <div className="msg-enter mx-3 mt-1.5 flex items-end gap-2" role="status" aria-live="polite" aria-atomic="true">
              <ProfileAvatar
                screenname={buddyScreenname}
                buddyIconPath={buddyIconPath}
                presenceState={buddyPresenceState}
                size="sm"
                showStatusDot={false}
              />
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
            {replyingToMessage ? (
              <div className="ui-compose-context-chip flex items-start justify-between gap-3 rounded-2xl px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[length:var(--ui-text-2xs)] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Replying to {replyingToMessage.sender_id === currentUserId ? 'You' : buddyScreenname}
                  </p>
                  <p className="truncate text-[length:var(--ui-text-xs)] text-slate-600 dark:text-slate-200">
                    {replyingToMessage.deleted_at
                      ? 'Message deleted'
                      : htmlToPlainText(replyingToMessage.content).trim() || 'Original message'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={cancelReply}
                  className="ui-focus-ring rounded-full p-1 text-slate-400 hover:text-slate-600"
                  aria-label="Cancel reply"
                >
                  <AppIcon kind="close" className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {!isKeyboardOpen ? (
                  <button
                    type="button"
                    onClick={focusComposer}
                    className={`${xpTinyToolbarButtonClass()} px-2.5`}
                    aria-label={`Reopen the keyboard for ${buddyScreenname}`}
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
                      aria-label={`Attach files to your message to ${buddyScreenname}`}
                      title="Attach files"
                    >
                      <AppIcon kind="attachment" className="h-3.5 w-3.5" />
                      <span>Attachment</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (isRecordingVoiceNote) {
                          void stopVoiceNoteRecording('save');
                          return;
                        }
                        void startVoiceNoteRecording();
                      }}
                      disabled={isRequestingMicrophone}
                      className={`${xpTinyToolbarButtonClass(isRecordingVoiceNote)} h-8 gap-1.5 px-3 ${isRequestingMicrophone ? 'opacity-60' : ''}`}
                      aria-label={isRecordingVoiceNote ? 'Stop voice note recording' : `Record a voice note for ${buddyScreenname}`}
                      title={isRecordingVoiceNote ? 'Stop recording' : 'Record voice note'}
                    >
                      <AppIcon kind="mic" className="h-3.5 w-3.5" />
                      <span>{isRecordingVoiceNote ? 'Save voice' : 'Voice'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMediaGalleryFilter('all');
                        setShowMediaGallery(true);
                      }}
                      className={`${xpTinyToolbarButtonClass(showMediaGallery)} h-8 gap-1.5 px-3`}
                      aria-label={`Open media gallery for ${buddyScreenname}`}
                      title="Media gallery"
                    >
                      <AppIcon kind="media" className="h-3.5 w-3.5" />
                      <span>Media</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        void hapticWarning();
                        void playUiSound('/sounds/aim.mp3', { volume: 0.5 });
                        void onSendMessage({ content: '', previewType: 'buzz' });
                      }}
                      className={`${xpTinyToolbarButtonClass()} h-8 gap-1.5 px-3 text-amber-500`}
                      aria-label={`Buzz ${buddyScreenname}`}
                      title="Buzz!"
                    >
                      <AppIcon kind="bolt" className="h-3.5 w-3.5" />
                      <span>Buzz</span>
                    </button>
                    <input
                      ref={attachmentInputRef}
                      type="file"
                      multiple
                      onChange={(event) => handleSelectAttachments(event.target.files)}
                      className="hidden"
                      aria-label={`Choose attachments for your message to ${buddyScreenname}`}
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

                {isRecordingVoiceNote ? (
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/65 px-3 py-2 dark:border-slate-700 dark:bg-slate-950/55">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                      <div>
                        <p className="text-[length:var(--ui-text-xs)] font-semibold text-slate-700 dark:text-slate-100">
                          Recording voice note
                        </p>
                        <p className="text-[length:var(--ui-text-2xs)] text-slate-400">
                          {formatRecordingDuration(voiceNoteElapsedSeconds)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void stopVoiceNoteRecording('discard')}
                        className="ui-focus-ring ui-button-secondary ui-button-compact rounded-full px-3"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void stopVoiceNoteRecording('save')}
                        className="ui-focus-ring ui-button-primary ui-button-compact rounded-full px-3"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : null}

                {pendingAttachments.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {pendingAttachments.map((file, index) => (
                      <div
                        key={`${file.name}-${file.size}-${file.lastModified}`}
                        className="ui-compose-summary-pill inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1.5"
                      >
                        <AppIcon kind={getAttachmentKind(file.type) === 'audio' ? 'mic' : 'attachment'} className="h-3 w-3 shrink-0" />
                        <span className="truncate text-[length:var(--ui-text-2xs)]">
                          {getAttachmentKind(file.type) === 'audio' ? 'Voice note' : file.name}
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
              onSubmit={handleSubmit}
              className="ui-compose-surface flex items-end gap-2 rounded-2xl px-3.5 py-2.5"
            >
              <label htmlFor={composerInputId} className="sr-only">
                Message {buddyScreenname}
              </label>
              <textarea
                id={composerInputId}
                ref={composerRef}
                value={draft}
                onChange={(event) => handleDraftChange(event.target.value)}
                onKeyDown={handleDraftKeyDown}
                onFocus={() => {
                  focusComposer();
                }}
                placeholder={replyingToMessage ? `Reply to ${buddyScreenname}…` : 'Message…'}
                rows={1}
                maxLength={1000}
                aria-describedby={composerHelpId}
                className="ui-focus-ring min-h-[24px] flex-1 resize-none rounded-xl bg-transparent text-[length:var(--ui-text-md)] text-slate-800 placeholder-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
                style={composerTextStyle}
              />
              {(draft.trim() || pendingAttachments.length > 0) ? (
                <button
                  type="submit"
                  disabled={isSending}
                  className="ui-focus-ring ui-button-primary mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-0 text-[length:var(--ui-text-md)] font-bold disabled:opacity-60"
                  aria-label={`Send message to ${buddyScreenname}`}
                >
                  {isSending ? '…' : '↑'}
                </button>
              ) : null}
            </form>
          </div>
        </div>
      </RetroWindow>
      {showMediaGallery ? (
        <ChatMediaGallerySheet
          title={`Shared Media — ${buddyScreenname}`}
          items={mediaGalleryItems}
          filter={mediaGalleryFilter}
          onFilterChange={setMediaGalleryFilter}
          onClose={() => setShowMediaGallery(false)}
        />
      ) : null}
    </div>
  );
}
