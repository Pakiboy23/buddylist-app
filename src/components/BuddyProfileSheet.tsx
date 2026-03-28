'use client';

import { KeyboardEvent, useEffect, useId, useRef } from 'react';
import AppIcon from '@/components/AppIcon';
import ProfileAvatar from '@/components/ProfileAvatar';
import { getPresenceLabel, type ResolvedPresenceState } from '@/lib/presence';

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
  onClose: () => void;
  onStartChat: () => void;
  onAddBuddy?: () => void;
  onRemoveBuddy?: () => void;
}

export default function BuddyProfileSheet({
  buddy,
  isOpen,
  isUpdating = false,
  errorMessage = null,
  onClose,
  onStartChat,
  onAddBuddy,
  onRemoveBuddy,
}: BuddyProfileSheetProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

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
        className="w-full max-w-lg bottom-sheet rounded-t-[2rem] border border-white/60 bg-white/92 shadow-[var(--shadow-elevated)] backdrop-blur-2xl"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-slate-300" />
        </div>

        <p id={descriptionId} className="sr-only">
          {buddy.screenname} profile. {getPresenceLabel(buddy.presenceState)}. {buddy.presenceDetail}
        </p>

        <div className="flex items-center justify-between px-5 pb-3 pt-1">
          <h2 id={titleId} className="text-[length:var(--ui-text-lg)] font-semibold text-slate-800">
            Buddy Profile
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={`Close ${buddy.screenname} profile`}
            className="ui-focus-ring flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-[length:var(--ui-text-sm)] font-semibold text-slate-500 hover:bg-slate-200"
          >
            <AppIcon kind="close" className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 pb-2">
          <div className="rounded-[1.6rem] border border-white/65 bg-white/78 px-4 py-4 shadow-sm">
            <div className="flex items-center gap-3">
              <ProfileAvatar
                screenname={buddy.screenname}
                buddyIconPath={buddy.buddyIconPath}
                presenceState={buddy.presenceState}
                size="lg"
                showStatusDot
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[length:var(--ui-text-xl)] font-semibold text-slate-800">
                  {buddy.screenname}
                </p>
                <p className="text-[length:var(--ui-text-sm)] font-semibold text-blue-600">
                  {getPresenceLabel(buddy.presenceState)}
                </p>
                <p className="mt-1 text-[length:var(--ui-text-sm)] text-slate-500">{buddy.presenceDetail}</p>
              </div>
            </div>

            {buddy.statusLine ? (
              <div className="mt-4 rounded-2xl border border-white/65 bg-white/85 px-3 py-2">
                <p className="text-[length:var(--ui-text-2xs)] font-semibold uppercase tracking-widest text-slate-400">
                  Status Line
                </p>
                <p className="mt-1 text-[length:var(--ui-text-md)] text-slate-700">{buddy.statusLine}</p>
              </div>
            ) : null}

            {buddy.awayMessage ? (
              <div className="mt-3 rounded-2xl border border-amber-200/70 bg-amber-50/85 px-3 py-2">
                <p className="text-[length:var(--ui-text-2xs)] font-semibold uppercase tracking-widest text-amber-500">
                  Away Message
                </p>
                <p className="mt-1 text-[length:var(--ui-text-md)] italic text-amber-800">{buddy.awayMessage}</p>
              </div>
            ) : null}

            <div className="mt-3 rounded-2xl border border-white/65 bg-white/85 px-3 py-2">
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
              aria-label={`Start an instant message with ${buddy.screenname}`}
              className="ui-focus-ring rounded-2xl border border-blue-500/50 bg-blue-500 px-4 py-2.5 text-[length:var(--ui-text-md)] font-semibold text-white shadow-[0_8px_20px_rgba(37,99,235,0.28)] transition hover:bg-blue-600 active:scale-[0.98]"
            >
              Send IM
            </button>
            {showAddAction ? (
              <button
                type="button"
                onClick={onAddBuddy}
                disabled={isUpdating}
                aria-label={`Add ${buddy.screenname} as a buddy`}
                className="ui-focus-ring rounded-2xl border border-white/65 bg-white px-4 py-2.5 text-[length:var(--ui-text-md)] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-60"
              >
                {isUpdating ? 'Adding…' : 'Add Buddy'}
              </button>
            ) : null}
            {showRemoveAction ? (
              <button
                type="button"
                onClick={onRemoveBuddy}
                disabled={isUpdating}
                aria-label={`Remove ${buddy.screenname} from your buddy list`}
                className="ui-focus-ring rounded-2xl border border-red-200/80 bg-white px-4 py-2.5 text-[length:var(--ui-text-md)] font-semibold text-red-500 shadow-sm transition hover:bg-red-50 active:scale-[0.98] disabled:opacity-60"
              >
                {isUpdating ? 'Removing…' : 'Remove Buddy'}
              </button>
            ) : null}
          </div>

          {errorMessage ? (
            <p
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[length:var(--ui-text-sm)] font-semibold text-red-700"
            >
              {errorMessage}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
