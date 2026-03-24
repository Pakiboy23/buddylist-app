'use client';

import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    `inline-flex h-7 min-w-7 items-center justify-center rounded-lg border px-1.5 text-[11px] font-semibold text-slate-700 transition ui-focus-ring ${
      active
        ? 'border-blue-400/70 bg-blue-50 text-blue-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]'
        : 'border-slate-200 bg-white hover:bg-slate-50'
    }`;

  return (
    <div className="fixed inset-0 z-40">
      <RetroWindow
        title={`IM with ${buddyScreenname}`}
        variant="xp_shell"
        xpTitleText={`Instant Message - ${buddyScreenname}`}
        onXpClose={onClose}
        onXpSignOff={onSignOff}
      >
        <div className="flex h-full min-h-0 flex-col rounded-[1.4rem] border border-white/60 bg-white/65 text-[11px] backdrop-blur-xl">
          <div className="m-2 mb-0 rounded-xl border border-white/70 bg-white/80 px-3 py-2 text-[11px] text-slate-700">
            <span className="font-bold">Conversation with {buddyScreenname}:</span>{' '}
            <span
              className="aim-rich-html"
              dangerouslySetInnerHTML={{
                __html: sanitizeRichTextHtml(buddyStatusMessage || 'No away message.'),
              }}
            />
          </div>

          <div className="mx-2 mt-2 rounded-xl border border-white/60 bg-white/70 backdrop-blur-sm px-2 py-1 text-[11px] text-slate-700">
            <div className="flex items-center gap-2">
              <label htmlFor="dm-search-input" className="shrink-0 font-bold">
                Search:
              </label>
              <input
                id="dm-search-input"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
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
                {searchMatchCount} {searchMatchCount === 1 ? 'match' : 'matches'}
              </p>
            ) : null}
          </div>

          <div className="m-2 mb-0 min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
            {isLoading && <p className="italic text-slate-500">Loading conversation...</p>}
            {!isLoading && messages.length === 0 && (
              <p className="italic text-slate-500">No messages yet. Say hey.</p>
            )}
            {!isLoading && (
              <div className="space-y-1">
                {messages.map((message, index) => {
                  const isMine = message.sender_id === currentUserId;
                  const isDeleted = Boolean(message.deleted_at);
                  const isEditing = editingMessageId === message.id;
                  const isMatch = normalizedSearchQuery ? Boolean(messageMatches.get(message.id)) : false;
                  const timestampDate = new Date(message.created_at);
                  const timestamp = timestampDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const fullTimestamp = timestampDate.toLocaleString();
                  const senderClassName = isMine ? 'text-blue-600' : 'text-emerald-600';
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
                            ? 'rounded bg-amber-50 px-1'
                            : 'px-1 opacity-50'
                          : undefined
                      }
                    >
                      {separatorIndex === index ? (
                        <p className="aim-new-messages-separator">New messages</p>
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
                            className="aim-rich-html text-slate-800"
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
                        </div>
                      ) : null}
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
              onSubmit={handleSubmit}
              className="flex h-16 flex-1 items-stretch gap-2 rounded-xl border border-slate-200 bg-white p-1"
            >
              <textarea
                value={draft}
                onChange={(event) => handleDraftChange(event.target.value)}
                onKeyDown={handleDraftKeyDown}
                placeholder="Type your message..."
                className="h-full min-h-0 flex-1 resize-none bg-white px-2 py-1 text-[11px] ui-focus-ring"
                maxLength={1000}
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
        </div>
      </RetroWindow>
    </div>
  );
}
