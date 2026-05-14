import { Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import RetroWindow from '@/components/RetroWindow';
import { supabase } from '@/lib/supabase';
import { waitForSessionOrNull } from '@/lib/authClient';
import { joinRoom, leaveRoom } from './actions';

interface RoomDetail {
  id: string;
  slug: string;
  name: string;
  description: string;
  kind: 'regional' | 'vibe';
  is_active: boolean;
}

const KIND_LABEL: Record<string, string> = { regional: 'City', vibe: 'Vibe' };

function RoomPreviewContent({ roomId }: { roomId: string }) {
  const navigate = useNavigate();

  const [room, setRoom] = useState<RoomDetail | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const session = await waitForSessionOrNull();
      if (!session) {
        setError('You must be signed in to view this room.');
        setIsLoading(false);
        return;
      }
      setUserId(session.user.id);

      const [roomResult, membershipResult, countResult] = await Promise.all([
        supabase
          .from('rooms')
          .select('id,slug,name,description,kind,is_active')
          .eq('id', roomId)
          .single(),
        supabase
          .from('room_memberships')
          .select('user_id')
          .eq('room_id', roomId)
          .eq('user_id', session.user.id)
          .maybeSingle(),
        supabase
          .from('room_memberships')
          .select('user_id', { count: 'exact', head: true })
          .eq('room_id', roomId),
      ]);

      if (roomResult.error || !roomResult.data) {
        setError('Room not found.');
        setIsLoading(false);
        return;
      }

      setRoom(roomResult.data as RoomDetail);
      setIsMember(Boolean(membershipResult.data));
      setMemberCount(countResult.count ?? 0);
      setIsLoading(false);
    }

    void load();
  }, [roomId]);

  async function handleJoin() {
    if (!userId || !room) return;
    setIsJoining(true);
    const result = await joinRoom(room.id, userId);
    if ('error' in result) {
      setError(result.error);
      setIsJoining(false);
      return;
    }
    setIsMember(true);
    setMemberCount((c) => c + 1);
    setIsJoining(false);
    navigate(`/hi-its-me?tab=chat&room=${encodeURIComponent(room.slug)}`);
  }

  async function handleLeave() {
    if (!userId || !room) return;
    setIsLeaving(true);
    const result = await leaveRoom(room.id, userId);
    if ('error' in result) {
      setError(result.error);
      setIsLeaving(false);
      return;
    }
    setIsMember(false);
    setMemberCount((c) => Math.max(0, c - 1));
    setIsLeaving(false);
  }

  return (
    <RetroWindow
      title={room?.name ?? 'Room'}
      showBackButton
      onBack={() => navigate('/hi-its-me/rooms')}
    >
      {isLoading ? (
        <div className="flex h-48 items-center justify-center">
          <p className="text-[length:var(--ui-text-sm)] text-slate-400">Loading…</p>
        </div>
      ) : error ? (
        <div className="mt-6 px-1">
          <p role="alert" className="ui-note-error text-[length:var(--ui-text-sm)] font-semibold">
            {error}
          </p>
        </div>
      ) : room ? (
        <div className="space-y-4">
          <div className="ui-panel-card rounded-[1.6rem] px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <h1 className="ui-screenname text-[length:var(--ui-text-xl)] font-semibold text-slate-800 dark:text-slate-100">
                {room.name}
              </h1>
              <span className="shrink-0 rounded-xl bg-slate-100 px-2.5 py-1 text-[length:var(--ui-text-2xs)] font-semibold uppercase tracking-widest text-slate-500 dark:bg-[#0F1424] dark:text-slate-300">
                {KIND_LABEL[room.kind] ?? room.kind}
              </span>
            </div>
            {room.description ? (
              <p className="mt-2 text-[length:var(--ui-text-sm)] text-slate-600 dark:text-slate-400">
                {room.description}
              </p>
            ) : null}
          </div>

          <div className="ui-panel-muted rounded-[1.4rem] px-4 py-3">
            <p className="text-[length:var(--ui-text-sm)] text-slate-700 dark:text-slate-300">
              <span className="font-semibold">{memberCount}</span>{' '}
              {memberCount === 1 ? 'member' : 'members'}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {isMember ? (
              <>
                <button
                  type="button"
                  onClick={() => void handleLeave()}
                  disabled={isLeaving}
                  className="ui-focus-ring ui-button-secondary rounded-2xl px-4 py-2.5 text-[length:var(--ui-text-md)] disabled:opacity-60"
                >
                  {isLeaving ? 'Leaving…' : 'Leave Room'}
                </button>
                <button
                  type="button"
                  onClick={() => navigate(`/hi-its-me?tab=chat&room=${encodeURIComponent(room.slug)}`)}
                  className="ui-focus-ring ui-button-primary rounded-2xl px-5 py-2.5 text-[length:var(--ui-text-md)]"
                >
                  Open Room
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void handleJoin()}
                disabled={isJoining || !room.is_active}
                className="ui-focus-ring ui-button-primary rounded-2xl px-5 py-2.5 text-[length:var(--ui-text-md)] disabled:opacity-60"
              >
                {isJoining ? 'Joining…' : 'Join Room'}
              </button>
            )}
          </div>
        </div>
      ) : null}
    </RetroWindow>
  );
}

export default function RoomPreviewPage() {
  const { roomId } = useParams<{ roomId: string }>();
  return (
    <Suspense fallback={null}>
      <RoomPreviewContent roomId={roomId!} />
    </Suspense>
  );
}
