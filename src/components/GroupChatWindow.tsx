'use client';

import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

interface RoomTypingPayload {
  userId?: string;
  screenname?: string;
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
  initialUnreadCount?: number;
  typingUsers?: string[];
  onBack: () => void;
  onLeave: () => void;
  onSignOff?: () => void;
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
  typingUsers = [],
  onBack,
  onLeave,
  onSignOff,
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
  const [hasLiveMessageSinceOpen, setHasLiveMessageSinceOpen] = useState(false);
  const [typingMap, setTypingMap] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const roomChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTypingSentAtRef = useRef(0);
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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
    setHasLiveMessageSinceOpen(true);
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
    if (nextValue.trim()) {
      notifyTyping();
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

  const normalizedInitialUnreadCount = Math.max(0, Math.floor(initialUnreadCount));
  const separatorIndex =
    !isLoadingMessages &&
    !hasLiveMessageSinceOpen &&
    normalizedInitialUnreadCount > 0 &&
    messages.length > 0
      ? Math.max(0, messages.length - normalizedInitialUnreadCount)
      : null;

  return (
    <div className="fixed inset-0 z-50">
      <RetroWindow
        title={`#${roomName}`}
        variant="xp_shell"
        xpTitleText={`Chat Room: ${roomName}`}
        onXpClose={onBack}
        onXpSignOff={onSignOff}
      >
        <div className="flex h-full min-h-0 flex-col bg-[#ece9d8] font-[Tahoma,Arial,sans-serif] text-[11px]">
          <div className="m-2 mb-0 flex min-h-0 flex-1 flex-col overflow-y-auto border-2 border-t-[#808080] border-l-[#808080] border-b-white border-r-white bg-white p-2">
            <p className="mb-0.5 font-bold text-[#1e395b]">Room: #{roomName}</p>
            <p className="mb-2 truncate text-[11px] text-[#4f607c]">
              Participants:{' '}
              {participants.length === 0
                ? 'No one else is here yet.'
                : participants
                    .map((participant) =>
                      participant.userId === currentUserId ? `${participant.screenname} (You)` : participant.screenname,
                    )
                    .join(', ')}
            </p>

            {isLoadingMessages && <p className="italic text-slate-500">Loading room history...</p>}
            {!isLoadingMessages && messages.length === 0 && (
              <p className="italic text-slate-500">No messages yet. Start the room conversation.</p>
            )}
            {!isLoadingMessages && (
              <div className="space-y-1">
                {messages.map((message, index) => {
                  const senderName = screennameMap[message.sender_id] || 'Unknown User';
                  const isMine = message.sender_id === currentUserId;
                  const senderClassName = isMine
                    ? 'text-blue-600'
                    : getStableSenderColorClass(message.sender_id);
                  const timestampDate = new Date(message.created_at);
                  const timestamp = timestampDate.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const fullTimestamp = timestampDate.toLocaleString();

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
                          {isMine ? 'You' : senderName}:
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
            <div className="mx-2 mb-2 border border-[#b7b7b7] bg-[#ece9d8] p-1">
              <RichTextToolbar value={format} onChange={setFormat} />
            </div>
          ) : null}

          {typingText ? (
            <p className="mx-2 mb-1 text-[11px] italic text-[#2d5c9a]">{typingText}</p>
          ) : null}

          <div className="m-2 mt-0 flex items-stretch gap-2">
            <form
              onSubmit={handleSendMessage}
              className="flex h-16 flex-1 items-stretch gap-2 border-2 border-t-[#808080] border-l-[#808080] border-b-white border-r-white bg-white p-1"
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
          {error && <p className="mx-2 mb-2 text-[11px] text-red-700">{error}</p>}
        </div>
      </RetroWindow>
    </div>
  );
}
