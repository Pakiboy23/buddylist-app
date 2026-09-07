import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AppIcon from '@/components/AppIcon';
import DiscoveryProfileSheet from '@/components/DiscoveryProfileSheet';
import {
  BROWSE_ACTIVITY_PRESETS,
  BROWSE_MOOD_FILTERS,
  describeBrowseCard,
  getBrowseMoodChip,
  getBrowsePresenceChip,
  matchesBrowseFilters,
  shouldFillBrowseFilterPages,
  type BrowsePresenceFilter,
} from '@/lib/browsePresence';
import {
  markFirstSessionAwayNudgeShown,
  wasFirstSessionAwayNudgeShown,
} from '@/lib/firstSessionAway';
import { PRODUCT_EVENTS, trackProductEvent } from '@/lib/productEvents';
import { applyBrowseAwayMessageRequired, applyDiscoverablePeopleGate } from '@/lib/discoverableSearch';
import { supabase } from '@/lib/supabase';
import type { AwayMoodId } from '@/lib/himArtDirection';

interface BrowseUser {
  id: string;
  screenname: string;
  away_message: string | null;
  last_active_at: string | null;
  idle_since: string | null;
  status: string | null;
  show_online_status?: boolean | null;
}

const PAGE_SIZE = 50;
const BROWSE_SELECT_WITH_PRIVACY = 'id,screenname,away_message,last_active_at,idle_since,status,show_online_status';
const BROWSE_SELECT_LEGACY = 'id,screenname,away_message,last_active_at,idle_since,status';

function isShowOnlineStatusColumnMissing(error: { message?: string | null; code?: string | null } | null) {
  const combined = `${error?.code ?? ''} ${error?.message ?? ''}`.toLowerCase();
  return combined.includes('show_online_status');
}

interface BrowsePanelProps {
  currentUserId: string;
  hasAwayMessage: boolean;
  isFirstSession?: boolean;
  onSetAwayMessage: () => void;
}

function toggleId<T extends string>(current: T[], id: T): T[] {
  return current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
}

