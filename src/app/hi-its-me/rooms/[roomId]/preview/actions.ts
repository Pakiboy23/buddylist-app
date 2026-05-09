'use server';

import { createSupabaseAdminClient } from '@/lib/supabaseServer';

export async function joinRoom(
  roomId: string,
  userId: string,
): Promise<{ success: true } | { error: string }> {
  const admin = createSupabaseAdminClient();

  const { data: room, error: roomError } = await admin
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

  const { error } = await admin.from('room_memberships').upsert(
    { room_id: roomId, user_id: userId, last_seen_at: new Date().toISOString() },
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
  const admin = createSupabaseAdminClient();

  const { error } = await admin
    .from('room_memberships')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', userId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
