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
  isAdminUser?: boolean;
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
  isAdminUser = false,
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
  const [isAdminActionBusy, setIsAdminActionBusy] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getAccessToken = useCallback(async () => {
    const { data, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) {
      console.error('Failed to read session token:', sessionError.message);
      return null;
    }

    return data.session?.access_token ?? null;
  }, []);

  const readApiError = async (response: Response) => {
    try {
      const payload = (await response.json()) as { error?: string };
      if (payload?.error) {
        return payload.error;
      }
    } catch {
      // ignore parse failures and fall back to status text
    }

    return `Request failed (${response.status}).`;
  };

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

    roomChannel.on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'room_messages', filter: `room_id=eq.${roomId}` },
      (payload) => {
        const deleted = payload.old as { id?: string };
        if (!deleted?.id) {
          return;
        }
        setMessages((previous) => previous.filter((message) => message.id !== deleted.id));
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

  const toggleBold = () => {
    setFormat((previous) => ({ ...previous, bold: !previous.bold }));
  };

  const toggleItalic = () => {
    setFormat((previous) => ({ ...previous, italic: !previous.italic }));
  };

  const toggleUnderline = () => {
    setFormat((previous) => ({ ...previous, underline: !previous.underline }));
  };

  const runAdminChatAction = useCallback(
    async (payload: { action: 'delete_message'; messageId: string } | { action: 'clear_room' | 'reset_room'; roomId: string }) => {
      if (!isAdminUser || isAdminActionBusy) {
        return;
      }

      setIsAdminActionBusy(true);
      setError(null);

      const accessToken = await getAccessToken();
      if (!accessToken) {
        setError('Session expired. Please sign on again.');
        setIsAdminActionBusy(false);
        return;
      }

      const response = await fetch('/api/admin/chat-room', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorMessage = await readApiError(response);
        setError(errorMessage);
        setIsAdminActionBusy(false);
        return;
      }

      if (payload.action === 'delete_message') {
        setMessages((previous) => previous.filter((message) => message.id !== payload.messageId));
      }

      if (payload.action === 'clear_room' || payload.action === 'reset_room') {
        setMessages([]);
      }

      setIsAdminActionBusy(false);
    },
    [getAccessToken, isAdminActionBusy, isAdminUser],
  );

  const xpTinyToolbarButtonClass = (active = false) =>
    `inline-flex h-5 min-w-5 items-center justify-center border px-1 text-[11px] font-bold text-[#1e395b] ${
      active
        ? 'border-[#7f7f7f] border-t-[#9d9d9d] border-l-[#9d9d9d] border-r-white border-b-white bg-[#dde4ef]'
        : 'border-[#7f7f7f] border-t-white border-l-white border-r-[#808080] border-b-[#808080] bg-[#ece9d8]'
    }`;

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
            {isAdminUser ? (
              <div className="mb-2 flex flex-wrap gap-1">
                <button
                  type="button"
                  disabled={isAdminActionBusy}
                  onClick={() => {
                    const confirmed = window.confirm('Clear all messages from this room?');
                    if (confirmed) {
                      void runAdminChatAction({ action: 'clear_room', roomId });
                    }
                  }}
                  className="border border-[#7f7f7f] border-t-white border-l-white border-r-[#808080] border-b-[#808080] bg-[#ece9d8] px-2 py-0.5 text-[10px] font-bold text-[#1e395b] disabled:opacity-60"
                >
                  Clear Room
                </button>
                <button
                  type="button"
                  disabled={isAdminActionBusy}
                  onClick={() => {
                    const confirmed = window.confirm('Reset this room (clear messages and active-room state)?');
                    if (confirmed) {
                      void runAdminChatAction({ action: 'reset_room', roomId });
                    }
                  }}
                  className="border border-[#7f7f7f] border-t-white border-l-white border-r-[#808080] border-b-[#808080] bg-[#ece9d8] px-2 py-0.5 text-[10px] font-bold text-[#7b1f1f] disabled:opacity-60"
                >
                  Reset Room
                </button>
              </div>
            ) : null}
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
                {messages.map((message) => {
                  const senderName = screennameMap[message.sender_id] || 'Unknown User';
                  const isMine = message.sender_id === currentUserId;
                  const senderClassName = isMine
                    ? 'text-blue-600'
                    : getStableSenderColorClass(message.sender_id);
                  const timestamp = new Date(message.created_at).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div key={message.id} className="flex flex-wrap items-baseline gap-x-1 leading-4">
                      <span className="text-[11px] text-gray-500">[{timestamp}]</span>
                      <span className={`font-bold ${senderClassName}`}>
                        {isMine ? 'You' : senderName}:
                      </span>
                      <span
                        className="aim-rich-html text-gray-900"
                        dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(message.content) }}
                      />
                      {isAdminUser ? (
                        <button
                          type="button"
                          disabled={isAdminActionBusy}
                          onClick={() => {
                            const confirmed = window.confirm('Delete this message?');
                            if (confirmed) {
                              void runAdminChatAction({ action: 'delete_message', messageId: message.id });
                            }
                          }}
                          className="ml-1 border border-[#b95f5f] bg-[#ffe5e5] px-1 py-0 text-[10px] font-bold text-[#8b2020] disabled:opacity-60"
                          title="Delete message"
                        >
                          Del
                        </button>
                      ) : null}
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

          <div className="m-2 mt-0 flex items-stretch gap-2">
            <form
              onSubmit={handleSendMessage}
              className="flex h-16 flex-1 items-stretch gap-2 border-2 border-t-[#808080] border-l-[#808080] border-b-white border-r-white bg-white p-1"
            >
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
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
