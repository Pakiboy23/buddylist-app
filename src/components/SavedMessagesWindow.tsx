'use client';

import { FormEvent, useMemo, useState } from 'react';
import AppIcon from '@/components/AppIcon';
import RetroWindow from '@/components/RetroWindow';
import { useKeyboardViewport } from '@/hooks/useKeyboardViewport';
import type { SavedMessageRow } from '@/lib/privateChat';
import { htmlToPlainText } from '@/lib/richText';

interface SavedMessagesWindowProps {
  entries: SavedMessageRow[];
  draft: string;
  errorMessage?: string | null;
  isSaving?: boolean;
  deletingEntryId?: string | null;
  onDraftChange: (value: string) => void;
  onSave: () => Promise<void> | void;
  onDeleteEntry: (entryId: string) => Promise<void> | void;
  onClose: () => void;
}

export default function SavedMessagesWindow({
  entries,
  draft,
  errorMessage = null,
  isSaving = false,
  deletingEntryId = null,
  onDraftChange,
  onSave,
  onDeleteEntry,
  onClose,
}: SavedMessagesWindowProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isKeyboardOpen, viewportHeight } = useKeyboardViewport();
  const visibleEntries = useMemo(
    () =>
      [...entries].sort((left, right) => {
        const leftMs = Date.parse(left.created_at);
        const rightMs = Date.parse(right.created_at);
        return rightMs - leftMs;
      }),
    [entries],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.trim() || isSaving || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await Promise.resolve(onSave());
    } finally {
      setIsSubmitting(false);
    }
  };
  const savedWindowShellStyle = isKeyboardOpen && viewportHeight ? { height: `${viewportHeight}px` } : undefined;
  const composerInset = isKeyboardOpen ? '0.75rem' : 'calc(env(safe-area-inset-bottom) + 0.75rem)';

  return (
    <div className="fixed inset-0 z-40 chat-slide-in" role="dialog" aria-modal="true" aria-label="Saved messages">
      <RetroWindow
        title="Saved Messages"
        variant="xp_shell"
        xpTitleText="Saved Messages"
        xpSubtitleText="Notes, forwards, and keepsakes"
        headerActions={(
          <button
            type="button"
            onClick={onClose}
            className="ui-focus-ring ui-window-header-button px-2.5 text-[11px] font-semibold"
            aria-label="Close saved messages"
            title="Close saved messages"
          >
            Done
          </button>
        )}
        onXpClose={onClose}
        style={savedWindowShellStyle}
      >
        <div className="ui-window-panel flex h-full min-h-0 flex-col rounded-[1.4rem] text-[length:var(--ui-text-md)]">
          <div className="ui-chat-log mx-3 mt-3 min-h-0 flex-1 overflow-y-auto rounded-2xl px-3 py-3">
            {visibleEntries.length === 0 ? (
              <div className="ui-empty-state h-full px-6 ui-fade-in">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--bg4)]">
                  <AppIcon kind="mail" className="h-7 w-7 text-blue-400" />
                </div>
                <div className="text-center">
                  <p className="text-[length:var(--ui-text-md)] font-semibold text-slate-500">Nothing saved yet</p>
                  <p className="mt-0.5 text-[length:var(--ui-text-xs)] text-slate-400">
                    Save standout messages here or write notes to yourself.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {visibleEntries.map((entry) => {
                  const timestamp = new Date(entry.created_at).toLocaleString();
                  const plainText = htmlToPlainText(entry.content).trim() || entry.content.trim();
                  return (
                    <div key={entry.id} className="ui-panel-card rounded-2xl px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            {entry.source_screenname ? `Saved from ${entry.source_screenname}` : 'Personal note'}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-[13px] text-slate-700 dark:text-slate-200">
                            {plainText}
                          </p>
                          <p className="mt-2 text-[11px] text-slate-400">{timestamp}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void onDeleteEntry(entry.id)}
                          disabled={deletingEntryId === entry.id}
                          className="ui-focus-ring ui-button-danger ui-button-compact shrink-0"
                        >
                          {deletingEntryId === entry.id ? '…' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {errorMessage ? (
            <p role="alert" className="mx-3 mt-1 text-[length:var(--ui-text-2xs)] text-red-600">
              {errorMessage}
            </p>
          ) : null}

          <div className="mx-3 mt-2" style={{ paddingBottom: composerInset }}>
            <form onSubmit={handleSubmit} className="ui-compose-surface flex items-end gap-2 rounded-2xl px-3.5 py-2.5">
              <label htmlFor="saved-message-input" className="sr-only">
                New saved note
              </label>
              <textarea
                id="saved-message-input"
                value={draft}
                onChange={(event) => onDraftChange(event.target.value)}
                placeholder="Write a note to yourself…"
                rows={1}
                maxLength={4000}
                className="min-h-[24px] flex-1 resize-none rounded-xl bg-transparent text-[length:var(--ui-text-md)] text-white placeholder-[#6B5B4E] focus:outline-none focus:border-[#E8608A]"
              />
              {draft.trim() ? (
                <button
                  type="submit"
                  disabled={isSaving || isSubmitting}
                  className="ui-focus-ring ui-button-primary mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-0 text-[length:var(--ui-text-md)] font-bold disabled:opacity-60"
                  aria-label="Save note"
                >
                  {isSaving || isSubmitting ? '…' : '↑'}
                </button>
              ) : null}
            </form>
          </div>
        </div>
      </RetroWindow>
    </div>
  );
}
