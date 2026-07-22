'use client';

import { useState, type ReactNode } from 'react';
import { MAX_CIRCLE_NAME_LENGTH, type BuddyCircle } from '@/lib/buddyCircles';

// ── Create control ───────────────────────────────────────────────────────────

interface NewCircleControlProps {
  onCreate: (name: string) => void | Promise<void>;
  disabled?: boolean;
}

export function NewCircleControl({ onCreate, disabled = false }: NewCircleControlProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [isBusy, setIsBusy] = useState(false);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed || isBusy) {
      return;
    }
    setIsBusy(true);
    try {
      await onCreate(trimmed);
      setName('');
      setIsOpen(false);
    } finally {
      setIsBusy(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        disabled={disabled}
        className="ui-focus-ring ui-button-secondary ui-button-compact shrink-0"
        title="Create a private circle to organize your buddies"
      >
        ＋ Circle
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            void submit();
          } else if (event.key === 'Escape') {
            setIsOpen(false);
            setName('');
          }
        }}
        maxLength={MAX_CIRCLE_NAME_LENGTH}
        placeholder="Circle name"
        aria-label="New circle name"
        className="ui-focus-ring ui-modal-input h-8 w-32 text-[12px]"
      />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={isBusy || !name.trim()}
        className="ui-focus-ring ui-button-primary ui-button-compact shrink-0"
      >
        {isBusy ? '…' : 'Add'}
      </button>
      <button
        type="button"
        onClick={() => {
          setIsOpen(false);
          setName('');
        }}
        className="ui-focus-ring ui-button-secondary ui-button-compact shrink-0"
        aria-label="Cancel"
      >
        ✕
      </button>
    </div>
  );
}

// ── Circle section (header + collapsible body) ───────────────────────────────

interface BuddyCircleGroupProps {
  name: string;
  total: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  // Present only for real circles (omitted for the "Ungrouped" pseudo-section).
  circle?: BuddyCircle;
  onRename?: (name: string) => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  onSetShowPresence?: (showPresence: boolean) => void | Promise<void>;
  onSetMuted?: (muted: boolean) => void | Promise<void>;
  children: ReactNode;
}

export function BuddyCircleGroup({
  name,
  total,
  collapsed,
  onToggleCollapsed,
  circle,
  onRename,
  onDelete,
  onSetShowPresence,
  onSetMuted,
  children,
}: BuddyCircleGroupProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState(name);
  const isManageable = Boolean(circle);
  const presenceHidden = circle ? !circle.showPresence : false;
  const muted = circle ? circle.notifyMode === 'muted' : false;

  return (
    <section className="space-y-2">
      <div className="ui-section-header" data-tone="circle">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="ui-focus-ring flex min-w-0 flex-1 items-center gap-1.5 text-left"
          aria-expanded={!collapsed}
        >
          <span aria-hidden="true" className={`text-[10px] transition-transform ${collapsed ? '' : 'rotate-90'}`}>
            ▶
          </span>
          <span className="truncate">{name}</span>
          {presenceHidden ? (
            <span title="Presence hidden for this circle" aria-label="Presence hidden">
              🙈
            </span>
          ) : null}
          {muted ? (
            <span title="In-app alerts muted for this circle" aria-label="Muted">
              🔕
            </span>
          ) : null}
        </button>
        <span className="ui-section-count">{total}</span>
        {isManageable ? (
          <button
            type="button"
            onClick={() => {
              setRenameDraft(name);
              setSettingsOpen((open) => !open);
            }}
            className="ui-focus-ring ml-1 rounded-full px-1.5 text-[13px] text-slate-400 hover:text-slate-200"
            aria-label={`Manage ${name} circle`}
            aria-expanded={settingsOpen}
            title="Manage circle"
          >
            ⚙
          </button>
        ) : null}
      </div>

      {isManageable && settingsOpen ? (
        <div className="ui-panel-muted mx-1 space-y-2.5 rounded-2xl px-3 py-3">
          <div className="flex items-center gap-1.5">
            <input
              value={renameDraft}
              onChange={(event) => setRenameDraft(event.target.value)}
              maxLength={MAX_CIRCLE_NAME_LENGTH}
              aria-label="Rename circle"
              className="ui-focus-ring ui-modal-input h-8 flex-1 text-[12px]"
            />
            <button
              type="button"
              onClick={() => {
                const trimmed = renameDraft.trim();
                if (trimmed && trimmed !== name) {
                  void onRename?.(trimmed);
                }
                setSettingsOpen(false);
              }}
              disabled={!renameDraft.trim() || renameDraft.trim() === name}
              className="ui-focus-ring ui-button-secondary ui-button-compact shrink-0"
            >
              Rename
            </button>
          </div>

          <label className="flex items-center justify-between gap-3 text-[12px] text-slate-500 dark:text-slate-300">
            <span>Show this circle&apos;s presence</span>
            <input
              type="checkbox"
              checked={!presenceHidden}
              onChange={(event) => void onSetShowPresence?.(event.target.checked)}
              className="ui-focus-ring h-4 w-4"
            />
          </label>

          <label className="flex items-center justify-between gap-3 text-[12px] text-slate-500 dark:text-slate-300">
            <span>Mute in-app alerts</span>
            <input
              type="checkbox"
              checked={muted}
              onChange={(event) => void onSetMuted?.(event.target.checked)}
              className="ui-focus-ring h-4 w-4"
            />
          </label>

          <button
            type="button"
            onClick={() => {
              void onDelete?.();
              setSettingsOpen(false);
            }}
            className="ui-focus-ring text-[11px] font-semibold uppercase tracking-[0.12em] text-red-500 hover:text-red-400"
          >
            Delete circle
          </button>
        </div>
      ) : null}

      {collapsed ? null : children}
    </section>
  );
}

// ── Profile-sheet circle picker ──────────────────────────────────────────────

interface CirclePickerProps {
  circles: BuddyCircle[];
  currentCircleId: string | null;
  onSetCircle: (circleId: string | null) => void | Promise<void>;
  disabled?: boolean;
}

export function CirclePicker({ circles, currentCircleId, onSetCircle, disabled = false }: CirclePickerProps) {
  if (circles.length === 0) {
    return null;
  }
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl bg-slate-100/70 px-3 py-2.5 text-[13px] font-semibold text-slate-600 dark:bg-slate-800/60 dark:text-slate-200">
      <span>Circle</span>
      <select
        value={currentCircleId ?? ''}
        disabled={disabled}
        onChange={(event) => void onSetCircle(event.target.value || null)}
        className="ui-focus-ring ui-modal-select h-8 max-w-[55%] text-[13px]"
      >
        <option value="">Ungrouped</option>
        {circles.map((circle) => (
          <option key={circle.id} value={circle.id}>
            {circle.name}
          </option>
        ))}
      </select>
    </label>
  );
}
