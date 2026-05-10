import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: CORS_HEADERS });

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return Response.json({ error: 'Unauthorized.' }, { status: 401, headers: CORS_HEADERS });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const anonClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: { user } } = await anonClient.auth.getUser(token);
  if (!user) return Response.json({ error: 'Unauthorized.' }, { status: 401, headers: CORS_HEADERS });

  let body: unknown;
  try { body = await req.json(); }
  catch { return Response.json({ error: 'Invalid JSON.' }, { status: 400, headers: CORS_HEADERS }); }

  const { roomId, buddyIds } = body as { roomId?: unknown; buddyIds?: unknown };
  if (
    typeof roomId !== 'string' || !roomId ||
    !Array.isArray(buddyIds) || buddyIds.length === 0 ||
    buddyIds.some((id) => typeof id !== 'string')
  ) {
    return Response.json(
      { error: 'roomId (string) and buddyIds (non-empty string[]) are required.' },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const invitedIds = buddyIds as string[];
  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // Verify accepted buddy relationships
  const { data: relationships, error: relError } = await admin
    .from('buddies')
    .select('buddy_id, user_id')
    .eq('status', 'accepted')
    .or(
      invitedIds
        .map((id) => `and(user_id.eq.${user.id},buddy_id.eq.${id}),and(user_id.eq.${id},buddy_id.eq.${user.id})`)
        .join(','),
    );

  if (relError) {
    return Response.json({ error: 'Failed to verify buddy relationships.' }, { status: 500, headers: CORS_HEADERS });
  }

  const confirmedIds = new Set(
    (relationships ?? []).map((row: { user_id: string; buddy_id: string }) =>
      row.user_id === user.id ? row.buddy_id : row.user_id,
    ),
  );
  const validIds = invitedIds.filter((id) => confirmedIds.has(id));
  if (!validIds.length) {
    return Response.json({ error: 'None of the specified users are your buddies.' }, { status: 403, headers: CORS_HEADERS });
  }

  // Verify room exists and is active
  const { data: room, error: roomError } = await admin
    .from('rooms')
    .select('id,is_active')
    .eq('id', roomId)
    .single();
  if (roomError || !room) return Response.json({ error: 'Room not found.' }, { status: 404, headers: CORS_HEADERS });
  if (!(room as { is_active: boolean }).is_active) {
    return Response.json({ error: 'Room is not active.' }, { status: 403, headers: CORS_HEADERS });
  }

  // Verify caller is a member
  const { data: callerMembership } = await admin
    .from('room_memberships')
    .select('user_id')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!callerMembership) {
    return Response.json({ error: 'You are not a member of this room.' }, { status: 403, headers: CORS_HEADERS });
  }

  // Upsert each valid buddy into the room
  const now = new Date().toISOString();
  const inserts = validIds.map((uid) => ({ room_id: roomId, user_id: uid, joined_at: now, last_seen_at: now }));
  const { error: insertError } = await admin
    .from('room_memberships')
    .upsert(inserts, { onConflict: 'room_id,user_id', ignoreDuplicates: true });
  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500, headers: CORS_HEADERS });
  }

  return Response.json({ success: true, invited: validIds }, { headers: CORS_HEADERS });
});
