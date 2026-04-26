import type { SupabaseClient } from '@supabase/supabase-js';

type SupabaseAdminClient = SupabaseClient;

/**
 * Returns true if the given user is in the public.admin_users table.
 * Read with the service-role admin client to bypass RLS.
 */
export async function assertAdminUser(admin: SupabaseAdminClient, userId: string) {
  const { data, error } = await admin
    .from('admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}
