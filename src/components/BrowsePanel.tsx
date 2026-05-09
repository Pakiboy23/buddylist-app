import { useCallback, useEffect, useRef, useState } from 'react';
import AppIcon from '@/components/AppIcon';
import DiscoveryProfileSheet from '@/components/DiscoveryProfileSheet';
import { supabase } from '@/lib/supabase';

interface BrowseUser {
  id: string;
  screenname: string;
  away_message: string | null;
  last_active_at: string | null;
}

const PAGE_SIZE = 50;

function formatRelativeTime(isoString: string | null): string {
  if (!isoString) return '';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

interface BrowsePanelProps {
  currentUserId: string;
}

export default function BrowsePanel({ currentUserId }: BrowsePanelProps) {
  const [users, setUsers] = useState<BrowseUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const loadedOnceRef = useRef(false);
  const blockedIdsRef = useRef<string[]>([]);

  useEffect(() => {
    void supabase
      .from('blocked_users')
      .select('blocked_id')
      .eq('blocker_id', currentUserId)
      .then(({ data }) => {
        blockedIdsRef.current = (data ?? []).map((r) => (r as { blocked_id: string }).blocked_id);
      });
  }, [currentUserId]);

  const fetchPage = useCallback(async (pageOffset: number, replace: boolean) => {
    if (replace) setIsLoading(true);
    else setIsLoadingMore(true);

    let query = supabase
      .from('users')
      .select('id,screenname,away_message,last_active_at')
      .eq('discoverable', true)
      .not('away_message', 'is', null)
      .neq('away_message', '')
      .neq('id', currentUserId)
      .order('last_active_at', { ascending: false, nullsFirst: false })
      .range(pageOffset, pageOffset + PAGE_SIZE - 1);

    if (blockedIdsRef.current.length > 0) {
      query = query.not('id', 'in', `(${blockedIdsRef.current.join(',')})`);
    }

    const { data } = await query;

    const rows = (data ?? []) as BrowseUser[];

    if (replace) {
      setUsers(rows);
      setIsLoading(false);
    } else {
      setUsers((prev) => [...prev, ...rows]);
      setIsLoadingMore(false);
    }

    setHasMore(rows.length === PAGE_SIZE);
    loadedOnceRef.current = true;
  }, [currentUserId]);

  useEffect(() => {
    void fetchPage(0, true);
  }, [fetchPage]);

  const handleLoadMore = () => {
    const nextOffset = offset + PAGE_SIZE;
    setOffset(nextOffset);
    void fetchPage(nextOffset, false);
  };

  return (
    <div className="flex flex-col">
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
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-50 dark:bg-violet-950/25">
            <AppIcon kind="buddy" className="h-5 w-5 text-violet-400 dark:text-violet-300" />
          </div>
          <p className="text-[12px] text-slate-400">No one's posted a status yet. Check back soon.</p>
        </div>
      ) : (
        <>
          <ul className="space-y-1.5 px-1 ui-fade-in">
            {users.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  onClick={() => setSelectedUserId(user.id)}
                  className="ui-focus-ring ui-list-row w-full text-left"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(232,96,138,0.12)] text-[13px] font-bold text-[var(--rose)]">
                    {user.screenname.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                        {user.screenname}
                      </p>
                      {user.last_active_at ? (
                        <span className="shrink-0 text-[10px] text-slate-400">
                          {formatRelativeTime(user.last_active_at)}
                        </span>
                      ) : null}
                    </div>
                    {user.away_message ? (
                      <p className="mt-0.5 truncate text-[11px] italic text-slate-500 dark:text-slate-400">
                        &ldquo;{user.away_message}&rdquo;
                      </p>
                    ) : null}
                  </div>
                  <AppIcon kind="chevron" className="h-3.5 w-3.5 shrink-0 rotate-[-90deg] text-slate-400" />
                </button>
              </li>
            ))}
          </ul>

          {hasMore ? (
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isLoadingMore}
              className="ui-focus-ring ui-button-secondary ui-button-compact mx-1 mt-3 w-full justify-center disabled:opacity-50"
            >
              {isLoadingMore ? 'Loading…' : 'Load more'}
            </button>
          ) : (
            <p className="mt-4 text-center text-[11px] text-slate-400">That's everyone for now.</p>
          )}
        </>
      )}

      {selectedUserId ? (
        <DiscoveryProfileSheet
          userId={selectedUserId}
          currentUserId={currentUserId}
          onClose={() => setSelectedUserId(null)}
        />
      ) : null}
    </div>
  );
}
