import { useCallback, useEffect, useId, useRef, useState } from 'react';
import AppIcon from '@/components/AppIcon';
import DiscoveryProfileSheet from '@/components/DiscoveryProfileSheet';
import { supabase } from '@/lib/supabase';

interface SearchUser {
  id: string;
  screenname: string;
  away_message: string | null;
}

interface SearchPanelProps {
  currentUserId: string;
}

export default function SearchPanel({ currentUserId }: SearchPanelProps) {
  const [term, setTerm] = useState('');
  const [results, setResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blockedIdsRef = useRef<string[]>([]);
  const inputId = useId();

  useEffect(() => {
    void supabase
      .from('blocked_users')
      .select('blocked_id')
      .eq('blocker_id', currentUserId)
      .then(({ data }) => {
        blockedIdsRef.current = (data ?? []).map((r) => (r as { blocked_id: string }).blocked_id);
      });
  }, [currentUserId]);

  const runSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    let q = supabase
      .from('users')
      .select('id,screenname,away_message')
      .eq('discoverable', true)
      .neq('id', currentUserId)
      .ilike('screenname', `${query.trim()}%`)
      .order('screenname', { ascending: true })
      .limit(30);
    if (blockedIdsRef.current.length > 0) {
      q = q.not('id', 'in', `(${blockedIdsRef.current.join(',')})`);
    }
    const { data } = await q;
    setResults((data ?? []) as SearchUser[]);
    setIsSearching(false);
  }, [currentUserId]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!term.trim()) {
      setResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    debounceRef.current = setTimeout(() => void runSearch(term), 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [term, runSearch]);

  const hasQuery = term.trim().length > 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="ui-compose-surface flex items-center gap-2 rounded-2xl px-3.5 py-2.5">
        <AppIcon kind="search" className="h-4 w-4 shrink-0 text-slate-400" />
        <label htmlFor={inputId} className="sr-only">Search screennames</label>
        <input
          id={inputId}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search screennames…"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-white placeholder-[#6B5B4E] focus:outline-none"
        />
        {term ? (
          <button
            type="button"
            onClick={() => { setTerm(''); setResults([]); }}
            className="ui-focus-ring ui-conversation-action"
            aria-label="Clear search"
          >
            <AppIcon kind="close" className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {isSearching ? (
        <ul className="space-y-1.5 px-1">
          {[60, 80, 50].map((w, i) => (
            <li key={i} className="ui-panel-card rounded-2xl px-4 py-3">
              <div className="ui-skeleton mb-2 h-3 rounded-full" style={{ width: `${w * 0.55}%` }} />
              <div className="ui-skeleton h-3 rounded-full" style={{ width: `${w}%` }} />
            </li>
          ))}
        </ul>
      ) : hasQuery && results.length === 0 ? (
        <div className="ui-empty-state py-10 ui-fade-in">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <AppIcon kind="search" className="h-5 w-5 text-slate-400" />
          </div>
          <p className="text-[12px] text-slate-400">No one found matching &ldquo;{term.trim()}&rdquo;.</p>
        </div>
      ) : results.length > 0 ? (
        <ul className="space-y-1.5 px-1 ui-fade-in">
          {results.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                onClick={() => setSelectedUserId(user.id)}
                className="ui-focus-ring ui-list-row w-full text-left"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(232,162,58,0.12)] text-[13px] font-bold text-[var(--rose)]">
                  {user.screenname.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                    {user.screenname}
                  </p>
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
      ) : (
        <div className="ui-empty-state py-10">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <AppIcon kind="search" className="h-5 w-5 text-slate-400" />
          </div>
          <p className="text-[12px] text-slate-400">Start typing to find people on H.I.M.</p>
        </div>
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
