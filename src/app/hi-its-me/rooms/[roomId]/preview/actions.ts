import { supabase } from '@/lib/supabase';

type RpcResult = { ok: true; user_id: string } | { ok: false; error: string };

const ERROR_MESSAGES: Record<string, string> = {
  not_authenticated: 'You are signed out. Please sign in again.',
  room_not_found: 'Room not found.',
  room_inactive: 'This room is not currently active.',
};

function humanize(code: string): string {
  return ERROR_MESSAGES[code] ?? `Could not complete: ${code}`;
}

export async function joinRoom(
  roomId: string,
  _userId: string,
): Promise<{ success: true } | { error: string }> {
  const { data, error } = await supabase.rpc('join_room_by_id', { p_room_id: roomId });

  if (error) {
    // Capture auth context for diagnosis if the RPC itself errored.
    const { data: debug } = await supabase.rpc('debug_auth');
    return {
      error: `RPC failed: ${error.message} | auth=${JSON.stringify(debug ?? {})}`,
    };
  }

  const result = data as RpcResult | null;
  if (!result) {
    return { error: 'Empty RPC response.' };
  }
  if (!result.ok) {
    return { error: humanize(result.error) };
  }
  return { success: true };
}

export async function leaveRoom(
  roomId: string,
  _userId: string,
): Promise<{ success: true } | { error: string }> {
  const { data, error } = await supabase.rpc('leave_room_by_id', { p_room_id: roomId });

  if (error) {
    return { error: `RPC failed: ${error.message}` };
  }

  const result = data as RpcResult | null;
  if (!result) {
    return { error: 'Empty RPC response.' };
  }
  if (!result.ok) {
    return { error: humanize(result.error) };
  }
  return { success: true };
}
