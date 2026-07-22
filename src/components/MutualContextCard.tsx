import type { MutualContext } from '@/lib/mutualContext';

interface MutualContextCardProps {
  context: MutualContext;
  isLoading?: boolean;
  errorMessage?: string | null;
  compact?: boolean;
}

export default function MutualContextCard({
  context,
  isLoading = false,
  errorMessage = null,
  compact = false,
}: MutualContextCardProps) {
  const undisplayedBuddyCount = Math.max(0, context.mutualBuddyCount - context.mutualBuddies.length);
  const hasContext = context.sharedRooms.length > 0 || context.mutualBuddyCount > 0;

  return (
    <div className={`ui-panel-muted rounded-2xl ${compact ? 'px-3 py-3' : 'px-4 py-3'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[length:var(--ui-text-2xs)] font-semibold uppercase tracking-widest text-[var(--gold)]">
            You both know
          </p>
          <p className="mt-1 text-[length:var(--ui-text-xs)] text-slate-500 dark:text-slate-400">
            Shared rooms and mutual buddies—not a compatibility score.
          </p>
        </div>
        <span className="text-lg" aria-hidden="true">🤝</span>
      </div>

      {isLoading ? (
        <div className="mt-3 space-y-2" aria-label="Loading shared context">
          <div className="ui-skeleton h-6 w-3/4 rounded-full" />
          <div className="ui-skeleton h-6 w-1/2 rounded-full" />
        </div>
      ) : errorMessage ? (
        <p className="mt-3 text-[length:var(--ui-text-xs)] text-slate-400">
          Shared context is unavailable right now.
        </p>
      ) : hasContext ? (
        <div className="mt-3 space-y-3">
          {context.sharedRooms.length > 0 ? (
            <div>
              <p className="text-[length:var(--ui-text-2xs)] font-semibold uppercase tracking-[0.12em] text-slate-400">
                Shared rooms
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {context.sharedRooms.map((room) => (
                  <span
                    key={room.id}
                    className="rounded-full border border-[rgba(232,162,58,0.2)] bg-[rgba(232,162,58,0.1)] px-2.5 py-1 text-[length:var(--ui-text-xs)] font-semibold text-[var(--gold)]"
                  >
                    # {room.name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {context.mutualBuddyCount > 0 ? (
            <div>
              <p className="text-[length:var(--ui-text-2xs)] font-semibold uppercase tracking-[0.12em] text-slate-400">
                {context.mutualBuddyCount} mutual {context.mutualBuddyCount === 1 ? 'buddy' : 'buddies'}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {context.mutualBuddies.map((buddy) => (
                  <span
                    key={buddy.id}
                    className="rounded-full bg-slate-200/70 px-2.5 py-1 text-[length:var(--ui-text-xs)] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {buddy.screenname}
                  </span>
                ))}
                {undisplayedBuddyCount > 0 ? (
                  <span className="px-1 py-1 text-[length:var(--ui-text-xs)] font-semibold text-slate-400">
                    +{undisplayedBuddyCount} more
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-[length:var(--ui-text-xs)] text-slate-400">
          No shared rooms or mutual buddies yet.
        </p>
      )}
    </div>
  );
}
