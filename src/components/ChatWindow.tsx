'use client';

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import RetroWindow from '@/components/RetroWindow';
import RichTextToolbar from '@/components/RichTextToolbar';
import {
  DEFAULT_RICH_TEXT_FORMAT,
  formatRichText,
  RichTextFormat,
  sanitizeRichTextHtml,
} from '@/lib/richText';

export interface ChatMessage {
  id: number;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
}

interface ChatWindowProps {
  buddyScreenname: string;
  buddyStatusMessage: string | null;
  currentUserId: string;
  messages: ChatMessage[];
  initialUnreadCount?: number;
  typingText?: string | null;
  onSendMessage: (content: string) => Promise<void> | void;
  onTypingActivity?: () => void;
  onClose: () => void;
  onSignOff?: () => void;
  isSending?: boolean;
  isLoading?: boolean;
}

export default function ChatWindow({
  buddyScreenname,
  buddyStatusMessage,
  currentUserId,
  messages,
  initialUnreadCount = 0,
  typingText = null,
  onSendMessage,
  onTypingActivity,
  onClose,
  onSignOff,
  isSending = false,
  isLoading = false,
}: ChatWindowProps) {
  const [draft, setDraft] = useState('');
  const [format, setFormat] = useState<RichTextFormat>(DEFAULT_RICH_TEXT_FORMAT);
  const [showFormatting, setShowFormatting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const normalizedInitialUnreadCount = Math.max(0, Math.floor(initialUnreadCount));
  const separatorIndex =
    !isLoading && normalizedInitialUnreadCount > 0 && messages.length > 0
      ? Math.max(0, messages.length - normalizedInitialUnreadCount)
      : null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isSending) {
      return;
    }

    try {
      const formatted = formatRichText(trimmed, format);
      await Promise.resolve(onSendMessage(formatted));
      setDraft('');
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

  const handleDraftChange = (nextValue: string) => {
    setDraft(nextValue);
    if (nextValue.trim()) {
      onTypingActivity?.();
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
    `inline-flex h-5 min-w-5 items-center justify-center border px-1 text-[11px] font-bold text-[#1e395b] ${
      active
        ? 'border-[#7f7f7f] border-t-[#9d9d9d] border-l-[#9d9d9d] border-r-white border-b-white bg-[#dde4ef]'
        : 'border-[#7f7f7f] border-t-white border-l-white border-r-[#808080] border-b-[#808080] bg-[#ece9d8]'
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
        <div className="flex h-full min-h-0 flex-col bg-[#ece9d8] font-[Tahoma,Arial,sans-serif] text-[11px]">
          <div className="m-2 mb-0 border border-[#a8a8a8] border-t-white border-l-white border-r-[#a8a8a8] border-b-[#a8a8a8] bg-[#ece9d8] px-2 py-1 text-[11px] text-[#1e395b]">
            <span className="font-bold">Conversation with {buddyScreenname}:</span>{' '}
            <span
              className="aim-rich-html"
              dangerouslySetInnerHTML={{
                __html: sanitizeRichTextHtml(buddyStatusMessage || 'No away message.'),
              }}
            />
          </div>

          <div className="m-2 mb-0 min-h-0 flex-1 overflow-y-auto border-2 border-t-[#808080] border-l-[#808080] border-b-white border-r-white bg-white p-2">
            {isLoading && <p className="italic text-slate-500">Loading conversation...</p>}
            {!isLoading && messages.length === 0 && (
              <p className="italic text-slate-500">No messages yet. Say hey.</p>
            )}
            {!isLoading && (
              <div className="space-y-1">
                {messages.map((message, index) => {
                  const isMine = message.sender_id === currentUserId;
                  const timestampDate = new Date(message.created_at);
                  const timestamp = timestampDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const fullTimestamp = timestampDate.toLocaleString();
                  const senderClassName = isMine ? 'text-blue-600' : 'text-emerald-600';

                  return (
                    <div key={message.id}>
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
                        <span
                          className="aim-rich-html text-gray-900"
                          dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(message.content) }}
                        />
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="mx-2 mb-2 flex items-center gap-1 border border-[#b7b7b7] bg-[#ece9d8] px-1 py-1">
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
          </div>

          {showFormatting ? (
            <div className="mx-2 mb-2 border border-[#b7b7b7] bg-[#ece9d8] p-1">
              <RichTextToolbar value={format} onChange={setFormat} />
            </div>
          ) : null}

          {typingText ? (
            <p className="mx-2 mb-1 text-[11px] italic text-[#2d5c9a]">{typingText}</p>
          ) : null}

          <div className="m-2 mt-0 flex items-stretch gap-2">
            <form
              onSubmit={handleSubmit}
              className="flex h-16 flex-1 items-stretch gap-2 border-2 border-t-[#808080] border-l-[#808080] border-b-white border-r-white bg-white p-1"
            >
              <textarea
                value={draft}
                onChange={(event) => handleDraftChange(event.target.value)}
                onKeyDown={handleDraftKeyDown}
                placeholder="Type your message..."
                className="h-full min-h-0 flex-1 resize-none bg-white px-2 py-1 text-[11px] focus:outline-none"
                maxLength={1000}
                rows={2}
              />
              <button
                type="submit"
                disabled={isSending || !draft.trim()}
                className="min-w-[74px] border-2 border-t-white border-l-white border-r-[#808080] border-b-[#808080] bg-[#ece9d8] px-2 text-[11px] font-bold text-[#1e395b] disabled:opacity-60"
              >
                {isSending ? '...' : 'Send'}
              </button>
            </form>
          </div>
          <p className="mx-2 mb-2 text-[11px] text-[#5a5a5a]">
            Enter to send. Cmd/Ctrl + Enter for a new line.
          </p>
        </div>
      </RetroWindow>
    </div>
  );
}
