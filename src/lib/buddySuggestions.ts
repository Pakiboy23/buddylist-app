import { supabase } from '@/lib/supabase';
import { resolveBuddyIconUrl } from '@/lib/buddyIcon';

export interface BuddySuggestion {
  id: string;
  screenname: string;
  avatarUrl: string | null;
  mutualCount: number;
  sharedRoomCount: number;
}

function toCount(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

/**
 * Ranked "people you might know" for the native buddy-list rail.
 * Server-side function enforces discoverability, edge, and block filters —
 * treat an error as "no suggestions" so the rail simply hides.
 */
export async function fetchBuddySuggestions(limit = 8): Promise<BuddySuggestion[]> {
  const { data, error } = await supabase.rpc('suggest_buddies', { limit_count: limit });
  if (error || !Array.isArray(data)) {
    return [];
  }

  return data
    .map((row) => {
      const record = row as Record<string, unknown>;
      return {
        id: typeof record.user_id === 'string' ? record.user_id : '',
        screenname: typeof record.screenname === 'string' ? record.screenname.trim() : '',
        avatarUrl: resolveBuddyIconUrl(
          typeof record.buddy_icon_path === 'string' ? record.buddy_icon_path : null,
        ),
        mutualCount: toCount(record.mutual_count),
        sharedRoomCount: toCount(record.shared_room_count),
      };
    })
    .filter((suggestion) => suggestion.id.length > 0 && suggestion.screenname.length > 0);
}
