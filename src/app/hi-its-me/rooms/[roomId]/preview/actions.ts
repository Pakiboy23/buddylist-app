'use server';

import { createSupabaseAdminClient } from '@/lib/supabaseServer';

export async function joinRoom(
  roomId: string,
  userId: string,
): Promise<{ success: true } | { error: string }> {
  const supabase = createSupabaseAdminClient();

  const { data: room, error: roomError } = await supabase
    .from('chat_rooms')
    .select('room_key, name')
    .eq('id', roomId)
    .single();

  if (roomError || !room) {
    return { error: 'Room not found.' };
  }

  // Insert into user_active_rooms — the sync trigger writes to room_participants.
  const { error } = await supabase.from('user_active_rooms').insert({
    user_id: userId,
    room_key: room.room_key,
    room_name: room.name,
    unread_count: 0,
  });

  // 23505 = unique_violation (already a member) — treat as success.
  if (error && error.code !== '23505') {
    return { error: error.message };
  }

  return { success: true };
}