export default function BrowsePanel({
  currentUserId,
  hasAwayMessage,
  isFirstSession = false,
  onSetAwayMessage,
}: BrowsePanelProps) {
  const [users, setUsers] = useState<BrowseUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [presenceFilter, setPresenceFilter] = useState<BrowsePresenceFilter>('all');
  const [moodIds, setMoodIds] = useState<AwayMoodId[]>([]);
  const [activityIds, setActivityIds] = useState<string[]>([]);
  const loadMoreInFlightRef = useRef(false);

  const fetchPage = useCallback(async (pageOffset: number, replace: boolean) => {
    try {
      const { data: blockedRows } = await supabase
        .from('blocked_users')
        .select('blocked_id')
        .eq('blocker_id', currentUserId);
      const blockedIds = (blockedRows ?? []).map((row) => (row as { blocked_id: string }).blocked_id);

      const runBrowseQuery = (fields: string) => {
        let query = applyBrowseAwayMessageRequired(
          applyDiscoverablePeopleGate(
            supabase
              .from('users')
              .select(fields),
          ),
        )
          .neq('id', currentUserId)
          .order('last_active_at', { ascending: false, nullsFirst: false })
          .range(pageOffset, pageOffset + PAGE_SIZE - 1);

        if (blockedIds.length > 0) {
          query = query.not('id', 'in', `(${blockedIds.join(',')})`);
        }

        return query;
      };

      let { data, error } = await runBrowseQuery(BROWSE_SELECT_WITH_PRIVACY);
      if (error && isShowOnlineStatusColumnMissing(error)) {
        ({ data, error } = await runBrowseQuery(BROWSE_SELECT_LEGACY));
      }
      if (error) {
        setHasMore(false);
        if (replace) {
          setUsers([]);
          setOffset(0);
        }
        return;
      }

      const rows = (data ?? []) as unknown as BrowseUser[];

      if (replace) {
        setUsers(rows);
        setOffset(0);
      } else {
        setUsers((prev) => [...prev, ...rows]);
      }

      setHasMore(rows.length === PAGE_SIZE);
    } catch {
      setHasMore(false);
      if (replace) {
        setUsers([]);
        setOffset(0);
      }
    } finally {
      if (replace) {
        setIsLoading(false);
      } else {
        setIsLoadingMore(false);
        loadMoreInFlightRef.current = false;
      }
    }
  }, [currentUserId]);

  useEffect(() => {
    setIsLoading(true);
    setUsers([]);
    setOffset(0);
    setHasMore(false);
    const timeoutId = window.setTimeout(() => {
      void fetchPage(0, true);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [fetchPage]);

  useEffect(() => {
    if (!isFirstSession || hasAwayMessage || wasFirstSessionAwayNudgeShown(currentUserId)) {
      return;
    }
    if (markFirstSessionAwayNudgeShown(currentUserId)) {
      trackProductEvent(PRODUCT_EVENTS.firstSessionAwayNudgeShown);
    }
  }, [currentUserId, hasAwayMessage, isFirstSession]);

  const cards = useMemo(
    () =>
      users.map((user) => ({
        user,
        card: describeBrowseCard({
          status: user.status,
          awayMessage: user.away_message,
          lastActiveAt: user.last_active_at,
          idleSince: user.idle_since,
          showOnlineStatus: user.show_online_status,
        }),
      })),
    [users],
  );

  const visibleCards = useMemo(
    () =>
      cards.filter(({ card }) =>
        matchesBrowseFilters(card, {
          presence: presenceFilter,
          moodIds,
          activityIds,
        }),
      ),
    [activityIds, cards, moodIds, presenceFilter],
  );

  const handleLoadMore = useCallback(() => {
    if (loadMoreInFlightRef.current || !hasMore || isLoading || isLoadingMore) {
      return;
    }
    loadMoreInFlightRef.current = true;
    const nextOffset = offset + PAGE_SIZE;
    setOffset(nextOffset);
    setIsLoadingMore(true);
    void fetchPage(nextOffset, false);
  }, [fetchPage, hasMore, isLoading, isLoadingMore, offset]);

  const showAwayNudge = !hasAwayMessage;
  const filtersActive = presenceFilter !== 'all' || moodIds.length > 0 || activityIds.length > 0;
  const busy = isLoading || isLoadingMore;

  useEffect(() => {
    if (!shouldFillBrowseFilterPages({
      filtersActive,
      visibleCount: visibleCards.length,
      hasMore,
      busy,
    })) {
      return;
    }
    handleLoadMore();
  }, [busy, filtersActive, handleLoadMore, hasMore, visibleCards.length]);

  return (
    <div className="flex flex-col gap-3">
      {showAwayNudge ? (
        <div className="ui-note-info mx-1">
          <div className="flex items-start gap-2">
            <AppIcon kind="smile" className="mt-0.5 h-4 w-4 shrink-0 text-[var(--rose)]" />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-200">
                {isFirstSession ? 'Set an away message so people can find you' : 'Your away message is how people find you'}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                Browse is presence — a line you wrote, not a grid of faces.
              </p>
            </div>
            <button
              type="button"
              onClick={onSetAwayMessage}
              className="ui-focus-ring ui-button-primary ui-button-compact shrink-0"
            >
              Set yours
            </button>
          </div>
        </div>
      ) : null}

      <div className="px-1">
        <div className="flex flex-wrap gap-1.5">
          {([
            { id: 'all', label: 'All' },
            { id: 'away', label: 'Away now' },
            { id: 'available', label: 'Available' },
          ] as const).map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setPresenceFilter(option.id)}
              className="ui-focus-ring ui-filter-chip"
              data-active={presenceFilter === option.id ? 'true' : 'false'}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {BROWSE_MOOD_FILTERS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setMoodIds((current) => toggleId(current, option.id))}
              className="ui-focus-ring ui-filter-chip capitalize"
              data-active={moodIds.includes(option.id) ? 'true' : 'false'}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {BROWSE_ACTIVITY_PRESETS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setActivityIds((current) => toggleId(current, option.id))}
              className="ui-focus-ring ui-filter-chip"
              data-active={activityIds.includes(option.id) ? 'true' : 'false'}
            >
              {option.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setActivityIds((current) => toggleId(current, 'custom'))}
            className="ui-focus-ring ui-filter-chip"
            data-active={activityIds.includes('custom') ? 'true' : 'false'}
          >
            Custom
          </button>
        </div>
      </div>

      {isLoading ? (
        <ul className="space-y-2 px-1">
          {[72, 55, 88, 64].map((w, i) => (
            <li key={i} className="ui-panel-card rounded-2xl px-4 py-3">
              <div className="ui-skeleton mb-2 h-3 rounded-full" style={{ width: `${w * 0.55}%` }} />
              <div className="ui-skeleton h-3 rounded-full" style={{ width: `${w}%` }} />
            </li>
          ))}
        </ul>
      ) : users.length === 0 ? (
        <div className="ui-empty-state py-12 ui-fade-in">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[rgba(232,162,58,0.12)]">
            <AppIcon kind="buddy" className="h-5 w-5 text-[var(--rose)]" />
          </div>
          <p className="text-[13px] font-semibold text-slate-500 dark:text-slate-300">
            Nobody has posted a status yet
          </p>
          <p className="max-w-[16rem] text-[12px] leading-relaxed text-slate-400">
            {hasAwayMessage
              ? 'Check back soon — Browse only shows people who wrote an away message.'
              : 'Set yours so others can find you.'}
          </p>
          {!hasAwayMessage ? (
            <button
              type="button"
              onClick={onSetAwayMessage}
              className="ui-focus-ring ui-button-primary ui-button-compact mt-1"
            >
              Set yours so others can find you
            </button>
          ) : null}
        </div>
      ) : visibleCards.length === 0 ? (
        <div className="ui-empty-state py-10 ui-fade-in">
          <p className="text-[13px] font-semibold text-slate-500">
            {isLoadingMore ? 'Looking further…' : 'No one matches these filters'}
          </p>
          <p className="text-[12px] text-slate-400">
            {isLoadingMore
              ? 'Filters apply to the whole board, not just this page.'
              : 'Presence only — no nearby, no age slider.'}
          </p>
          {hasMore ? (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="ui-focus-ring ui-button-secondary ui-button-compact mt-1 disabled:opacity-50"
            >
              {isLoadingMore ? 'Loading…' : 'Load more'}
            </button>
          ) : null}
          {filtersActive ? (
            <button
              type="button"
              onClick={() => {
                setPresenceFilter('all');
                setMoodIds([]);
                setActivityIds([]);
              }}
              className="ui-focus-ring ui-button-secondary ui-button-compact mt-1"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : (
        <>
          <ul className="space-y-1.5 px-1 ui-fade-in">
            {visibleCards.map(({ user, card }) => {
              const mood = getBrowseMoodChip(card.moodId);
              const awayLine = (user.away_message ?? '').trim();
              const presenceChip = getBrowsePresenceChip(card.presence);

              return (
                <li key={user.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedUserId(user.id)}
                    className="ui-focus-ring ui-list-row w-full text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <p className="ui-screenname truncate">{user.screenname}</p>
                        {card.relativeTime ? (
                          <span className="shrink-0 text-[10px] text-slate-400">{card.relativeTime}</span>
                        ) : null}
                      </div>
                      {awayLine ? (
                        <p className="mt-1 line-clamp-2 text-[12px] leading-snug text-slate-500 dark:text-slate-400">
                          &ldquo;{awayLine}&rdquo;
                        </p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {presenceChip ? (
                          <span className="ui-away-mood-pill" data-tone={presenceChip.tone}>
                            {presenceChip.label}
                          </span>
                        ) : null}
                        {mood ? (
                          <span className="ui-away-mood-pill capitalize" data-tone={mood.tone}>
                            {mood.label}
                          </span>
                        ) : null}
                        <span className="ui-away-mood-pill" data-tone="lavender">
                          {card.activity.label}
                        </span>
                      </div>
                    </div>
                    <AppIcon kind="chevron" className="h-3.5 w-3.5 shrink-0 rotate-[-90deg] text-slate-400" />
                  </button>
                </li>
              );
            })}
          </ul>

          {hasMore ? (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="ui-focus-ring ui-button-secondary ui-button-compact mx-1 mt-1 w-full justify-center disabled:opacity-50"
            >
              {isLoadingMore ? 'Loading…' : 'Load more'}
            </button>
          ) : (
            <p className="mt-2 text-center text-[11px] text-slate-400">That&rsquo;s everyone for now.</p>
          )}
        </>
      )}

      {selectedUserId ? (
        <DiscoveryProfileSheet
          userId={selectedUserId}
          currentUserId={currentUserId}
          source="browse"
          onClose={() => setSelectedUserId(null)}
        />
      ) : null}
    </div>
  );
}
