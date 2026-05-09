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

const REPORT_REASONS = [
  { value: 'harassment', label: 'Harassment' },
  { value: 'spam', label: 'Spam' },
  { value: 'impersonation', label: 'Impersonation' },
  { value: 'other', label: 'Other' },
] as const;

export default function DiscoveryProfileSheet({ userId, currentUserId, onClose }: DiscoveryProfileSheetProps) {
  const [profile, setProfile] = useState<DiscoveryProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Buddy request
  const [feedback, setFeedback] = useState<string | null>(null);
  const [status, setStatus] = useState<BuddyRequestStatus | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  // Block
  const [isBlocked, setIsBlocked] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);

  // Report
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportNotes, setReportNotes] = useState('');
  const [isReporting, setIsReporting] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    void Promise.all([
      supabase
        .from('users')
        .select('id,screenname,away_message,profile_bio')
        .eq('id', userId)
        .maybeSingle(),
      supabase
        .from('blocked_users')
        .select('blocker_id')
        .eq('blocker_id', currentUserId)
        .eq('blocked_id', userId)
        .maybeSingle(),
    ]).then(([{ data: profileData }, { data: blockData }]) => {
      if (cancelled) return;
      if (profileData) {
        setProfile({
          id: profileData.id as string,
          screenname: ((profileData.screenname as string) ?? '').trim() || 'Unknown User',
          awayMessage: (profileData.away_message as string | null) || null,
          bio: (profileData.profile_bio as string | null) || null,
        });
      }
      setIsBlocked(!!blockData);
      setIsLoading(false);
    });

    return () => { cancelled = true; };
  }, [userId, currentUserId]);

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

  const handleBlock = useCallback(async () => {
    if (isBlocking) return;
    setIsBlocking(true);
    const { error } = await supabase
      .from('blocked_users')
      .insert({ blocker_id: currentUserId, blocked_id: userId });
    if (!error) setIsBlocked(true);
    setIsBlocking(false);
    setShowBlockConfirm(false);
  }, [currentUserId, userId, isBlocking]);

  const handleReport = useCallback(async () => {
    if (!reportReason || isReporting) return;
    setIsReporting(true);
    await supabase.from('abuse_reports').insert({
      reporter_id: currentUserId,
      target_user_id: userId,
      category: reportReason,
      details: reportNotes.trim() || null,
    });
    setIsReporting(false);
    setReportDone(true);
    setShowReportForm(false);
  }, [currentUserId, userId, reportReason, reportNotes, isReporting]);

  const buddyButtonLabel = isAdding
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
              {buddyButtonLabel}
            </button>

            {/* Block confirmation modal */}
            {showBlockConfirm ? (
              <div className="rounded-2xl bg-[var(--bg3)] p-4 space-y-3">
                <p className="text-[13px] text-slate-300">
                  Block{' '}
                  <span className="font-semibold text-slate-100">{profile.screenname}</span>?
                  They won&rsquo;t appear in Browse or Search, and their messages won&rsquo;t be visible to you.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBlockConfirm(false)}
                    className="ui-focus-ring ui-button-secondary ui-button-compact flex-1 justify-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleBlock()}
                    disabled={isBlocking}
                    className="ui-focus-ring ui-button-compact flex-1 justify-center rounded-xl bg-red-600 text-[13px] font-semibold text-white disabled:opacity-50"
                  >
                    {isBlocking ? 'Blocking…' : 'Block'}
                  </button>
                </div>
              </div>
            ) : null}

            {/* Report form */}
            {showReportForm ? (
              <div className="rounded-2xl bg-[var(--bg3)] p-4 space-y-3">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-slate-400">Report</p>
                <div className="grid grid-cols-2 gap-2">
                  {REPORT_REASONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setReportReason(value)}
                      className={[
                        'ui-focus-ring rounded-xl px-3 py-2 text-[12px] font-medium transition-colors',
                        reportReason === value
                          ? 'bg-[var(--rose)] text-white'
                          : 'bg-[var(--bg2)] text-slate-300',
                      ].join(' ')}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <textarea
                  value={reportNotes}
                  onChange={(e) => setReportNotes(e.target.value)}
                  placeholder="Additional details (optional)"
                  rows={2}
                  maxLength={1200}
                  className="w-full resize-none rounded-xl bg-[var(--bg2)] px-3 py-2 text-[13px] text-slate-200 placeholder-slate-500 focus:outline-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowReportForm(false); setReportReason(''); setReportNotes(''); }}
                    className="ui-focus-ring ui-button-secondary ui-button-compact flex-1 justify-center"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleReport()}
                    disabled={!reportReason || isReporting}
                    className="ui-focus-ring ui-button-primary ui-button-compact flex-1 justify-center disabled:opacity-40"
                  >
                    {isReporting ? 'Sending…' : 'Submit'}
                  </button>
                </div>
              </div>
            ) : null}

            {reportDone ? (
              <p className="text-center text-[12px] text-slate-400">Report submitted. Thanks for keeping H.I.M. safe.</p>
            ) : null}

            {/* Block + Report action row */}
            {!showBlockConfirm && !showReportForm ? (
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowBlockConfirm(true)}
                  disabled={isBlocked}
                  className="ui-focus-ring text-[11px] text-slate-500 disabled:opacity-40 hover:text-red-400 transition-colors"
                >
                  {isBlocked ? 'Blocked' : 'Block'}
                </button>
                {!reportDone ? (
                  <button
                    type="button"
                    onClick={() => setShowReportForm(true)}
                    className="ui-focus-ring text-[11px] text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    Report
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="py-4 text-center text-[13px] text-slate-400">Could not load profile.</p>
        )}
      </div>
    </div>
  );
}
