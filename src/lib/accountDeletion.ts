import { supabase } from '@/lib/supabase';

/**
 * Returns true when the user's typed confirmation matches their screenname.
 * Case-insensitive and trim-tolerant so we don't reject "  alice " when the
 * screenname is "alice", but rejects empty input.
 */
export function screennameConfirmationMatches(
  typed: string | null | undefined,
  expected: string | null | undefined,
): boolean {
  const a = (typed ?? '').trim().toLowerCase();
  const b = (expected ?? '').trim().toLowerCase();
  if (!a || !b) return false;
  return a === b;
}

export interface DeleteAccountResult {
  ok: boolean;
  error?: string;
}

export async function invokeDeleteAccount(): Promise<DeleteAccountResult> {
  const { data, error } = await supabase.functions.invoke<{
    ok?: boolean;
    error?: string;
    detail?: string;
  }>('delete-account', {
    method: 'POST',
    body: {},
  });

  if (error) {
    return { ok: false, error: error.message };
  }
  if (!data?.ok) {
    return { ok: false, error: data?.error || 'Deletion failed.' };
  }
  return { ok: true };
}
