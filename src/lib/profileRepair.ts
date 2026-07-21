import { supabase } from '@/lib/supabase';

export interface ProfileUpsertError {
  message?: string | null;
  code?: string | null;
}

export interface ProfileUpsertOutcome {
  error: ProfileUpsertError | null;
  repaired: boolean;
}

/**
 * Upsert the caller's own public.users row, self-repairing when it fails.
 *
 * An account can end up with no profile row (seen in the field after a
 * partially-failed deletion + re-registration left an orphaned row squatting
 * on the screenname/email). The plain upsert then fails forever with a unique
 * violation, and every FK to users(id) breaks — buddy requests, room joins,
 * discoverability. On failure this calls the repair_own_profile RPC (which
 * clears true orphans and recreates the row server-side) and retries once.
 */
export async function upsertOwnProfileWithRepair(
  payload: Record<string, unknown>,
): Promise<ProfileUpsertOutcome> {
  const first = await supabase.from('users').upsert(payload, { onConflict: 'id' });
  if (!first.error) {
    return { error: null, repaired: false };
  }

  const { error: repairError } = await supabase.rpc('repair_own_profile');
  if (repairError) {
    // Repair unavailable (e.g. migration not applied yet) — report the
    // original failure, not the RPC's.
    return { error: first.error, repaired: false };
  }

  const second = await supabase.from('users').upsert(payload, { onConflict: 'id' });
  return { error: second.error, repaired: !second.error };
}
