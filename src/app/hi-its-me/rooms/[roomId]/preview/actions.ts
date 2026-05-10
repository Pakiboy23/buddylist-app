import { supabase } from '@/lib/supabase';
import { waitForSessionOrNull } from '@/lib/authClient';

export async function joinRoom(
  roomId: string,
  userId: string,
): Promise<{ success: true } | { error: string }> {
  // Re-verify session here in case the JWT was being refreshed when the user tapped Join.
  const session = await waitForSessionOrNull();
  if (!session || session.user.id !== userId) {
    return { error: 'Session expired. Please sign in again.' };
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
  const { error } = await supabase
    .from('room_memberships')
    .delete()
    .eq('room_id', roomId)
    .eq('user_id', userId);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
