'use client';

import { KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import AppIcon from '@/components/AppIcon';
import ProfileAvatar from '@/components/ProfileAvatar';
import { getPresenceLabel, type ResolvedPresenceState } from '@/lib/presence';
import {
  ABUSE_REPORT_CATEGORY_OPTIONS,
  type AbuseReportCategory,
} from '@/lib/trustSafety';

interface BuddyProfileSheetData {
  id: string;
  screenname: string;
  relationshipStatus: 'pending' | 'accepted';
  presenceState: ResolvedPresenceState;
  presenceDetail: string;
  statusLine: string | null;
  awayMessage: string | null;
  bio: string | null;
  buddyIconPath: string | null;
}

interface BuddyProfileSheetProps {
  buddy: BuddyProfileSheetData | null;
  isOpen: boolean;
  isUpdating?: boolean;
  errorMessage?: string | null;
  feedbackMessage?: string | null;
  isBlocked?: boolean;
  isBlocking?: boolean;
  isReporting?: boolean;
  onClose: () => void;
  onStartChat: () => void;
  onAddBuddy?: () => void;
  onRemoveBuddy?: () => void;
  onBlockBuddy?: () => void;
  onUnblockBuddy?: () => void;
  onSubmitReport?: (payload: { category: AbuseReportCategory; details: string }) => Promise<void> | void;
}

export default function BuddyProfileSheet({
  buddy,
  isOpen,
  isUpdating = false,
  errorMessage = null,
  feedbackMessage = null,
  isBlocked = false,
  isBlocking = false,
  isReporting = false,
  onClose,
  onStartChat,
  onAddBuddy,
  onRemoveBuddy,
  onBlockBuddy,
  onUnblockBuddy,
  onSubmitReport,
}: BuddyProfileSheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportCategory, setReportCategory] = useState<AbuseReportCategory>('harassment');
  const [reportDetails, setReportDetails] = useState('');
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);

  useEffect(() => {
    if (!isOpen || !buddy) {
      return;
    }

    previouslyFocusedElementRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeButtonRef.current?.focus();

    return () => {
      previouslyFocusedElementRef.current?.focus();
    };
  }, [buddy, isOpen]);

  if (!isOpen || !buddy) {
    return null;
  }

  const showAddAction = buddy.relationshipStatus !== 'accepted' && Boolean(onAddBuddy);
  const showRemoveAction = buddy.relationshipStatus === 'accepted' && Boolean(onRemoveBuddy);
  const hasSafetyActions = Boolean(onBlockBuddy || onUnblockBuddy || onSubmitReport);
  const handleOverlayKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 backdrop-blur-[2px]"
      onClick={onClose}
      onKeyDown={handleOverlayKeyDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        aria-busy={isUpdating}
        className="ui-sheet-surface w-full max-w-lg bottom-sheet rounded-t-[2rem]"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-center pb-1 pt-3">
          <div className="ui-drag-handle" />
        </div>

        <p id={descriptionId} className="sr-only">
          {buddy.screenname} profile. {getPresenceLabel(buddy.presenceState)}. {buddy.presenceDetail}
        </p>

        <div className="ui-sheet-header">
          <h2 id={titleId} className="ui-sheet-title text-[length:var(--ui-text-lg)]">
            Buddy Profile
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={`Close ${buddy.screenname} profile`}
            className="ui-focus-ring ui-sheet-close h-11 w-11 text-[length:var(--ui-text-sm)] font-semibold"
          >
            <AppIcon kind="close" className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 pb-2">
          <div className="ui-panel-card rounded-[1.6rem] px-4 py-4">
            <div className="flex items-center gap-3">
              <ProfileAvatar
                screenname={buddy.screenname}
                buddyIconPath={buddy.buddyIconPath}
                presenceState={buddy.presenceState}
                size="lg"
                showStatusDot
              />
              <div className="min-w-0 flex-1">
                <p className="ui-screenname truncate text-[length:var(--ui-text-xl)] font-semibold text-slate-800">
                  {buddy.screenname}
                </p>
                <p className="text-[length:var(--ui-text-sm)] font-semibold text-[var(--rose)]">
                  {getPresenceLabel(buddy.presenceState)}
                </p>
                <p className="mt-1 text-[length:var(--ui-text-sm)] text-slate-500">{buddy.presenceDetail}</p>
              </div>
            </div>

            {buddy.statusLine ? (
              <div className="ui-panel-muted mt-4 rounded-2xl px-3 py-2">
                <p className="text-[length:var(--ui-text-2xs)] font-semibold uppercase tracking-widest text-slate-400">
                  Status Line
                </p>
                <p className="mt-1 text-[length:var(--ui-text-md)] text-slate-700">{buddy.statusLine}</p>
              </div>
            ) : null}

            {buddy.awayMessage ? (
              <div className="ui-away-card mt-3">
                <p data-away-label="true" className="text-[length:var(--ui-text-2xs)] font-semibold uppercase tracking-widest">
                  Away Message
                </p>
                <p data-away-text="true" className="mt-1 text-[length:var(--ui-text-md)] italic">{buddy.awayMessage}</p>
              </div>
            ) : null}

            <div className="ui-panel-muted mt-3 rounded-2xl px-3 py-2">
              <p className="text-[length:var(--ui-text-2xs)] font-semibold uppercase tracking-widest text-slate-400">
                Bio
              </p>
              <p className="mt-1 text-[length:var(--ui-text-md)] text-slate-700">
                {buddy.bio?.trim() || 'No profile bio yet.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={onStartChat}
              disabled={isBlocked}
              aria-label={`Start an instant message with ${buddy.screenname}`}
              className="ui-focus-ring ui-button-primary rounded-2xl px-4 py-2.5 text-[length:var(--ui-text-md)] disabled:opacity-60"
            >
              {isBlocked ? 'Blocked' : 'Send IM'}
            </button>
            {showAddAction ? (
              <button
                type="button"
                onClick={onAddBuddy}
                disabled={isUpdating}
                aria-label={`Add ${buddy.screenname} as a buddy`}
                className="ui-focus-ring ui-button-secondary rounded-2xl px-4 py-2.5 text-[length:var(--ui-text-md)] disabled:opacity-60"
              >
                {isUpdating ? 'Adding…' : 'Add Buddy'}
              </button>
            ) : null}
            {showRemoveAction ? (
              <button
                type="button"
                onClick={() => setShowRemoveConfirm(true)}
                disabled={isUpdating}
                aria-label={`Remove ${buddy.screenname} from your H.I.M. contacts`}
                className="ui-focus-ring ui-button-danger rounded-2xl px-4 py-2.5 text-[length:var(--ui-text-md)] disabled:opacity-60"
              >
                {isUpdating ? 'Removing…' : 'Remove Buddy'}
              </button>
            ) : null}
            {showRemoveConfirm ? (
              <div
                className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
                onClick={() => setShowRemoveConfirm(false)}
              >
                <div
                  className="ui-sheet-surface mx-4 w-full max-w-sm rounded-[1.6rem] p-5 shadow-xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-[length:var(--ui-text-lg)] font-semibold text-slate-800">
                    Remove {buddy.screenname}?
                  </p>
                  <p className="mt-1.5 text-[length:var(--ui-text-sm)] text-slate-500">
                    Remove {buddy.screenname} from your H.I.M. contacts?
                  </p>
                  <div className="mt-5 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRemoveConfirm(false)}
                      className="ui-focus-ring ui-button-secondary rounded-2xl px-4 py-2.5 text-[length:var(--ui-text-md)]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowRemoveConfirm(false);
                        onRemoveBuddy?.();
                      }}
                      className="ui-focus-ring ui-button-danger rounded-2xl px-4 py-2.5 text-[length:var(--ui-text-md)]"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {hasSafetyActions ? (
            <div className="ui-panel-card rounded-[1.4rem] px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-900 dark:text-slate-300">
                  <AppIcon kind="shield" className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[length:var(--ui-text-sm)] font-semibold text-slate-800">Safety</p>
                  <p className="mt-0.5 text-[length:var(--ui-text-xs)] text-slate-500">
                    Block unwanted contact or send a report if something feels off.
                  </p>
                </div>
              </div>

              {isBlocked ? (
                <div className="ui-note-warning mt-3">
                  <p className="text-[length:var(--ui-text-xs)] font-semibold text-amber-800">
                    {buddy.screenname} is blocked on this account.
                  </p>
                  <p className="mt-0.5 text-[length:var(--ui-text-2xs)] text-amber-700">
                    They can&apos;t send new messages or buddy requests until you unblock them.
                  </p>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap justify-end gap-2">
                {isBlocked ? (
                  <button
                    type="button"
                    onClick={onUnblockBuddy}
                    disabled={isBlocking}
                    className="ui-focus-ring ui-button-secondary rounded-2xl px-4 py-2.5 text-[length:var(--ui-text-md)] disabled:opacity-60"
                  >
                    {isBlocking ? 'Unblocking…' : 'Unblock'}
                  </button>
                ) : onBlockBuddy ? (
                  <button
                    type="button"
                    onClick={onBlockBuddy}
                    disabled={isBlocking}
                    className="ui-focus-ring ui-button-danger rounded-2xl px-4 py-2.5 text-[length:var(--ui-text-md)] disabled:opacity-60"
                  >
                    {isBlocking ? 'Blocking…' : 'Block'}
                  </button>
                ) : null}
                {onSubmitReport ? (
                  <button
                    type="button"
                    onClick={() => setShowReportForm((previous) => !previous)}
                    className="ui-focus-ring ui-button-secondary rounded-2xl px-4 py-2.5 text-[length:var(--ui-text-md)]"
                  >
                    {showReportForm ? 'Cancel report' : 'Report'}
                  </button>
                ) : null}
              </div>

              {showReportForm ? (
                <div className="mt-3 space-y-3 rounded-[1.2rem] border border-slate-200/80 bg-white/80 px-3 py-3 dark:border-slate-800 dark:bg-slate-950/50">
                  <div>
                    <label className="mb-1 block text-[length:var(--ui-text-2xs)] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Category
                    </label>
                    <select
                      value={reportCategory}
                      onChange={(event) => setReportCategory(event.target.value as AbuseReportCategory)}
                      className="ui-focus-ring w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[length:var(--ui-text-sm)] text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    >
                      {ABUSE_REPORT_CATEGORY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[length:var(--ui-text-2xs)] text-slate-400">
                      {ABUSE_REPORT_CATEGORY_OPTIONS.find((option) => option.value === reportCategory)?.helper}
                    </p>
                  </div>
                  <div>
                    <label className="mb-1 block text-[length:var(--ui-text-2xs)] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Notes
                    </label>
                    <textarea
                      value={reportDetails}
                      onChange={(event) => setReportDetails(event.target.value)}
                      rows={3}
                      maxLength={1200}
                      placeholder="Add details to help with review."
                      className="ui-focus-ring w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[length:var(--ui-text-sm)] text-slate-700 placeholder-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        void Promise.resolve(
                          onSubmitReport?.({
                            category: reportCategory,
                            details: reportDetails.trim(),
                          }),
                        )
                          .then(() => {
                            setShowReportForm(false);
                            setReportDetails('');
                            setReportCategory('harassment');
                          })
                          .catch(() => undefined);
                      }}
                      disabled={isReporting}
                      className="ui-focus-ring ui-button-primary rounded-2xl px-4 py-2.5 text-[length:var(--ui-text-md)] disabled:opacity-60"
                    >
                      {isReporting ? 'Sending…' : 'Send report'}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {feedbackMessage ? (
            <p className="ui-note-info text-[length:var(--ui-text-sm)] font-semibold">
              {feedbackMessage}
            </p>
          ) : null}
          {errorMessage ? (
            <p role="alert" className="ui-note-error text-[length:var(--ui-text-sm)] font-semibold">
              {errorMessage}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
