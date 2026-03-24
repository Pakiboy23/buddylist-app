'use client';

import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ProfileAvatar from '@/components/ProfileAvatar';
import RetroWindow from '@/components/RetroWindow';
import RichTextToolbar from '@/components/RichTextToolbar';
import {
  CHAT_MEDIA_MAX_ATTACHMENTS,
  type ChatMediaAttachmentRecord,
  formatFileSize,
  validateChatMediaFile,
} from '@/lib/chatMedia';
import {
  DEFAULT_RICH_TEXT_FORMAT,
  formatRichText,
  htmlToPlainText,
  RichTextFormat,
  sanitizeRichTextHtml,
} from '@/lib/richText';
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
  initialUnreadCount?: number;
  initialDraft?: string;
  typingText?: string | null;
  onSendMessage: (content: string, attachments?: File[]) => Promise<void> | void;
  onTypingActivity?: () => void;
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
  initialUnreadCount = 0,
  initialDraft = '',
  typingText = null,
  onSendMessage,
  onTypingActivity,
  onDraftChange,
  onClose,
  onSignOff,
  onOpenProfile,
  isSending = false,
  isLoading = false,
}: ChatWindowProps) {
  const [draft, setDraft] = useState(initialDraft);
  const [format, setFormat] = useState<RichTextFormat>(DEFAULT_RICH_TEXT_FORMAT);
  const [showFormatting, setShowFormatting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [isDeletingMessageId, setIsDeletingMessageId] = useState<number | null>(null);
  const [reactionRows, setReactionRows] = useState<MessageReactionRow[]>([]);
  const [attachmentRows, setAttachmentRows] = useState<MessageAttachmentRow[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<File[]>([]);
  const [reactionError, setReactionError] = useState<string | null>(null);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentLoadError, setAttachmentLoadError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

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
  }, [currentUserId, messages]);

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
  }, [currentUserId, messages]);

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
    } catch {
      // Keep the draft intact if the send fails.
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
<<<<<<< codex/update-ui-for-minimalist-apple-style-design-z8w1md
    `inline-flex h-7 min-w-7 items-center justify-center rounded-lg border px-1.5 text-[11px] font-semibold text-slate-700 transition ui-focus-ring ${
      active
        ? 'border-blue-400/70 bg-blue-50 text-blue-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]'
        : 'border-slate-200 bg-white hover:bg-slate-50'
=======
    `inline-flex h-7 min-w-7 items-center justify-center rounded-lg border px-1.5 text-[11px] font-semibold text-slate-700 transition ${
      active
        ? 'border-blue-400/70 bg-blue-50 text-blue-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]'
        : 'border-slate-200 bg-white/80 hover:bg-white'
>>>>>>> main
    }`;
  const presenceToneClass =
    buddyPresenceState === 'away'
      ? 'text-amber-500'
      : buddyPresenceState === 'idle'
        ? 'text-sky-500'
        : buddyPresenceState === 'offline'
          ? 'text-slate-400'
          : 'text-emerald-500';

  return (
    <div className="fixed inset-0 z-40 chat-slide-in">
      <RetroWindow
        title={`IM with ${buddyScreenname}`}
<<<<<<< codex/update-ui-for-minimalist-apple-style-design-z8w1md
        variant="glass_shell"
        xpTitleText={`Instant Message - ${buddyScreenname}`}
        onXpClose={onClose}
        onXpSignOff={onSignOff}
      >
        <div className="flex h-full min-h-0 flex-col rounded-[1.4rem] border border-white/60 bg-white/65 text-[11px] backdrop-blur-xl">
          <div className="m-2 mb-0 rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-[11px] text-slate-700">
            <span className="font-bold">Conversation with {buddyScreenname}:</span>{' '}
            <span
              className="ui-rich-html"
              dangerouslySetInnerHTML={{
                __html: sanitizeRichTextHtml(buddyStatusMessage || 'No away message.'),
              }}
            />
          </div>

          <div className="mx-2 mt-2 rounded-xl border border-white/60 bg-white/70 backdrop-blur-sm px-2 py-1 text-[11px] text-slate-700">
=======
        variant="xp_shell"
        xpTitleText={`Instant Message — ${buddyScreenname}`}
        onXpClose={onClose}
        onXpSignOff={onSignOff}
      >
        <div className="flex h-full min-h-0 flex-col rounded-[1.4rem] border border-white/55 bg-white/72 text-[13px] backdrop-blur-xl shadow-[0_20px_44px_rgba(15,23,42,0.12)]">

          <button
            type="button"
            onClick={onOpenProfile}
            className="mx-3 mt-2.5 rounded-2xl border border-white/70 bg-white/88 px-3 py-2.5 text-left text-[11px] text-slate-600 shadow-sm transition hover:bg-white disabled:cursor-default disabled:hover:bg-white/88"
            disabled={!onOpenProfile}
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
                  <span className="truncate text-[13px] font-semibold text-slate-800">{buddyScreenname}</span>
                  <span className={`text-[11px] font-semibold ${presenceToneClass}`}>{buddyPresenceDetail}</span>
                </div>
                {buddyStatusLine ? (
                  <p className="mt-0.5 truncate text-[11px] text-slate-500">{buddyStatusLine}</p>
                ) : null}
                {buddyStatusMessage ? (
                  <p
                    className="aim-rich-html mt-0.5 truncate italic text-[11px] text-slate-400"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeRichTextHtml(buddyStatusMessage),
                    }}
                  />
                ) : null}
                {buddyBio ? <p className="mt-1 truncate text-[11px] text-slate-400">{buddyBio}</p> : null}
              </div>
            </div>
          </button>

          {/* Search bar */}
          <div className="mx-3 mt-1.5 rounded-2xl border border-white/65 bg-white/72 px-3 py-1.5 shadow-sm">
>>>>>>> main
            <div className="flex items-center gap-2">
              <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                id="dm-search-input"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
<<<<<<< codex/update-ui-for-minimalist-apple-style-design-z8w1md
                placeholder="Find in this conversation"
                className="h-6 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-1.5 text-[11px] ui-focus-ring"
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
=======
                placeholder="Search conversation"
                className="h-6 min-w-0 flex-1 bg-transparent text-[11px] text-slate-700 placeholder-slate-400 focus:outline-none"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="shrink-0 text-[10px] font-semibold text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              ) : null}
            </div>
            {normalizedSearchQuery ? (
              <p className="mt-0.5 text-[10px] text-slate-400">
>>>>>>> main
                {searchMatchCount} {searchMatchCount === 1 ? 'match' : 'matches'}
              </p>
            ) : null}
          </div>

<<<<<<< codex/update-ui-for-minimalist-apple-style-design-z8w1md
          <div className="m-2 mb-0 min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
            {isLoading && <p className="italic text-slate-500">Loading conversation...</p>}
=======
          {/* Messages area */}
          <div className="mx-3 mt-1.5 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/55 bg-white/55 px-3 py-3 backdrop-blur-sm">
            {isLoading && (
              <div className="flex flex-col gap-3 pt-2">
                {[72, 48, 88, 56].map((w, i) => (
                  <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                    <div className={`h-8 animate-pulse rounded-2xl bg-white/60`} style={{ width: `${w}px` }} />
                  </div>
                ))}
              </div>
            )}
>>>>>>> main
            {!isLoading && messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
                <span className="text-3xl">👋</span>
                <p className="text-[12px] text-slate-400">No messages yet. Say hey.</p>
              </div>
            )}
            {!isLoading && (
              <div className="flex flex-col gap-0.5">
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
<<<<<<< codex/update-ui-for-minimalist-apple-style-design-z8w1md
                    <div
                      key={message.id}
                      className={
                        normalizedSearchQuery
                          ? isMatch
                            ? 'rounded bg-amber-50 px-1'
                            : 'px-1 opacity-50'
                          : undefined
                      }
                    >
                      {separatorIndex === index ? (
                        <p className="ui-new-messages-separator">New messages</p>
                      ) : null}
                      <div className="flex flex-wrap items-baseline gap-x-1 leading-4">
                        <span className="text-[11px] text-gray-500" title={fullTimestamp}>
                          [{timestamp}]
                        </span>
                        <span className={`font-bold ${senderClassName}`}>
                          {isMine ? 'You' : buddyScreenname}:
                        </span>
                        {isEditing ? (
                          <span className="flex min-w-0 flex-1 items-center gap-1">
                            <input
                              value={editDraft}
                              onChange={(event) => setEditDraft(event.target.value)}
                              className="h-6 min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-1 text-[11px] ui-focus-ring"
                              maxLength={1000}
                            />
                            <button
                              type="button"
                              onClick={() => void saveEditedMessage(message.id)}
                              disabled={isSavingEdit || !editDraft.trim()}
                              className="rounded-lg border border-slate-200 bg-white px-1 py-0.5 text-[10px] font-bold text-slate-700 disabled:opacity-60"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditingMessage}
                              className="rounded-lg border border-slate-200 bg-white px-1 py-0.5 text-[10px] font-bold text-slate-700"
                            >
                              Cancel
                            </button>
                          </span>
                        ) : isDeleted ? (
                          <span className="italic text-gray-500">This message was deleted.</span>
                        ) : (
                          <span
                            className="ui-rich-html text-slate-800"
                            dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(message.content) }}
                          />
                        )}
                        {isEdited ? <span className="text-[10px] italic text-gray-500">(edited)</span> : null}
                        {isMine && !isDeleted && !isEditing ? (
                          <span className="ml-1 inline-flex gap-1 text-[10px]">
                            <button
                              type="button"
                              onClick={() => startEditingMessage(message)}
                              className="text-[#1f4f9e] underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void softDeleteMessage(message.id)}
                              disabled={isDeletingMessageId === message.id}
                              className="text-red-700 underline disabled:opacity-60"
                            >
                              {isDeletingMessageId === message.id ? '...' : 'Delete'}
                            </button>
                          </span>
                        ) : null}
                      </div>
                      {!isDeleted && messageAttachments.length > 0 ? (
                        <div className="mt-1 space-y-0.5 pl-12">
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
                                className="block text-[10px] text-blue-600 underline"
                                title={attachment.storage_path}
                              >
                                📎 {attachment.file_name}
                                {attachment.size_bytes ? ` (${formatFileSize(attachment.size_bytes)})` : ''}
                              </a>
                            );
                          })}
                        </div>
                      ) : null}
                      {!isDeleted && reactionEntries.length > 0 ? (
                        <div className="mt-0.5 flex flex-wrap items-center gap-1 pl-12">
                          {reactionEntries.map(([emoji, count]) => (
                            <span
                              key={`${message.id}-${emoji}`}
                              className="rounded rounded-lg border border-slate-200 bg-white/70 px-1 py-[1px] text-[10px] text-slate-600"
                            >
                              {emoji} {count}
                            </span>
                          ))}
=======
                    <div key={message.id} className="flex flex-col">
                      {separatorIndex === index ? (
                        <p className="aim-new-messages-separator my-2">New messages</p>
                      ) : showTimeDivider ? (
                        <p className="my-2 text-center text-[10px] text-slate-400" title={fullTimestamp}>
                          {timestamp}
                        </p>
                      ) : null}

                      <div className={`flex ${isMine ? 'justify-end' : 'justify-start'} ${
                        normalizedSearchQuery && !isMatch ? 'opacity-35' : ''
                      }`}>
                        <div className="group relative max-w-[78%]">
                          {/* Bubble */}
                          <div
                            className={`relative msg-enter px-3 py-2 text-[13px] leading-snug ${
                              isLastInRun ? 'mb-2' : 'mb-0.5'
                            } ${
                              isMine
                                ? `rounded-2xl bg-blue-500 text-white shadow-[0_2px_8px_rgba(37,99,235,0.28)] ${isLastInRun ? 'rounded-br-[6px]' : ''}`
                                : `rounded-2xl border border-white/70 bg-white/85 text-slate-800 shadow-sm backdrop-blur-sm ${isLastInRun ? 'rounded-bl-[6px]' : ''}`
                            } ${isMatch ? 'ring-2 ring-amber-400' : ''}`}
                          >
                            {isEditing ? (
                              <div className="flex min-w-[200px] flex-col gap-2">
                                <input
                                  value={editDraft}
                                  onChange={(event) => setEditDraft(event.target.value)}
                                  className={`w-full rounded-xl border bg-white/20 px-2.5 py-1.5 text-[12px] focus:outline-none focus:ring-1 ${
                                    isMine
                                      ? 'border-white/30 text-white placeholder-white/50 focus:ring-white/30'
                                      : 'border-slate-200 text-slate-800 focus:ring-blue-200'
                                  }`}
                                  maxLength={1000}
                                  autoFocus
                                />
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={cancelEditingMessage}
                                    className={`rounded-xl px-2.5 py-1 text-[11px] font-semibold ${
                                      isMine ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => void saveEditedMessage(message.id)}
                                    disabled={isSavingEdit || !editDraft.trim()}
                                    className={`rounded-xl px-2.5 py-1 text-[11px] font-semibold disabled:opacity-60 ${
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
                                className="aim-rich-html"
                                dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(message.content) }}
                              />
                            )}
                            {isEdited && !isEditing ? (
                              <span className={`ml-1.5 text-[9px] ${isMine ? 'text-blue-200' : 'text-slate-400'}`}>(edited)</span>
                            ) : null}
                          </div>

                          {/* Hover action bar — only for own non-deleted messages */}
                          {isMine && !isDeleted && !isEditing ? (
                            <div className="absolute -top-8 right-0 hidden items-center gap-0.5 rounded-full border border-white/70 bg-white/90 px-2 py-1 shadow-lg backdrop-blur-md group-hover:flex">
                              <button
                                type="button"
                                onClick={() => startEditingMessage(message)}
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-slate-600 hover:bg-slate-100"
                              >
                                Edit
                              </button>
                              <span className="text-slate-300">·</span>
                              <button
                                type="button"
                                onClick={() => void softDeleteMessage(message.id)}
                                disabled={isDeletingMessageId === message.id}
                                className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-red-500 hover:bg-red-50 disabled:opacity-60"
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
                                  className="rounded-full border border-white/70 bg-white/85 px-1.5 py-[2px] text-[10px] text-slate-600 shadow-sm backdrop-blur-sm"
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
                                    className={`block text-[10px] underline ${isMine ? 'text-blue-200' : 'text-blue-600'}`}
                                    title={attachment.storage_path}
                                  >
                                    📎 {attachment.file_name}
                                    {attachment.size_bytes ? ` (${formatFileSize(attachment.size_bytes)})` : ''}
                                  </a>
                                );
                              })}
                            </div>
                          ) : null}
>>>>>>> main
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
<<<<<<< codex/update-ui-for-minimalist-apple-style-design-z8w1md
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
          </div>

          {showFormatting ? (
            <div className="mx-2 mb-2 rounded-xl border border-slate-200 bg-white/80 p-1">
              <RichTextToolbar value={format} onChange={setFormat} />
            </div>
          ) : null}
=======

          {reactionError ? <p className="mx-3 mt-1 text-[10px] text-red-600">{reactionError}</p> : null}
          {attachmentLoadError ? <p className="mx-3 mt-1 text-[10px] text-red-600">{attachmentLoadError}</p> : null}
>>>>>>> main

          {/* Typing indicator */}
          {typingText ? (
<<<<<<< codex/update-ui-for-minimalist-apple-style-design-z8w1md
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
=======
            <div className="mx-3 mt-1.5 flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-full border border-white/65 bg-white/80 px-3 py-1.5 shadow-sm backdrop-blur-sm">
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
                <span className="typing-dot h-1.5 w-1.5 rounded-full bg-slate-400" />
              </div>
              <span className="text-[10px] text-slate-400">{typingText}</span>
            </div>
          ) : null}

          {/* Input area */}
          <div className="mx-3 mb-3 mt-2 space-y-1.5">
            {/* Formatting toolbar */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowFormatting((previous) => !previous)}
                className={xpTinyToolbarButtonClass(showFormatting)}
                aria-label="Toggle formatting"
                title="Formatting"
              >
                A
              </button>
              <button type="button" onClick={toggleBold} className={xpTinyToolbarButtonClass(format.bold)} aria-label="Bold">
                <span className="font-bold">B</span>
              </button>
              <button type="button" onClick={toggleItalic} className={xpTinyToolbarButtonClass(format.italic)} aria-label="Italic">
                <span className="italic">I</span>
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
                className={`${xpTinyToolbarButtonClass()} opacity-50`}
                aria-label="Link"
                title="Link"
              >
                🔗
              </button>
              <button
                type="button"
                className={xpTinyToolbarButtonClass()}
                aria-label="Emoji"
                title="Emoji coming soon"
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
>>>>>>> main
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
                    <span className="min-w-0 flex-1 truncate text-[10px] text-slate-600">
                      📎 {file.name} ({formatFileSize(file.size)})
                    </span>
                    <button
                      type="button"
                      onClick={() => removePendingAttachment(index)}
                      className="shrink-0 rounded-lg border border-red-200/80 bg-white px-1.5 text-[10px] font-semibold text-red-500 hover:bg-red-50"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {attachmentError ? <p className="text-[10px] text-red-600">{attachmentError}</p> : null}

            {/* Pill compose input */}
            <form
              onSubmit={handleSubmit}
<<<<<<< codex/update-ui-for-minimalist-apple-style-design-z8w1md
              className="flex h-16 flex-1 items-stretch gap-2 rounded-xl border border-slate-200 bg-white p-1"
=======
              className="flex items-end gap-2 rounded-2xl border border-white/65 bg-white/88 px-3.5 py-2.5 shadow-[0_4px_16px_rgba(15,23,42,0.08)] backdrop-blur-sm"
>>>>>>> main
            >
              <textarea
                value={draft}
                onChange={(event) => handleDraftChange(event.target.value)}
                onKeyDown={handleDraftKeyDown}
<<<<<<< codex/update-ui-for-minimalist-apple-style-design-z8w1md
                placeholder="Type your message..."
                className="h-full min-h-0 flex-1 resize-none bg-white px-2 py-1 text-[11px] ui-focus-ring"
=======
                placeholder="Message…"
                rows={1}
>>>>>>> main
                maxLength={1000}
                className="min-h-[24px] flex-1 resize-none bg-transparent text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none"
                style={{ maxHeight: '88px', overflowY: 'auto' }}
              />
<<<<<<< codex/update-ui-for-minimalist-apple-style-design-z8w1md
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
=======
              {(draft.trim() || pendingAttachments.length > 0) ? (
                <button
                  type="submit"
                  disabled={isSending}
                  className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[14px] font-bold text-white shadow-[0_4px_10px_rgba(37,99,235,0.4)] transition hover:bg-blue-600 active:scale-95 disabled:opacity-60"
                  aria-label="Send message"
                >
                  {isSending ? '…' : '↑'}
                </button>
              ) : null}
            </form>
          </div>
>>>>>>> main
        </div>
      </RetroWindow>
    </div>
  );
}
