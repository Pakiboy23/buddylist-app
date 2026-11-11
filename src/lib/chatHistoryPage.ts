export const CHAT_DM_HISTORY_PAGE_SIZE = 200;
export const CHAT_ROOM_HISTORY_PAGE_SIZE = 300;

/**
 * PostgREST applies LIMIT after ORDER BY. A chat query of
 * `.order('created_at', { ascending: true }).limit(n)` therefore returns the
 * oldest n rows, not the latest window. Fetch newest-first, then pass the
 * page through here so the transcript still renders oldest → newest.
 */
export function chronologicalFromNewestPage<T>(rows: T[] | null | undefined): T[] {
  if (!rows || rows.length === 0) {
    return [];
  }
  return rows.slice().reverse();
}
