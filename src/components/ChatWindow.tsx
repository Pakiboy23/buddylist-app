'use client';

import { FormEvent, KeyboardEvent, type CSSProperties, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import AppIcon from '@/components/AppIcon';
import ProfileAvatar from '@/components/ProfileAvatar';
import RetroWindow from '@/components/RetroWindow';
import RichTextToolbar from '@/components/RichTextToolbar';
import type { OutboxItem } from '@/lib/outbox';
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
  RichTextFormat,
  sanitizeRichTextHtml,
} from '@/lib/richText';
import { hapticLight, hapticSuccess, hapticWarning } from '@/lib/haptics';
import { useKeyboardViewport } from '@/hooks/useKeyboardViewport';
import { useSwipeBack } from '@/hooks/useSwipeBack';
import type { ResolvedPresenceState } from '@/lib/presence';
import { supabase } from '@/lib/supabase';

export interface ChatMessage {
  id: number;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  client_msg_id?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
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
  onSendMessage: (content: string, attachments?: File[]) => Promise<void> | void;
  onTypingActivity?: () => void;
  onRetryOutboxMessage?: (itemId: string) => void;
  onDraftChange?: (draft: string) => void;
  onClose: () => void;
  onSignOff?: () => void;
  onOpenProfile?: () => void;
  isSending?: boolean;
  isLoading?: boolean;
}

interface MessageReactionRow {
  message_id: number;
  user_id: string;
  emoji: string;
}

interface MessageAttachmentRow extends ChatMediaAttachmentRecord {
  message_id: number;
}

