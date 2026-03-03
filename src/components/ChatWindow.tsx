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
  onSendMessage: (content: string) => Promise<void> | void;
  onClose: () => void;
  isSending?: boolean;
  isLoading?: boolean;
}

export default function ChatWindow({
  buddyScreenname,
  buddyStatusMessage,
  currentUserId,
  messages,
  onSendMessage,
  onClose,
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

  return (
    <div className="fixed inset-0 z-40">
      <RetroWindow title={`IM with ${buddyScreenname}`} showBackButton backButtonLabel="<" onBack={onClose}>
        <div className="flex h-full min-h-0 flex-col gap-2 text-sm">
          <div
            className="aim-rich-html rounded-md border border-blue-200 bg-white px-3 py-2 font-semibold text-blue-700"
            dangerouslySetInnerHTML={{
              __html: sanitizeRichTextHtml(buddyStatusMessage || 'No away message.'),
            }}
          />

          <div
            className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-blue-200 bg-white px-3 py-2"
          >
            {isLoading && <p className="italic text-slate-500">Loading conversation...</p>}
            {!isLoading && messages.length === 0 && (
              <p className="italic text-slate-500">No messages yet. Say hey.</p>
            )}
            {!isLoading && (
              <div className="space-y-1">
                {messages.map((message) => {
                  const isMine = message.sender_id === currentUserId;
                  const timestamp = new Date(message.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const senderClassName = isMine ? 'text-blue-600' : 'text-emerald-600';

                  return (
                    <div key={message.id} className="flex flex-wrap items-baseline gap-x-1 text-sm leading-5">
                      <span className="text-xs text-gray-500">[{timestamp}]</span>
                      <span className={`font-bold ${senderClassName}`}>
                        {isMine ? 'You' : buddyScreenname}:
                      </span>
                      <span
                        className="aim-rich-html text-gray-900"
                        dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(message.content) }}
                      />
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-blue-200 bg-white/95 px-2 pb-2 pt-2 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
            {showFormatting ? (
              <div className="mb-2 rounded-md border border-blue-200 bg-blue-50/40 p-2">
                <RichTextToolbar value={format} onChange={setFormat} />
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="flex items-end gap-2">
              <button
                type="button"
                onClick={() => setShowFormatting((previous) => !previous)}
                className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-blue-300 bg-gradient-to-b from-white via-blue-50 to-blue-200 px-2 text-sm font-bold text-blue-800 shadow-sm transition hover:from-blue-50 hover:to-blue-300"
                aria-label="Toggle formatting"
                title="Toggle formatting"
              >
                A
              </button>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleDraftKeyDown}
                placeholder="Type your message..."
                className="min-h-[44px] max-h-36 flex-1 resize-none rounded-md border border-blue-300 bg-white px-3 py-2 text-sm shadow-[inset_0_1px_3px_rgba(37,99,235,0.18)] focus:outline-none"
                maxLength={1000}
                rows={2}
              />
              <button
                type="submit"
                disabled={isSending || !draft.trim()}
                className="min-h-[44px] min-w-[86px] cursor-pointer rounded-md border border-blue-500 bg-gradient-to-b from-blue-200 via-blue-300 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:from-blue-300 hover:to-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSending ? '...' : 'Send'}
              </button>
            </form>
            <p className="mt-1 text-[11px] text-slate-500">
              Enter to send. Cmd/Ctrl + Enter for a new line.
            </p>
          </div>
        </div>
      </RetroWindow>
    </div>
  );
}
