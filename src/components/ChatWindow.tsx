'use client';

import { FormEvent, MouseEvent, useEffect, useRef, useState } from 'react';
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
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!historyRef.current) {
      return;
    }
    historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [messages, isLoading]);

  useEffect(() => {
    if (!isDragging) {
      return;
    }

    const handleMouseMove = (event: globalThis.MouseEvent) => {
      setPosition({
        x: event.clientX - dragOffsetRef.current.x,
        y: event.clientY - dragOffsetRef.current.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

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

  const handleTitleBarMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    dragOffsetRef.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };
    setIsDragging(true);
    event.preventDefault();
  };

  return (
    <div
      className="w-[min(92vw,440px)]"
      style={{ top: position.y, left: position.x, position: 'fixed', zIndex: 50 }}
    >
      <RetroWindow
        title={`IM with ${buddyScreenname}`}
        onTitleBarMouseDown={handleTitleBarMouseDown}
        titleBarClassName={isDragging ? 'cursor-grabbing' : 'cursor-grab'}
      >
        <div className="flex h-full min-h-[320px] flex-col gap-2 text-xs">
          <div className="flex items-center justify-between">
            <div
              className="aim-rich-html max-w-[75%] truncate font-bold text-os-blue"
              dangerouslySetInnerHTML={{
                __html: sanitizeRichTextHtml(buddyStatusMessage || 'No away message.'),
              }}
            />
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer border-2 border-white border-b-[#0a0a0a] border-r-[#0a0a0a] bg-os-grey px-2 py-[1px] text-[11px] font-bold active:border-b-white active:border-l-[#0a0a0a] active:border-r-white active:border-t-[#0a0a0a]"
            >
              X
            </button>
          </div>

          <div
            ref={historyRef}
            className="h-[240px] overflow-y-auto border-2 border-[#0a0a0a] border-b-white border-r-white bg-white p-2 shadow-window-in"
          >
            {isLoading && <p className="italic text-os-dark-grey">Loading conversation...</p>}
            {!isLoading && messages.length === 0 && (
              <p className="italic text-os-dark-grey">No messages yet. Say hey.</p>
            )}
            {!isLoading &&
              messages.map((message) => {
                const isMine = message.sender_id === currentUserId;
                const timestamp = new Date(message.created_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <div
                    key={message.id}
                    className={`mb-2 flex ${isMine ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[85%] border px-2 py-1 ${
                        isMine
                          ? 'border-os-blue bg-[#e6ebff] text-right'
                          : 'border-os-dark-grey bg-[#f4f4f4]'
                      }`}
                    >
                      <p className="mb-[2px] text-[10px] font-bold text-os-dark-grey">
                        {isMine ? 'You' : buddyScreenname} at {timestamp}
                      </p>
                      <div
                        className="aim-rich-html whitespace-pre-wrap break-words text-xs"
                        dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(message.content) }}
                      />
                    </div>
                  </div>
                );
              })}
          </div>

          <RichTextToolbar value={format} onChange={setFormat} />

          <form onSubmit={handleSubmit} className="flex gap-1">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Type your message..."
              className="min-h-[52px] flex-1 resize-none border-2 border-[#0a0a0a] border-b-white border-r-white bg-white p-1 text-xs focus:outline-none shadow-window-in"
              maxLength={1000}
              rows={2}
            />
            <button
              type="submit"
              disabled={isSending || !draft.trim()}
              className="cursor-pointer self-end border-2 border-white border-b-[#0a0a0a] border-r-[#0a0a0a] bg-os-grey px-2 py-1 text-xs font-bold active:border-b-white active:border-l-[#0a0a0a] active:border-r-white active:border-t-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSending ? '...' : 'Send'}
            </button>
          </form>

          <div className="border border-[#8b93ac] bg-white px-2 py-1 text-[11px]">
            <span className="mr-1 font-bold text-os-dark-grey">Message Preview:</span>
            <span
              className="aim-rich-html"
              dangerouslySetInnerHTML={{
                __html: sanitizeRichTextHtml(
                  formatRichText(draft || 'Type a message to preview styles.', format),
                ),
              }}
            />
          </div>
        </div>
      </RetroWindow>
    </div>
  );
}
