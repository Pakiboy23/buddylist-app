import { supabase } from '@/lib/supabase';

// Buddy Circles — private, owner-only groups for organizing the buddy list.
// A buddy is filed into at most one circle; buddies with no membership render
// under an implicit "Ungrouped" section. Each circle carries two owner-side
// controls (they only change the owner's own view, never what buddies see):
//   * showPresence — hide a circle's live presence from the owner's list
//   * notifyMode   — 'muted' silences that circle's in-app DM alerts
// All access is gated by owner-only RLS (migration 20260722130125).

export const MAX_CIRCLE_NAME_LENGTH = 40;

export type CircleNotifyMode = 'all' | 'muted';

export interface BuddyCircle {
  id: string;
  name: string;
  position: number;
  showPresence: boolean;
  notifyMode: CircleNotifyMode;
  memberBuddyIds: string[];
}

const CIRCLE_SELECT = 'id, name, position, show_presence, notify_mode, buddy_circle_members(buddy_id)';

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

function normalizeNotifyMode(value: unknown): CircleNotifyMode {
  return value === 'muted' ? 'muted' : 'all';
}

function uniqueStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      result.push(value);
    }
  }
  return result;
}

export function normalizeBuddyCircle(value: unknown): BuddyCircle | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readNonEmptyString(value.id);
  const name = readNonEmptyString(value.name);
  if (!id || !name) {
    return null;
  }

  const memberBuddyIds = uniqueStrings(
    (Array.isArray(value.buddy_circle_members) ? value.buddy_circle_members : []).flatMap((member) => {
      if (!isRecord(member)) {
        return [];
      }
      const buddyId = readNonEmptyString(member.buddy_id);
      return buddyId ? [buddyId] : [];
    }),
  );

  const rawPosition = typeof value.position === 'number' && Number.isFinite(value.position)
    ? Math.trunc(value.position)
    : 0;

  return {
    id,
    name,
    position: rawPosition,
    showPresence: value.show_presence !== false,
    notifyMode: normalizeNotifyMode(value.notify_mode),
    memberBuddyIds,
  };
}

export function normalizeBuddyCircles(value: unknown): BuddyCircle[] {
  const circles = (Array.isArray(value) ? value : []).flatMap((candidate) => {
    const circle = normalizeBuddyCircle(candidate);
    return circle ? [circle] : [];
  });

  return circles.sort((a, b) => {
    if (a.position !== b.position) {
      return a.position - b.position;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

/**
 * Maps each buddy id to the circle it belongs to (a buddy is in at most one).
 * Buddies absent from the map are "Ungrouped".
 */
export function buildBuddyCircleIndex(circles: BuddyCircle[]): Map<string, BuddyCircle> {
  const index = new Map<string, BuddyCircle>();
  for (const circle of circles) {
    for (const buddyId of circle.memberBuddyIds) {
      if (!index.has(buddyId)) {
        index.set(buddyId, circle);
      }
    }
  }
  return index;
}

export async function loadBuddyCircles(): Promise<BuddyCircle[]> {
  const { data, error } = await supabase.from('buddy_circles').select(CIRCLE_SELECT);
  if (error) {
    throw new Error(error.message || 'Could not load your circles.');
  }
  return normalizeBuddyCircles(data);
}

export async function createBuddyCircle(input: {
  ownerId: string;
  name: string;
  position?: number;
}): Promise<BuddyCircle> {
  const name = input.name.trim();
  if (!name) {
    throw new Error('Give the circle a name.');
  }

  const { data, error } = await supabase
    .from('buddy_circles')
    .insert({ owner_id: input.ownerId, name, position: input.position ?? 0 })
    .select(CIRCLE_SELECT)
    .single();

  if (error) {
    throw new Error(error.message || 'Could not create that circle.');
  }

  const circle = normalizeBuddyCircle(data);
  if (!circle) {
    throw new Error('Could not create that circle.');
  }
  return circle;
}

export async function renameBuddyCircle(circleId: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Give the circle a name.');
  }
  const { error } = await supabase.from('buddy_circles').update({ name: trimmed }).eq('id', circleId);
  if (error) {
    throw new Error(error.message || 'Could not rename that circle.');
  }
}

export async function updateBuddyCircleSettings(
  circleId: string,
  settings: { showPresence?: boolean; notifyMode?: CircleNotifyMode },
): Promise<void> {
  const patch: { show_presence?: boolean; notify_mode?: CircleNotifyMode } = {};
  if (typeof settings.showPresence === 'boolean') {
    patch.show_presence = settings.showPresence;
  }
  if (settings.notifyMode) {
    patch.notify_mode = settings.notifyMode;
  }
  if (Object.keys(patch).length === 0) {
    return;
  }
  const { error } = await supabase.from('buddy_circles').update(patch).eq('id', circleId);
  if (error) {
    throw new Error(error.message || 'Could not update that circle.');
  }
}

export async function deleteBuddyCircle(circleId: string): Promise<void> {
  // buddy_circle_members rows cascade away with the circle.
  const { error } = await supabase.from('buddy_circles').delete().eq('id', circleId);
  if (error) {
    throw new Error(error.message || 'Could not delete that circle.');
  }
}

/**
 * Files a buddy into a circle, or removes them from every circle when
 * circleId is null. Upsert on (owner_id, buddy_id) enforces one-circle-per-buddy.
 */
export async function setBuddyCircle(input: {
  ownerId: string;
  buddyId: string;
  circleId: string | null;
}): Promise<void> {
  if (input.circleId === null) {
    const { error } = await supabase
      .from('buddy_circle_members')
      .delete()
      .eq('owner_id', input.ownerId)
      .eq('buddy_id', input.buddyId);
    if (error) {
      throw new Error(error.message || 'Could not update that buddy.');
    }
    return;
  }

  const { error } = await supabase.from('buddy_circle_members').upsert(
    { circle_id: input.circleId, owner_id: input.ownerId, buddy_id: input.buddyId },
    { onConflict: 'owner_id,buddy_id' },
  );
  if (error) {
    throw new Error(error.message || 'Could not add that buddy to the circle.');
  }
}

export async function reorderBuddyCircles(orderedCircleIds: string[]): Promise<void> {
  await Promise.all(
    orderedCircleIds.map((circleId, index) =>
      supabase
        .from('buddy_circles')
        .update({ position: index })
        .eq('id', circleId)
        .then(({ error }) => {
          if (error) {
            throw new Error(error.message || 'Could not reorder your circles.');
          }
        }),
    ),
  );
}
