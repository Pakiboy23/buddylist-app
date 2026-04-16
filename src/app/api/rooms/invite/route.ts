import { createCorsPreflightResponse, jsonWithCors } from '@/lib/apiCors';
import { createSupabaseAdminClient, getRequestUser } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_METHODS = ['POST'];

export function OPTIONS(request: Request) {
  return createCorsPreflightResponse(request, ALLOWED_METHODS);
}

export async function POST(request: Request) {
  const user = await getRequestUser(request);
  if (!user) {
    return jsonWithCors(
      request,
      { error: 'Unauthorized.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
      ALLOWED_METHODS,
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonWithCors(
      request,
      { error: 'Invalid JSON.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
      ALLOWED_METHODS,
    );
  }

  const { roomId, buddyIds } = body as { roomId?: unknown; buddyIds?: unknown };

  if (
    typeof roomId !== 'string' ||
    !roomId ||
    !Array.isArray(buddyIds) ||
    buddyIds.length === 0 ||
    buddyIds.some((id) => typeof id !== 'string')
  ) {
    return jsonWithCors(
      request,
      { error: 'roomId (string) and buddyIds (non-empty string[]) are required.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
      ALLOWED_METHODS,
    );
  }

  const invitedIds = buddyIds as string[];
  const admin = createSupabaseAdminClient();

  // Verify the caller has accepted buddy relationships with these users.
  const { data: relationships, error: relError } = await admin
    .from('buddies')
    .select('buddy_id, user_id')
    .eq('status', 'accepted')
    .or(
      invitedIds
        .map(
          (id) =>
            `and(user_id.eq.${user.id},buddy_id.eq.${id}),and(user_id.eq.${id},buddy_id.eq.${user.id})`,
        )
        .join(','),
    );

  if (relError) {
    return jsonWithCors(
      request,
      { error: 'Failed to verify buddy relationships.' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
      ALLOWED_METHODS,
    );
  }

  const confirmedIds = new Set(
    (relationships ?? []).map((row) =>
      row.user_id === user.id ? row.buddy_id : row.user_id,
    ),
  );

  const validIds = invitedIds.filter((id) => confirmedIds.has(id));
  if (validIds.length === 0) {
    return jsonWithCors(
      request,
      { error: 'None of the specified users are your buddies.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
      ALLOWED_METHODS,
    );
  }

  // Look up the room.
  const { data: room, error: roomError } = await admin
    .from('chat_rooms')
    .select('room_key, name')
    .eq('id', roomId)
    .single();

  if (roomError || !room) {
    return jsonWithCors(
      request,
      { error: 'Room not found.' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
      ALLOWED_METHODS,
    );
  }

  // Verify caller is already a member of the room.
  const { data: callerMembership } = await admin
    .from('user_active_rooms')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('room_key', room.room_key)
    .maybeSingle();

  if (!callerMembership) {
    return jsonWithCors(
      request,
      { error: 'You are not a member of this room.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
      ALLOWED_METHODS,
    );
  }

  // Insert each valid buddy — ignore unique_violation (already a member).
  const inserts = validIds.map((userId) => ({
    user_id: userId,
    room_key: room.room_key,
    room_name: room.name,
    unread_count: 0,
  }));

  const { error: insertError } = await admin
    .from('user_active_rooms')
    .upsert(inserts, { onConflict: 'user_id,room_key', ignoreDuplicates: true });

  if (insertError) {
    return jsonWithCors(
      request,
      { error: insertError.message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
      ALLOWED_METHODS,
    );
  }

  return jsonWithCors(
    request,
    { success: true, invited: validIds },
    { headers: { 'Cache-Control': 'no-store' } },
    ALLOWED_METHODS,
  );
}
