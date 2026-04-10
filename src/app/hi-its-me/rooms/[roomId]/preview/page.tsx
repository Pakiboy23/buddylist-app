'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  invite_code?: string;
}

const ROOM_TYPE_LABELS: Record<string, string> = {
  public: 'Public',
  invite: 'Invite Only',
  private: 'Private',
};

function RoomPreviewContent({ roomId }: { roomId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viaInvite = searchParams.get('via') === 'invite';

  const [preview, setPreview] = useState<RoomPreview | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        p_room_id: roomId,
        p_user_id: session.user.id,
      });

      if (rpcError) {
        setError('Could not load room. It may not exist or you may not have access.');
        setIsLoading(false);
        return;
      }

      const row = (Array.isArray(data) ? data[0] : data) as RoomPreview | undefined;
      if (!row) {
        setError('Room not found or access denied.');
        setIsLoading(false);
        return;
      }

      // Fetch invite_code when the user is a member (used for the share button).
      if (row.is_member && row.room_type !== 'private') {
        const { data: roomData } = await supabase
          .from('chat_rooms')
          .select('invite_code')
          .eq('id', roomId)
          .maybeSingle();
        if (roomData?.invite_code) {
          row.invite_code = roomData.invite_code as string;
        }
      }

      setPreview(row);
      setIsLoading(false);
    }

    void load();
  }, [roomId]);

  // Auto-join for private rooms reached via an invite link.
  useEffect(() => {
    if (!viaInvite || !preview || preview.is_member || preview.room_type !== 'private' || !userId) {
      return;
    }
    void joinRoom(preview.id, userId).then((result) => {
      if ('success' in result) {
        router.replace(`/hi-its-me/rooms/${preview.id}`);
      } else {
        setError(result.error);
      }
    });
  }, [viaInvite, preview, userId, router]);

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

  async function handleShare() {
    if (!preview?.invite_code) return;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    await navigator.clipboard.writeText(`${appUrl}/join/${preview.invite_code}`);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 2000);
  }

  const canShare =
    preview?.is_member &&
    (preview.room_type === 'public' || preview.room_type === 'invite') &&
    Boolean(preview.invite_code);

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

          {/* Stats */}
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

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-end gap-2">
            {canShare ? (
              <button
                type="button"
                onClick={() => void handleShare()}
                className="ui-focus-ring ui-button-secondary rounded-2xl px-4 py-2.5 text-[length:var(--ui-text-md)]"
              >
                {copied ? 'Copied!' : 'Share Room'}
              </button>
            ) : null}

            {preview.is_member ? (
              <button
                type="button"
                onClick={() => router.push(`/hi-its-me/rooms/${preview.id}`)}
                className="ui-focus-ring ui-button-primary rounded-2xl px-5 py-2.5 text-[length:var(--ui-text-md)]"
              >
                Open Room
              </button>
            ) : viaInvite && preview.room_type === 'private' ? (
              <p className="text-[length:var(--ui-text-sm)] text-slate-400">Joining…</p>
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

export default function RoomPreviewPage({
  params,
}: {
  params: { roomId: string };
}) {
  return (
    <Suspense fallback={null}>
      <RoomPreviewContent roomId={params.roomId} />
    </Suspense>
  );
}