function getChatScrollBehavior(): ScrollBehavior {
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return 'auto';
  }

  return 'smooth';
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
  onSendMessage,
  onTypingActivity,
  onRetryOutboxMessage,
  onDraftChange,
  onClose,
  onSignOff,
  onOpenProfile,
  isSending = false,
  isLoading = false,
}: ChatWindowProps) {
  const [draft, setDraft] = useState(initialDraft);
  const [format, setFormat] = useState<RichTextFormat>(DEFAULT_RICH_TEXT_FORMAT);
  const [showFormatting, setShowFormatting] = useState(true);
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
  const [enableSupplementalRealtime, setEnableSupplementalRealtime] = useState(false);
  const [composerAreaHeight, setComposerAreaHeight] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const composerAreaRef = useRef<HTMLDivElement>(null);
  const searchInputId = useId();
  const searchResultsId = useId();
  const messagesLogId = useId();
  const composerInputId = useId();
  const composerHelpId = useId();
  const swipeBack = useSwipeBack({ onSwipeBack: onClose });
  const { isKeyboardOpen, viewportHeight } = useKeyboardViewport();

  const scrollToLatestMessage = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: getChatScrollBehavior(), block: 'end' });
  }, []);

  useEffect(() => {
    scrollToLatestMessage();
  }, [messages, scrollToLatestMessage]);

  useEffect(() => {
    setDraft(initialDraft);
  }, [initialDraft]);

  useEffect(() => {
    composerRef.current?.focus();
  }, []);

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
  const messageMatches = useMemo(() => {
    const matches = new Map<number, boolean>();
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
    !isLoading && normalizedInitialUnreadCount > 0 && messages.length > 0
      ? Math.max(0, messages.length - normalizedInitialUnreadCount)
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if ((!trimmed && pendingAttachments.length === 0) || isSending) {
      return;
    }

    try {
      const formatted = trimmed ? formatRichText(trimmed, format) : '';
      await Promise.resolve(onSendMessage(formatted, pendingAttachments));
      setDraft('');
      onDraftChange?.('');
      clearPendingAttachments();
      setAttachmentError(null);
      void hapticSuccess();
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

  const xpTinyToolbarButtonClass = (active = false) =>
    `ui-focus-ring inline-flex h-7 min-w-7 items-center justify-center rounded-lg border px-1.5 text-[length:var(--ui-text-xs)] font-semibold text-slate-700 transition ${
      active
        ? 'border-blue-400/70 bg-blue-50 text-blue-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]'
        : 'border-slate-200 bg-white/80 hover:bg-white'
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

  return (
    <div
      className="fixed inset-0 z-40 chat-slide-in"
      role="dialog"
      aria-modal="true"
      aria-label={`Chat with ${buddyScreenname}`}
      {...swipeBack}
    >
      <RetroWindow
        title={`IM with ${buddyScreenname}`}
        variant="xp_shell"
        xpTitleText={`Instant Message — ${buddyScreenname}`}
        onXpClose={onClose}
        onXpSignOff={onSignOff}
        style={chatShellStyle}
      >
        <div className="flex h-full min-h-0 flex-col rounded-[1.4rem] border border-white/55 bg-white/72 text-[length:var(--ui-text-md)] backdrop-blur-xl shadow-[0_20px_44px_rgba(15,23,42,0.12)]">

          <button
            type="button"
            onClick={onOpenProfile}
            className="ui-focus-ring mx-3 mt-2.5 rounded-2xl border border-white/70 bg-white/88 px-3 py-2.5 text-left text-[length:var(--ui-text-xs)] text-slate-600 shadow-sm transition hover:bg-white disabled:cursor-default disabled:hover:bg-white/88"
            disabled={!onOpenProfile}
            aria-label={
              onOpenProfile ? `Open profile for ${buddyScreenname}` : `${buddyScreenname} profile is unavailable`
            }
          >
            <div className="flex items-center gap-3">
              <ProfileAvatar
                screenname={buddyScreenname}
                buddyIconPath={buddyIconPath}
                presenceState={buddyPresenceState}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[length:var(--ui-text-md)] font-semibold text-slate-800">
                    {buddyScreenname}
                  </span>
                  <span className={`text-[length:var(--ui-text-xs)] font-semibold ${presenceToneClass}`}>
                    {buddyPresenceDetail}
                  </span>
                </div>
                {buddyStatusLine ? (
                  <p className="mt-0.5 truncate text-[length:var(--ui-text-xs)] text-slate-500">{buddyStatusLine}</p>
                ) : null}
                {buddyStatusMessage ? (
                  <p
                    className="aim-rich-html mt-0.5 truncate italic text-[length:var(--ui-text-xs)] text-slate-400"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeRichTextHtml(buddyStatusMessage),
                    }}
                  />
                ) : null}
                {buddyBio ? (
                  <p className="mt-1 truncate text-[length:var(--ui-text-xs)] text-slate-400">{buddyBio}</p>
                ) : null}
              </div>
            </div>
          </button>

          {/* Search bar */}
          <div className="mx-3 mt-1.5 rounded-2xl border border-white/65 bg-white/72 px-3 py-1.5 shadow-sm">
            <label htmlFor={searchInputId} className="sr-only">
              Search conversation with {buddyScreenname}
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
                placeholder="Search conversation"
                aria-describedby={normalizedSearchQuery ? searchResultsId : undefined}
                className="ui-focus-ring h-6 min-w-0 flex-1 rounded-lg bg-transparent text-[length:var(--ui-text-xs)] text-slate-700 placeholder-slate-400"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="ui-focus-ring shrink-0 rounded-full text-[length:var(--ui-text-2xs)] font-semibold text-slate-400 hover:text-slate-600"
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
            aria-busy={isLoading}
            aria-label={`Conversation with ${buddyScreenname}`}
            className="mx-3 mt-1.5 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/55 bg-white/55 px-3 py-3 backdrop-blur-sm"
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
            {!isLoading && messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center ui-fade-in">
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
              <div className="flex flex-col gap-0.5" onClick={() => setLongPressMessageId(null)}>
                {messages.map((message, index) => {
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

                  // Group logic: show timestamp if first, >5 min gap, or new-message separator
                  const prevMessage = index > 0 ? messages[index - 1] : null;
                  const prevTime = prevMessage ? new Date(prevMessage.created_at).getTime() : 0;
                  const currTime = timestampDate.getTime();
                  const showTimeDivider = !prevMessage || currTime - prevTime > 5 * 60 * 1000;
                  const timestamp = timestampDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  // Tail rounding: last in a run from same sender gets the pointed corner
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
                      }`}>
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
                                  ? `rounded-2xl border border-blue-200/80 bg-white/96 text-slate-900 shadow-[0_10px_24px_rgba(37,99,235,0.16)] ${isLastInRun ? 'rounded-br-[8px]' : ''}`
                                  : `rounded-2xl bg-blue-500 text-white shadow-[0_2px_8px_rgba(37,99,235,0.28)] ${isLastInRun ? 'rounded-br-[6px]' : ''}`
                                : `rounded-2xl border border-white/70 bg-white/85 text-slate-800 shadow-sm backdrop-blur-sm ${isLastInRun ? 'rounded-bl-[6px]' : ''}`
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
                              {reactionEntries.map(([emoji, count]) => (
                                <span
                                  key={`${message.id}-${emoji}`}
                                  className="rounded-full border border-white/70 bg-white/85 px-1.5 py-[2px] text-[length:var(--ui-text-2xs)] text-slate-600 shadow-sm backdrop-blur-sm"
                                >
                                  {emoji} {count}
                                </span>
                              ))}
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
                                className="ui-focus-ring rounded-full border border-slate-200 bg-white/85 px-2 py-1 text-[length:var(--ui-text-2xs)] font-semibold text-slate-600 hover:bg-white"
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

          {/* Typing indicator */}
          {typingText ? (
            <div className="mx-3 mt-1.5 flex items-center gap-2" role="status" aria-live="polite" aria-atomic="true">
              <div className="flex items-center gap-1 rounded-full border border-white/65 bg-white/80 px-3 py-1.5 shadow-sm backdrop-blur-sm">
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
              </div>
              <span className="text-[length:var(--ui-text-2xs)] text-slate-400">{typingText}</span>
            </div>
          ) : null}

          {/* Input area */}
          <div ref={composerAreaRef} className="mx-3 mt-2 space-y-1.5" style={composerAreaStyle}>
            {/* Formatting toolbar */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowFormatting((previous) => !previous)}
                className={`${xpTinyToolbarButtonClass(showFormatting)} px-2.5`}
                aria-label={showFormatting ? 'Hide formatting toolbar' : 'Show formatting toolbar'}
                aria-expanded={showFormatting}
                title="Formatting"
              >
                Font
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
                title="Link coming soon"
              >
                <AppIcon kind="link" className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                className={xpTinyToolbarButtonClass()}
                aria-label="Emoji picker coming soon"
                title="Emoji coming soon"
              >
                <AppIcon kind="smile" className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => attachmentInputRef.current?.click()}
                className={xpTinyToolbarButtonClass(pendingAttachments.length > 0)}
                aria-label={`Attach files to your message to ${buddyScreenname}`}
                title="Attach files"
              >
                <AppIcon kind="attachment" className="h-3.5 w-3.5" />
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

            {showFormatting ? (
              <div className="rounded-2xl border border-white/65 bg-white/80 p-2 shadow-sm">
                <RichTextToolbar value={format} onChange={setFormat} />
              </div>
            ) : null}

            {/* Pending attachments */}
            {pendingAttachments.length > 0 ? (
              <div className="space-y-1 rounded-2xl border border-white/65 bg-white/72 p-2">
                {pendingAttachments.map((file, index) => (
                  <div key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center gap-2">
                    <span className="min-w-0 flex flex-1 items-center gap-1 truncate text-[length:var(--ui-text-2xs)] text-slate-600">
                      <AppIcon kind="attachment" className="h-3 w-3 shrink-0" />
                      <span className="truncate">{file.name} ({formatFileSize(file.size)})</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removePendingAttachment(index)}
                      className="ui-focus-ring shrink-0 rounded-lg border border-red-200/80 bg-white px-1.5 text-[length:var(--ui-text-2xs)] font-semibold text-red-500 hover:bg-red-50"
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
              onSubmit={handleSubmit}
              className="flex items-end gap-2 rounded-2xl border border-white/65 bg-white/88 px-3.5 py-2.5 shadow-[0_4px_16px_rgba(15,23,42,0.08)] backdrop-blur-sm"
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
                  if (typeof window === 'undefined') {
                    return;
                  }

                  window.requestAnimationFrame(() => {
                    scrollToLatestMessage();
                  });
                }}
                placeholder="Message…"
                rows={1}
                maxLength={1000}
                aria-describedby={composerHelpId}
                className="ui-focus-ring min-h-[24px] flex-1 resize-none rounded-xl bg-transparent text-[length:var(--ui-text-md)] text-slate-800 placeholder-slate-400"
                style={{ maxHeight: '88px', overflowY: 'auto' }}
              />
              {(draft.trim() || pendingAttachments.length > 0) ? (
                <button
                  type="submit"
                  disabled={isSending}
                  className="ui-focus-ring mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[length:var(--ui-text-md)] font-bold text-white shadow-[0_4px_10px_rgba(37,99,235,0.4)] transition hover:bg-blue-600 active:scale-95 disabled:opacity-60"
                  aria-label={`Send message to ${buddyScreenname}`}
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
