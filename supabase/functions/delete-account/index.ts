import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface DeleteResult {
  table: string;
  filter: string;
  deletedAt: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return Response.json(
      { error: 'Method not allowed.' },
      { status: 405, headers: CORS_HEADERS },
    );
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return Response.json(
      { error: 'Unauthorized.' },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return Response.json(
      { error: 'Server misconfigured.' },
      { status: 500, headers: CORS_HEADERS },
    );
  }

  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: authError,
  } = await anonClient.auth.getUser(token);

  if (authError || !user) {
    return Response.json(
      { error: 'Unauthorized.' },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const userId = user.id;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const results: DeleteResult[] = [];
  const recordDelete = (table: string, filter: string) => {
    results.push({ table, filter, deletedAt: new Date().toISOString() });
  };

  try {
    // Delete in dependency order. Most child rows cascade off public.users, but we
    // explicitly clear them so a partial failure surfaces an error rather than a
    // silent dangling row.

    // Messages (DM): user as sender or receiver.
    {
      const { error } = await admin.from('messages').delete().eq('sender_id', userId);
      if (error) throw new Error(`messages(sender_id): ${error.message}`);
      recordDelete('messages', 'sender_id');
    }
    {
      const { error } = await admin.from('messages').delete().eq('receiver_id', userId);
      if (error) throw new Error(`messages(receiver_id): ${error.message}`);
      recordDelete('messages', 'receiver_id');
    }

    // Room messages authored by the user.
    {
      const { error } = await admin.from('room_messages').delete().eq('sender_id', userId);
      if (error && !isMissingTable(error)) {
        throw new Error(`room_messages: ${error.message}`);
      }
      recordDelete('room_messages', 'sender_id');
    }

    // Room participants + active rooms.
    {
      const { error } = await admin.from('room_participants').delete().eq('user_id', userId);
      if (error && !isMissingTable(error)) {
        throw new Error(`room_participants: ${error.message}`);
      }
      recordDelete('room_participants', 'user_id');
    }
    {
      const { error } = await admin.from('user_active_rooms').delete().eq('user_id', userId);
      if (error && !isMissingTable(error)) {
        throw new Error(`user_active_rooms: ${error.message}`);
      }
      recordDelete('user_active_rooms', 'user_id');
    }

    // DM state + DM preferences (per-conversation preferences).
    {
      const { error } = await admin.from('user_dm_state').delete().eq('user_id', userId);
      if (error && !isMissingTable(error)) {
        throw new Error(`user_dm_state(user_id): ${error.message}`);
      }
      recordDelete('user_dm_state', 'user_id');
    }
    {
      const { error } = await admin.from('user_dm_state').delete().eq('buddy_id', userId);
      if (error && !isMissingTable(error)) {
        throw new Error(`user_dm_state(buddy_id): ${error.message}`);
      }
      recordDelete('user_dm_state', 'buddy_id');
    }
    {
      const { error } = await admin.from('user_dm_preferences').delete().eq('user_id', userId);
      if (error && !isMissingTable(error)) {
        throw new Error(`user_dm_preferences(user_id): ${error.message}`);
      }
      recordDelete('user_dm_preferences', 'user_id');
    }
    {
      const { error } = await admin.from('user_dm_preferences').delete().eq('buddy_id', userId);
      if (error && !isMissingTable(error)) {
        throw new Error(`user_dm_preferences(buddy_id): ${error.message}`);
      }
      recordDelete('user_dm_preferences', 'buddy_id');
    }

    // Blocked users (both sides).
    {
      const { error } = await admin.from('blocked_users').delete().eq('blocker_id', userId);
      if (error && !isMissingTable(error)) {
        throw new Error(`blocked_users(blocker_id): ${error.message}`);
      }
      recordDelete('blocked_users', 'blocker_id');
    }
    {
      const { error } = await admin.from('blocked_users').delete().eq('blocked_id', userId);
      if (error && !isMissingTable(error)) {
        throw new Error(`blocked_users(blocked_id): ${error.message}`);
      }
      recordDelete('blocked_users', 'blocked_id');
    }

    // Abuse reports (both reporter and target — full erasure per product decision).
    {
      const { error } = await admin.from('abuse_reports').delete().eq('reporter_id', userId);
      if (error && !isMissingTable(error)) {
        throw new Error(`abuse_reports(reporter_id): ${error.message}`);
      }
      recordDelete('abuse_reports', 'reporter_id');
    }
    {
      const { error } = await admin.from('abuse_reports').delete().eq('target_user_id', userId);
      if (error && !isMissingTable(error)) {
        throw new Error(`abuse_reports(target_user_id): ${error.message}`);
      }
      recordDelete('abuse_reports', 'target_user_id');
    }

    // Buddies (both sides — schema uses user_id / buddy_id).
    {
      const { error } = await admin.from('buddies').delete().eq('user_id', userId);
      if (error) throw new Error(`buddies(user_id): ${error.message}`);
      recordDelete('buddies', 'user_id');
    }
    {
      const { error } = await admin.from('buddies').delete().eq('buddy_id', userId);
      if (error) throw new Error(`buddies(buddy_id): ${error.message}`);
      recordDelete('buddies', 'buddy_id');
    }

    // user_connections — alternative buddy/friendship model from newer migrations.
    {
      const { error } = await admin.from('user_connections').delete().eq('user_a', userId);
      if (error && !isMissingTable(error)) {
        throw new Error(`user_connections(user_a): ${error.message}`);
      }
      recordDelete('user_connections', 'user_a');
    }
    {
      const { error } = await admin.from('user_connections').delete().eq('user_b', userId);
      if (error && !isMissingTable(error)) {
        throw new Error(`user_connections(user_b): ${error.message}`);
      }
      recordDelete('user_connections', 'user_b');
    }

    // Saved messages owned by the user.
    {
      const { error } = await admin.from('saved_messages').delete().eq('user_id', userId);
      if (error && !isMissingTable(error)) {
        throw new Error(`saved_messages: ${error.message}`);
      }
      recordDelete('saved_messages', 'user_id');
    }

    // Privacy settings (PK = user_id).
    {
      const { error } = await admin.from('user_privacy_settings').delete().eq('user_id', userId);
      if (error && !isMissingTable(error)) {
        throw new Error(`user_privacy_settings: ${error.message}`);
      }
      recordDelete('user_privacy_settings', 'user_id');
    }

    // Push tokens.
    {
      const { error } = await admin.from('user_push_tokens').delete().eq('user_id', userId);
      if (error && !isMissingTable(error)) {
        throw new Error(`user_push_tokens: ${error.message}`);
      }
      recordDelete('user_push_tokens', 'user_id');
    }

    // Profile row (public.users mirrors auth.users). Most child tables cascade
    // off this, but we deleted them explicitly above for an auditable trail.
    {
      const { error } = await admin.from('users').delete().eq('id', userId);
      if (error) throw new Error(`users: ${error.message}`);
      recordDelete('users', 'id');
    }

    // Auth row LAST. Once this returns we have no way to recover the user.
    const { error: authDeleteError } = await admin.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      throw new Error(`auth.admin.deleteUser: ${authDeleteError.message}`);
    }
    recordDelete('auth.users', 'id');

    return Response.json(
      { ok: true, userId, deletes: results },
      { headers: CORS_HEADERS },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error.';
    console.error('[delete-account] failed', { userId, message, completed: results });
    return Response.json(
      {
        error: 'Account deletion failed. Some data may have been removed; please contact support.',
        detail: message,
        completed: results,
      },
      { status: 500, headers: CORS_HEADERS },
    );
  }
});

function isMissingTable(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) return false;
  const code = error.code ?? '';
  const message = (error.message ?? '').toLowerCase();
  return code === '42P01' || message.includes('does not exist');
}
