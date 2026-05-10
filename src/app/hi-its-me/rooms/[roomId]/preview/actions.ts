import { supabase } from '@/lib/supabase';
import { waitForSessionOrNull } from '@/lib/authClient';

import type { Session } from '@supabase/supabase-js';

type AuthResult = { ok: true; session: Session } | { ok: false; error: string };

async function ensureFreshSession(expectedUserId: string): Promise<AuthResult> {
  // First check the cached session.
  const cached = await waitForSessionOrNull();
  if (!cached || cached.user.id !== expectedUserId) {
    return { ok: false, error: 'Session expired. Please sign in again.' };
  }

  // Force a refresh so the JWT we're about to send is current. On Capacitor,
  // the cached token can lag behind the actual auth state and PostgREST
  // rejects the request with an RLS WITH CHECK violation that looks like a
  // policy bug.
  const { data, error } = await supabase.auth.refreshSession();
  if (error) {
    return { ok: false, error: `Auth refresh failed: ${error.message}` };
  }
  if (!data.session?.access_token || data.session.user.id !== expectedUserId) {
    return { ok: false, error: 'Session could not be refreshed.' };
  }
  return { ok: true, session: data.session };
}

export async function joinRoom(
  roomId: string,
  userId: string,
): Promise<{ success: true } | { error: string }> {
  const auth = await ensureFreshSession(userId);
  if (!auth.ok) {
    return { error: auth.error };
  }

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('id, is_active')
    .eq('id', roomId)
    .single();

  if (roomError || !room) {
    return { error: 'Room not found.' };
  }

  if (!room.is_active) {
    return { error: 'This room is not currently active.' };
  }

  const { error } = await supabase.from('room_memberships').upsert(
    { room_id: roomId, user_id: auth.session.user.id, last_seen_at: new Date().toISOString() },
    { onConflict: 'room_id,user_id', ignoreDuplicates: false },
  );

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}

export async function leaveRoom(
  roomId: string,
  userId: string,
): Promise<{ success: true } | { error: string }> {
  const auth = await ensureFreshSession(userId);
  if (!auth.ok) {
    return { error: auth.error };
  }

  const { error } = await supabase
    .from('room_memberships')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', auth.session.user.id);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
