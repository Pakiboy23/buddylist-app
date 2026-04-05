'use client';

import { REACTION_PICKER_EMOJIS, type ReactionSummaryEntry } from '@/lib/messageReactions';

interface MessageReactionPickerProps {
  activeEmojis?: Iterable<string>;
  disabledEmojis?: Iterable<string>;
  onPick: (emoji: string) => void;
}

interface MessageReactionStripProps {
  align: 'start' | 'end';
  animatedReactionKeys?: Iterable<string>;
  disabledReactionKeys?: Iterable<string>;
  entries: ReactionSummaryEntry[];
  messageId: string | number;
  onToggle: (emoji: string) => void;
}

export function MessageReactionPicker({
  activeEmojis,
  disabledEmojis,
  onPick,
}: MessageReactionPickerProps) {
  const activeEmojiSet = new Set(activeEmojis ?? []);
  const disabledEmojiSet = new Set(disabledEmojis ?? []);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {REACTION_PICKER_EMOJIS.map((emoji) => {
        const isActive = activeEmojiSet.has(emoji);
        const isDisabled = disabledEmojiSet.has(emoji);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onPick(emoji)}
            disabled={isDisabled}
            className={`ui-focus-ring inline-flex h-8 min-w-8 items-center justify-center rounded-full border px-2 text-base transition disabled:cursor-not-allowed disabled:opacity-50 ${
              isActive
                ? 'border-blue-400/80 bg-blue-50 text-blue-700 shadow-[0_6px_18px_rgba(37,99,235,0.16)] dark:border-blue-400/60 dark:bg-blue-500/15 dark:text-blue-200'
                : 'border-white/70 bg-white/90 text-slate-700 shadow-sm backdrop-blur-md hover:bg-white dark:border-slate-700/70 dark:bg-slate-950/88 dark:text-slate-200 dark:hover:bg-slate-900'
            }`}
            aria-label={`${isActive ? 'Remove' : 'Add'} reaction ${emoji}`}
          >
            {emoji}
          </button>
        );
      })}
    </div>
  );
}

export function MessageReactionStrip({
  align,
  animatedReactionKeys,
  disabledReactionKeys,
  entries,
  messageId,
  onToggle,
}: MessageReactionStripProps) {
  const animatedKeySet = new Set(animatedReactionKeys ?? []);
  const disabledKeySet = new Set(disabledReactionKeys ?? []);

  return (
    <div className={`-mt-1 mb-1 flex flex-wrap gap-0.5 ${align === 'end' ? 'justify-end' : 'justify-start'}`}>
      {entries.map((entry) => {
        const reactionKey = `${messageId}-${entry.emoji}`;
        const mutationKey = `${messageId}:${entry.emoji}`;
        const isAnimated = animatedKeySet.has(reactionKey);
        const isDisabled = disabledKeySet.has(mutationKey);

        return (
          <button
            key={reactionKey}
            type="button"
            onClick={() => onToggle(entry.emoji)}
            disabled={isDisabled}
            className={`ui-focus-ring inline-flex items-center gap-1 rounded-full border px-1.5 py-[2px] text-[length:var(--ui-text-2xs)] shadow-sm backdrop-blur-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${
              entry.reactedByMe
                ? 'border-blue-300/80 bg-blue-50/95 text-blue-700 shadow-[0_6px_16px_rgba(37,99,235,0.14)] dark:border-blue-400/40 dark:bg-blue-500/18 dark:text-blue-100'
                : 'border-white/70 bg-white/85 text-slate-600 dark:border-slate-700/70 dark:bg-slate-950/85 dark:text-slate-200'
            } ${isAnimated ? 'reaction-pop' : ''}`}
            aria-label={`${entry.reactedByMe ? 'Remove' : 'Add'} reaction ${entry.emoji}. ${entry.count} ${
              entry.count === 1 ? 'reaction' : 'reactions'
            }.`}
          >
            <span>{entry.emoji}</span>
            <span>{entry.count}</span>
          </button>
        );
      })}
    </div>
  );
}
