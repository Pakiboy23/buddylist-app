'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import RetroWindow from '@/components/RetroWindow';
import { supabase } from '@/lib/supabase';
import { waitForSessionOrNull } from '@/lib/authClient';
import { joinRoom } from './actions';

interface RoomPreview {
  id: string;
  name: string;
  description: string | null;
  tags: string[] | null;
  room_type: string;
  member_cap: number | null;
  member_count: number;
  buddy_overlap_count: number;
  is_member: boolean;
}

const ROOM_TYPE_LABELS: Record<string, string> = {
  public: 'Public',
  invite: 'Invite Only',
  private: 'Private',
};

export default function RoomPreviewPage({
  params,
}: {
  params: { roomId: string };
}) {
  const router = useRouter();
  const [preview, setPreview] = useState<RoomPreview | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
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

      const { data, error: rpcError } = await supabase.rpc('get_room_preview', {
        p_room_id: params.roomId,
        p_user_id: session.user.id,
      });

      if (rpcError) {
        setError('Could not load room. It may not exist or you may not have access.');
        setIsLoading(false);
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      if (!row) {
        setError('Room not found or access denied.');
        setIsLoading(false);
        return;
      }

      setPreview(row as RoomPreview);
      setIsLoading(false);
    }

    void load();
  }, [params.roomId]);

  async function handleJoin() {
    if (!userId || !preview) return;
    setIsJoining(true);
    const result = await joinRoom(preview.id, userId);
    if ('error' in result) {
      setError(result.error);
      setIsJoining(false);
      return;
    }
    router.push(`/hi-its-me/rooms/${preview.id}`);
  }

  return (
    <RetroWindow
      title={preview?.name ?? 'Room'}
      showBackButton
      onBack={() => router.push('/hi-its-me/rooms')}
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
      ) : preview ? (
        <div className="space-y-4">
          {/* Main info card */}
          <div className="ui-panel-card rounded-[1.6rem] px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <h1 className="ui-screenname text-[length:var(--ui-text-xl)] font-semibold text-slate-800">
                {preview.name}
              </h1>
              <span className="shrink-0 rounded-xl bg-slate-100 px-2.5 py-1 text-[length:var(--ui-text-2xs)] font-semibold uppercase tracking-widest text-slate-500 dark:bg-[#13100E] dark:text-slate-300">
                {ROOM_TYPE_LABELS[preview.room_type] ?? preview.room_type}
              </span>
            </div>

            {preview.description ? (
              <p className="mt-2 text-[length:var(--ui-text-sm)] text-slate-600">
                {preview.description}
              </p>
            ) : null}

            {preview.tags && preview.tags.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {preview.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-lg bg-slate-100 px-2 py-0.5 text-[length:var(--ui-text-2xs)] font-medium text-slate-500 dark:bg-[#13100E] dark:text-slate-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}
          </div>

          {/* Stats card */}
          <div className="ui-panel-muted rounded-[1.4rem] px-4 py-3">
            <p className="text-[length:var(--ui-text-sm)] text-slate-700">
              <span className="font-semibold">{preview.member_count}</span>{' '}
              {preview.member_count === 1 ? 'member' : 'members'}
              {preview.member_cap ? ` · max ${preview.member_cap}` : null}
            </p>
            {preview.buddy_overlap_count > 0 ? (
              <p className="mt-1 text-[length:var(--ui-text-sm)] text-[var(--rose)]">
                <span className="font-semibold">{preview.buddy_overlap_count}</span> of your buddies{' '}
                {preview.buddy_overlap_count === 1 ? 'is' : 'are'} here
              </p>
            ) : null}
          </div>

          {/* Action */}
          <div className="flex justify-end">
            {preview.is_member ? (
              <button
                type="button"
                onClick={() => router.push(`/hi-its-me/rooms/${preview.id}`)}
                className="ui-focus-ring ui-button-primary rounded-2xl px-5 py-2.5 text-[length:var(--ui-text-md)]"
              >
                Open Room
              </button>
            ) : (
              <button
                type="button"
                onClick={handleJoin}
                disabled={isJoining}
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
