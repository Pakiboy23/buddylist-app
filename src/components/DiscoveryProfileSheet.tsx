import { useCallback, useEffect, useState } from 'react';
import AppIcon from '@/components/AppIcon';
import { sendOrAcceptBuddyRequest, type BuddyRequestStatus } from '@/lib/buddyRequest';
import { supabase } from '@/lib/supabase';

interface DiscoveryProfile {
  id: string;
  screenname: string;
  awayMessage: string | null;
  bio: string | null;
}

interface DiscoveryProfileSheetProps {
  userId: string;
  currentUserId: string;
  onClose: () => void;
}

export default function DiscoveryProfileSheet({ userId, currentUserId, onClose }: DiscoveryProfileSheetProps) {
  const [profile, setProfile] = useState<DiscoveryProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [status, setStatus] = useState<BuddyRequestStatus | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    void supabase
      .from('users')
      .select('id,screenname,away_message,profile_bio')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          setProfile({
            id: data.id as string,
            screenname: ((data.screenname as string) ?? '').trim() || 'Unknown User',
            awayMessage: (data.away_message as string | null) || null,
            bio: (data.profile_bio as string | null) || null,
          });
        }
        setIsLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId]);

  const handleAdd = useCallback(async () => {
    if (isAdding || status !== null) return;
    setIsAdding(true);
    try {
      const result = await sendOrAcceptBuddyRequest(currentUserId, userId);
      setFeedback(result.feedback);
      setStatus(result.status);
    } catch {
      setFeedback('Could not send buddy request right now.');
      setStatus('error');
    } finally {
      setIsAdding(false);
    }
  }, [currentUserId, userId, isAdding, status]);

  const buttonLabel = isAdding
    ? 'Sending…'
    : status === 'already_accepted'
      ? 'Already in H.I.M. contacts'
      : status === 'already_sent'
        ? 'Request Pending'
        : status === 'sent' || status === 'accepted_incoming'
          ? 'Request Sent'
          : 'Add to Buddylist';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Member profile"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-label="Close profile"
      />
      <div className="relative z-10 rounded-t-[1.75rem] bg-[var(--bg2)] px-4 pb-8 pt-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--rose)]">Profile</p>
          <button type="button" onClick={onClose} className="ui-focus-ring ui-conversation-action" aria-label="Close">
            <AppIcon kind="close" className="h-3.5 w-3.5" />
          </button>
        </div>

        {isLoading ? (
          <div className="space-y-3 py-4">
            <div className="ui-skeleton mx-auto h-5 w-32 rounded-full" />
            <div className="ui-skeleton h-4 w-full rounded-full" />
            <div className="ui-skeleton h-4 w-3/4 rounded-full" />
          </div>
        ) : profile ? (
          <div className="space-y-4">
            <div>
              <p className="text-[22px] font-bold text-slate-100">{profile.screenname}</p>
              {profile.awayMessage ? (
                <p className="mt-1 text-[13px] italic text-slate-400">&ldquo;{profile.awayMessage}&rdquo;</p>
              ) : null}
              {profile.bio ? (
                <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{profile.bio}</p>
              ) : null}
            </div>
            {feedback ? (
              <p className="text-[12px] font-semibold text-[var(--green)]">{feedback}</p>
            ) : null}
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={isAdding || status !== null}
              className="ui-focus-ring ui-button-primary ui-button-compact w-full justify-center disabled:opacity-40"
            >
              {buttonLabel}
            </button>
          </div>
        ) : (
          <p className="py-4 text-center text-[13px] text-slate-400">Could not load profile.</p>
        )}
      </div>
    </div>
  );
}
