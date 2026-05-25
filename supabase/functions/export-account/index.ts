import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const RATE_LIMIT_MS = 24 * 60 * 60 * 1000; // 24 hours
const MESSAGE_LIMIT = 2000;
const ROOM_MESSAGE_LIMIT = 2000;

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
    return Response.json({ error: 'Unauthorized.' }, { status: 401, headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!supabaseUrl || !serviceKey || !anonKey) {
    return Response.json({ error: 'Server misconfigured.' }, { status: 500, headers: CORS_HEADERS });
  }

  // Verify the caller's JWT via the anon client.
  const anonClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized.' }, { status: 401, headers: CORS_HEADERS });
  }
  const userId = user.id;

  // Service-role client for rate-limit read/write and data fetches.
  // Data isolation is enforced by filtering every query to userId — equivalent
  // to what RLS would enforce for this user's JWT.
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Rate-limit check: one export per 24 hours.
  const { data: profileRow, error: profileErr } = await admin
    .from('users')
    .select('screenname, profile_bio, status_msg, discoverable, created_at, updated_at, age_confirmed_at, art9_consent_at, last_exported_at')
    .eq('id', userId)
    .single();

  if (profileErr || !profileRow) {
    return Response.json({ error: 'Profile not found.' }, { status: 404, headers: CORS_HEADERS });
  }

  if (profileRow.last_exported_at) {
    const elapsed = Date.now() - new Date(profileRow.last_exported_at).getTime();
    if (elapsed < RATE_LIMIT_MS) {
      const retryAfterSeconds = Math.ceil((RATE_LIMIT_MS - elapsed) / 1000);
      return Response.json(
        {
          error: 'You may only export your data once every 24 hours.',
          retry_after_seconds: retryAfterSeconds,
        },
        {
          status: 429,
          headers: {
            ...CORS_HEADERS,
            'Retry-After': String(retryAfterSeconds),
          },
        },
      );
    }
  }

  try {
    // --- Fetch user's own data across all tables ---

    // Direct messages sent by this user. Include counterpart screenname;
    // exclude counterpart's full profile to protect their privacy.
    const { data: messagesSent, error: msgErr } = await admin
      .from('messages')
      .select('id, content, created_at, delivered_at, read_at, expires_at, flagged_at, receiver:users!receiver_id(screenname)')
      .eq('sender_id', userId)
      .order('created_at', { ascending: false })
      .limit(MESSAGE_LIMIT);
    if (msgErr) throw new Error(`messages: ${msgErr.message}`);

    // Room messages authored by this user.
    const { data: roomMessages, error: rmErr } = await admin
      .from('room_messages')
      .select('id, body, created_at, flagged_at, room:rooms!room_id(name, slug)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(ROOM_MESSAGE_LIMIT);
    if (rmErr && !isMissingTable(rmErr)) throw new Error(`room_messages: ${rmErr.message}`);

    // Room memberships.
    const { data: memberships, error: memErr } = await admin
      .from('room_memberships')
      .select('joined_at, last_seen_at, room:rooms!room_id(name, slug, kind)')
      .eq('user_id', userId);
    if (memErr && !isMissingTable(memErr)) throw new Error(`room_memberships: ${memErr.message}`);

    // Blocks placed by this user. Include blocked user's screenname.
    const { data: blocks, error: blkErr } = await admin
      .from('blocked_users')
      .select('reason, created_at, blocked_user:users!blocked_id(screenname)')
      .eq('blocker_id', userId);
    if (blkErr && !isMissingTable(blkErr)) throw new Error(`blocked_users: ${blkErr.message}`);

    // Abuse reports filed by this user.
    const { data: reports, error: rptErr } = await admin
      .from('abuse_reports')
      .select('category, details, status, created_at, target_user:users!target_user_id(screenname)')
      .eq('reporter_id', userId);
    if (rptErr && !isMissingTable(rptErr)) throw new Error(`abuse_reports: ${rptErr.message}`);

    // Push tokens — platform/environment only; raw token is omitted.
    const { data: pushTokens, error: pushErr } = await admin
      .from('user_push_tokens')
      .select('platform, push_environment, created_at, updated_at')
      .eq('user_id', userId);
    if (pushErr && !isMissingTable(pushErr)) throw new Error(`user_push_tokens: ${pushErr.message}`);

    // Privacy settings.
    const { data: privacySettings, error: privErr } = await admin
      .from('user_privacy_settings')
      .select('share_read_receipts, notification_preview_mode, screen_shield_enabled')
      .eq('user_id', userId)
      .maybeSingle();
    if (privErr && !isMissingTable(privErr)) throw new Error(`user_privacy_settings: ${privErr.message}`);

    // Build the export payload.
    const exportedAt = new Date().toISOString();
    const payload = {
      export_generated_at: exportedAt,
      user_id: userId,
      profile: {
        screenname: profileRow.screenname,
        bio: profileRow.profile_bio,
        status_msg: profileRow.status_msg,
        discoverable: profileRow.discoverable,
        account_created_at: profileRow.created_at,
        profile_updated_at: profileRow.updated_at,
        age_confirmed_at: profileRow.age_confirmed_at,
        art9_consent_at: profileRow.art9_consent_at,
      },
      direct_messages_sent: (messagesSent ?? []).map((m) => ({
        id: m.id,
        body: m.content,
        counterpart_screenname: (m.receiver as { screenname?: string } | null)?.screenname ?? null,
        created_at: m.created_at,
        delivered_at: m.delivered_at,
        read_at: m.read_at,
        expires_at: m.expires_at,
        flagged_at: m.flagged_at,
      })),
      room_messages: (roomMessages ?? []).map((m) => ({
        id: m.id,
        body: m.body,
        room_name: (m.room as { name?: string; slug?: string } | null)?.name ?? null,
        room_slug: (m.room as { name?: string; slug?: string } | null)?.slug ?? null,
        created_at: m.created_at,
        flagged_at: m.flagged_at,
      })),
      room_memberships: (memberships ?? []).map((m) => ({
        room_name: (m.room as { name?: string; slug?: string; kind?: string } | null)?.name ?? null,
        room_slug: (m.room as { name?: string; slug?: string; kind?: string } | null)?.slug ?? null,
        room_kind: (m.room as { name?: string; slug?: string; kind?: string } | null)?.kind ?? null,
        joined_at: m.joined_at,
        last_seen_at: m.last_seen_at,
      })),
      blocks: (blocks ?? []).map((b) => ({
        blocked_screenname: (b.blocked_user as { screenname?: string } | null)?.screenname ?? null,
        reason: b.reason,
        created_at: b.created_at,
      })),
      reports_filed: (reports ?? []).map((r) => ({
        target_screenname: (r.target_user as { screenname?: string } | null)?.screenname ?? null,
        category: r.category,
        details: r.details,
        status: r.status,
        created_at: r.created_at,
      })),
      push_notification_tokens: (pushTokens ?? []).map((t) => ({
        platform: t.platform,
        environment: t.push_environment,
        registered_at: t.created_at,
        last_updated_at: t.updated_at,
      })),
      privacy_settings: privacySettings ?? null,
      notes: {
        push_token_values: 'Raw APNs/FCM device tokens are not included in this export for security reasons.',
        messages_received: 'Messages sent to you by other users are not included to protect their privacy. This export contains only content you authored.',
        password_recovery_codes: 'Not applicable — password recovery codes were removed from this app in a prior schema migration.',
        audit_logs: 'Security events (sign-in, credential changes, exports, account deletion) are logged in public.security_events and available to admins. This table is not included in user exports.',
        message_limit: `Exports are capped at ${MESSAGE_LIMIT} sent messages and ${ROOM_MESSAGE_LIMIT} room messages (most recent first). Contact support if you need a complete archive.`,
      },
    };

    // Update last_exported_at before returning so the rate limit is enforced
    // even if the caller discards the response.
    await admin
      .from('users')
      .update({ last_exported_at: exportedAt })
      .eq('id', userId);

    await admin.from('security_events').insert({
      event_type: 'gdpr.export.delivered',
      user_id: userId,
      outcome: 'success',
      metadata: {
        export_size_bytes: JSON.stringify(payload).length,
        tables_included: ['profile', 'direct_messages_sent', 'room_messages', 'room_memberships', 'blocks', 'reports_filed', 'push_notification_tokens', 'privacy_settings'],
      },
    });

    const filename = `hiitsme-export-${exportedAt.slice(0, 10)}.json`;

    return new Response(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error.';
    console.error('[export-account] failed', { userId, message });
    return Response.json(
      { error: 'Export failed. Please try again or contact support.', detail: message },
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
