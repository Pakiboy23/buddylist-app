'use client';

import { FormEvent, MouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import RetroWindow from '@/components/RetroWindow';
import RichTextToolbar from '@/components/RichTextToolbar';
import { supabase } from '@/lib/supabase';
import {
  DEFAULT_RICH_TEXT_FORMAT,
  formatRichText,
  RichTextFormat,
  sanitizeRichTextHtml,
} from '@/lib/richText';

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
  onClose: () => void;
}

export default function GroupChatWindow({
  roomId,
  roomName,
  currentUserId,
  currentUserScreenname,
  onClose,
}: GroupChatWindowProps) {
  const [position, setPosition] = useState({ x: 140, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

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
  const [isSending, setIsSending] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

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
    if (!historyRef.current) {
      return;
    }
    historyRef.current.scrollTop = historyRef.current.scrollHeight;
  }, [messages, isLoadingMessages]);

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

  const handleTitleBarMouseDown = (event: MouseEvent<HTMLDivElement>) => {
    dragOffsetRef.current = {
      x: event.clientX - position.x,
      y: event.clientY - position.y,
    };
    setIsDragging(true);
    event.preventDefault();
  };

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
    const roomChannel = supabase.channel(`room:${roomId}`, {
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
      void supabase.removeChannel(roomChannel);
    };
  }, [currentUserId, currentUserScreenname, ensureScreennames, roomId]);

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

  return (
    <div
      className="w-[min(96vw,780px)]"
      style={{ position: 'fixed', left: position.x, top: position.y, zIndex: 55 }}
    >
      <RetroWindow
        title={`Chat Room: ${roomName}`}
        onTitleBarMouseDown={handleTitleBarMouseDown}
        titleBarClassName={isDragging ? 'cursor-grabbing' : 'cursor-grab'}
      >
        <div className="flex items-center justify-between pb-1">
          <p className="text-xs font-bold text-os-blue">Room: #{roomName}</p>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer border-2 border-white border-b-[#0a0a0a] border-r-[#0a0a0a] bg-os-grey px-2 py-[1px] text-[11px] font-bold active:border-b-white active:border-l-[#0a0a0a] active:border-r-white active:border-t-[#0a0a0a]"
          >
            X
          </button>
        </div>

        <div className="flex min-h-[380px] gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div
              ref={historyRef}
              className="h-[280px] overflow-y-auto border-2 border-[#0a0a0a] border-b-white border-r-white bg-white p-2 shadow-window-in"
            >
              {isLoadingMessages && <p className="italic text-os-dark-grey">Loading room history...</p>}
              {!isLoadingMessages && messages.length === 0 && (
                <p className="italic text-os-dark-grey">No messages yet. Start the room conversation.</p>
              )}
              {!isLoadingMessages &&
                messages.map((message) => {
                  const senderName = screennameMap[message.sender_id] || 'Unknown User';
                  const isMine = message.sender_id === currentUserId;
                  const timestamp = new Date(message.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div key={message.id} className="mb-2">
                      <p className="mb-[2px] text-[10px] font-bold text-os-dark-grey">
                        {isMine ? 'You' : senderName} at {timestamp}
                      </p>
                      <div
                        className={`aim-rich-html border px-2 py-1 text-xs ${
                          isMine ? 'border-os-blue bg-[#e6ebff]' : 'border-os-dark-grey bg-[#f4f4f4]'
                        }`}
                        dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(message.content) }}
                      />
                    </div>
                  );
                })}
            </div>

            <RichTextToolbar value={format} onChange={setFormat} />

            <form onSubmit={handleSendMessage} className="flex gap-1">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={`Message #${roomName}`}
                className="min-h-[68px] flex-1 resize-none border-2 border-[#0a0a0a] border-b-white border-r-white bg-white p-1 text-xs focus:outline-none shadow-window-in"
                maxLength={1500}
                rows={3}
              />
              <button
                type="submit"
                disabled={isSending || !draft.trim()}
                className="cursor-pointer self-end border-2 border-white border-b-[#0a0a0a] border-r-[#0a0a0a] bg-os-grey px-2 py-1 text-xs font-bold active:border-b-white active:border-l-[#0a0a0a] active:border-r-white active:border-t-[#0a0a0a] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSending ? '...' : 'Send'}
              </button>
            </form>

            {error && (
              <p className="border border-red-700 bg-[#ffe9e9] px-2 py-1 text-xs text-red-700">{error}</p>
            )}
          </div>

          <div className="w-[170px] shrink-0 border-2 border-[#0a0a0a] border-b-white border-r-white bg-white p-1 shadow-window-in">
            <p className="mb-1 border-b border-os-light-grey pb-1 text-xs font-bold text-os-blue">
              In Room ({participants.length})
            </p>
            <div className="max-h-[340px] overflow-y-auto text-xs">
              {participants.length === 0 && (
                <p className="italic text-os-dark-grey">No one else is here yet.</p>
              )}
              {participants.map((participant) => (
                <div key={participant.userId} className="mb-[2px] flex items-center gap-1">
                  <span className="text-green-700">●</span>
                  <span className="truncate font-bold">
                    {participant.userId === currentUserId ? `${participant.screenname} (You)` : participant.screenname}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </RetroWindow>
    </div>
  );
}
