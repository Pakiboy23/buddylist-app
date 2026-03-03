'use client';

import { FormEvent, KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import RetroWindow from '@/components/RetroWindow';
import RichTextToolbar from '@/components/RichTextToolbar';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_RICH_TEXT_FORMAT,
  formatRichText,
  RichTextFormat,
  sanitizeRichTextHtml,
} from '@/lib/richText';
import { useChatContext } from '@/context/ChatContext';

interface RoomMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
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

interface RoomProfile {
  id: string;
  screenname: string | null;
}

interface GroupChatWindowProps {
  roomId: string;
  roomName: string;
  currentUserId: string;
  currentUserScreenname: string;
  onBack: () => void;
  onLeave: () => void;
}

export default function GroupChatWindow({
  roomId,
  roomName,
  currentUserId,
  currentUserScreenname,
  onBack,
  onLeave,
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
  const [draft, setDraft] = useState('');
  const [format, setFormat] = useState<RichTextFormat>(DEFAULT_RICH_TEXT_FORMAT);
  const [showFormatting, setShowFormatting] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    screennameMapRef.current = screennameMap;
  }, [screennameMap]);

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
        .select('id,room_id,sender_id,content,created_at')
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
  }, [ensureScreennames, roomId]);

  useEffect(() => {
    const roomChannel = supabase.channel(`active_chat_room:${roomId}`, {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });

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
        void clearUnreads(roomName);
        void ensureScreennames([incoming.sender_id]);
      },
    );

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
      void roomChannel.untrack();
      roomChannel.unsubscribe();
    };
  }, [clearUnreads, currentUserId, currentUserScreenname, ensureScreennames, roomId, roomName]);

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed || isSending) {
      return;
    }

    setIsSending(true);
    setError(null);

    const formatted = formatRichText(trimmed, format);
    const { data, error: sendError } = await supabase
      .from('room_messages')
      .insert({
        room_id: roomId,
        sender_id: currentUserId,
        content: formatted,
      })
      .select('id,room_id,sender_id,content,created_at')
      .single();

    setIsSending(false);

    if (sendError) {
      setError(sendError.message);
      return;
    }

    const insertedMessage = data as RoomMessage;
    setMessages((previous) =>
      previous.some((message) => message.id === insertedMessage.id)
        ? previous
        : [...previous, insertedMessage],
    );
    setDraft('');
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
    <div className="fixed inset-0 z-50">
      <RetroWindow
        title={`#${roomName}`}
        showBackButton
        backButtonLabel="<"
        onBack={onBack}
        headerActions={
          <button
            type="button"
            onClick={onLeave}
            className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-md border border-white/40 bg-white/20 px-2 text-xs font-bold text-white transition-colors hover:bg-white/30"
            aria-label="Leave room"
            title="Leave room"
          >
            X
          </button>
        }
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="mb-2 rounded-lg border border-blue-200 bg-white/85 px-3 py-2">
            <p className="text-xs font-bold text-blue-700">Room: #{roomName}</p>
            <div className="mt-1 flex gap-2 overflow-x-auto pb-1 text-xs">
              {participants.length === 0 ? (
                <p className="italic text-slate-500">No one else is here yet.</p>
              ) : (
                participants.map((participant) => (
                  <span
                    key={participant.userId}
                    className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-1 whitespace-nowrap"
                  >
                    <span className="text-emerald-600">●</span>
                    <span className="font-semibold text-slate-700">
                      {participant.userId === currentUserId
                        ? `${participant.screenname} (You)`
                        : participant.screenname}
                    </span>
                  </span>
                ))
              )}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-blue-200 bg-white px-3 py-2">
            {isLoadingMessages && <p className="italic text-slate-500">Loading room history...</p>}
            {!isLoadingMessages && messages.length === 0 && (
              <p className="italic text-slate-500">No messages yet. Start the room conversation.</p>
            )}
            {!isLoadingMessages && (
              <div className="space-y-1">
                {messages.map((message) => {
                  const senderName = screennameMap[message.sender_id] || 'Unknown User';
                  const isMine = message.sender_id === currentUserId;
                  const timestamp = new Date(message.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div key={message.id} className="flex flex-wrap items-baseline gap-x-1 text-sm leading-5">
                      <span className="text-xs text-gray-500">[{timestamp}]</span>
                      <span className="font-bold text-blue-600">{isMine ? 'You' : senderName}:</span>
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

          <div className="mt-2 shrink-0 border-t border-blue-200 bg-white/95 px-2 pb-2 pt-2 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
            {showFormatting ? (
              <div className="mb-2 rounded-md border border-blue-200 bg-blue-50/40 p-2">
                <RichTextToolbar value={format} onChange={setFormat} />
              </div>
            ) : null}

            <form onSubmit={handleSendMessage} className="flex items-end gap-2">
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
                placeholder={`Message #${roomName}`}
                className="min-h-[44px] max-h-36 flex-1 resize-none rounded-md border border-blue-300 bg-white px-3 py-2 text-sm shadow-[inset_0_1px_3px_rgba(37,99,235,0.18)] focus:outline-none"
                maxLength={1500}
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

            {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
          </div>
        </div>
      </RetroWindow>
    </div>
  );
}
