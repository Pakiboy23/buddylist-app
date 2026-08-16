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

  // Verify accepted buddy relationships.
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

  // Verify room exists and is active.
  const { data: room, error: roomError } = await admin
    .from('rooms')
    .select('id, is_active')
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

  if (!room.is_active) {
    return jsonWithCors(
      request,
      { error: 'Room is not active.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
      ALLOWED_METHODS,
    );
  }

  // Verify caller is a member.
  const { data: callerMembership } = await admin
    .from('room_memberships')
    .select('user_id')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!callerMembership) {
    return jsonWithCors(
      request,
      { error: 'You are not a member of this room.' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
      ALLOWED_METHODS,
    );
  }

  // Upsert each valid buddy into the room.
  const now = new Date().toISOString();
  const inserts = validIds.map((uid) => ({
    room_id: roomId,
    user_id: uid,
    joined_at: now,
    last_seen_at: now,
  }));

  const { error: insertError } = await admin
    .from('room_memberships')
    .upsert(inserts, { onConflict: 'room_id,user_id', ignoreDuplicates: true });

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
