import { supabase } from '@/lib/supabase';

export interface MutualContextRoom {
  id: string;
  slug: string;
  name: string;
}

export interface MutualContextBuddy {
  id: string;
  screenname: string;
}

export interface MutualContext {
  sharedRooms: MutualContextRoom[];
  mutualBuddies: MutualContextBuddy[];
  mutualBuddyCount: number;
}

export function createEmptyMutualContext(): MutualContext {
  return {
    sharedRooms: [],
    mutualBuddies: [],
    mutualBuddyCount: 0,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

export function normalizeMutualContext(value: unknown): MutualContext {
  if (!isRecord(value)) {
    return createEmptyMutualContext();
  }

  const sharedRooms = uniqueById(
    (Array.isArray(value.sharedRooms) ? value.sharedRooms : []).flatMap((candidate) => {
      if (!isRecord(candidate)) {
        return [];
      }
      const id = readNonEmptyString(candidate.id);
      const slug = readNonEmptyString(candidate.slug);
      const name = readNonEmptyString(candidate.name);
      return id && slug && name ? [{ id, slug, name }] : [];
    }),
  );

  const mutualBuddies = uniqueById(
    (Array.isArray(value.mutualBuddies) ? value.mutualBuddies : []).flatMap((candidate) => {
      if (!isRecord(candidate)) {
        return [];
      }
      const id = readNonEmptyString(candidate.id);
      const screenname = readNonEmptyString(candidate.screenname);
      return id && screenname ? [{ id, screenname }] : [];
    }),
  );

  const rawCount = typeof value.mutualBuddyCount === 'number' && Number.isFinite(value.mutualBuddyCount)
    ? Math.floor(value.mutualBuddyCount)
    : mutualBuddies.length;

  return {
    sharedRooms,
    mutualBuddies,
    mutualBuddyCount: Math.max(mutualBuddies.length, rawCount, 0),
  };
}

export async function loadMutualContext(targetUserId: string): Promise<MutualContext> {
  const normalizedTargetId = targetUserId.trim();
  if (!normalizedTargetId) {
    return createEmptyMutualContext();
  }

  const { data, error } = await supabase.rpc('get_mutual_context', {
    p_target_id: normalizedTargetId,
  });

  if (error) {
    throw new Error(error.message || 'Could not load shared context.');
  }

  return normalizeMutualContext(data);
}
