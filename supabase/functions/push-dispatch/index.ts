import { createClient } from 'npm:@supabase/supabase-js@2';
import { importPKCS8, SignJWT } from 'npm:jose';

// ── inline helpers ────────────────────────────────────────────────────────────

type NotificationPreviewMode = 'full' | 'name_only' | 'hidden';
type ApnsEnvironment = 'sandbox' | 'production';

const APNS_PRODUCTION_HOST = 'https://api.push.apple.com';
const APNS_SANDBOX_HOST = 'https://api.sandbox.push.apple.com';
const MAX_PREVIEW_LENGTH = 140;

function normalizeApplePushPrivateKey(value: string): string {
  const t = value.trim();
  const stripped =
    t.length >= 2 &&
    ((t[0] === '"' && t[t.length - 1] === '"') ||
      (t[0] === "'" && t[t.length - 1] === "'"))
      ? t.slice(1, -1)
      : t;
  return stripped.replace(/\\n/g, '\n').trim();
}

function htmlToPlainText(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

function clampPreview(content: string): string {
  const n = content.replace(/\s+/g, ' ').trim();
  if (!n) return 'New message';
  if (n.length <= MAX_PREVIEW_LENGTH) return n;
  return `${n.slice(0, MAX_PREVIEW_LENGTH - 1).trimEnd()}…`;
}

function resolvePreviewText(content: string, previewType?: string | null): string {
  if (previewType === 'buzz') return '⚡ Buzz!';
  if (previewType === 'voice_note') return 'Sent a voice note.';
  if (previewType === 'attachment') return 'Sent an attachment.';
  return clampPreview(htmlToPlainText(content));
}

function applyNotificationPreview(
  input: { senderName: string; messagePreview: string },
  mode: NotificationPreviewMode,
) {
  if (mode === 'hidden') return { senderName: 'H.I.M.', messagePreview: 'New message' };
  if (mode === 'name_only') return { senderName: input.senderName, messagePreview: 'New message' };
  return input;
}

function isPushEnvironmentSchemaMissingError(
  err: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | null | undefined,
): boolean {
  if (!err) return false;
  const s = [err.code, err.message, err.details, err.hint].filter(Boolean).join(' ').toLowerCase();
  return s.includes('push_environment') && (
    s.includes("column of 'user_push_tokens'") || s.includes('schema cache') || s.includes('does not exist')
  );
}

function normalizePushEnvironment(v?: string | null): ApnsEnvironment | null {
  return v === 'sandbox' || v === 'production' ? v : null;
}

function resolveApnsHosts(env: ApnsEnvironment | null): string[] {
  if (env === 'sandbox') return [APNS_SANDBOX_HOST];
  if (env === 'production') return [APNS_PRODUCTION_HOST];
  return [APNS_PRODUCTION_HOST, APNS_SANDBOX_HOST];
}

function readApnsFailureReason(body: string): string {
  try { return (JSON.parse(body) as { reason?: string }).reason ?? ''; } catch { return ''; }
}

function shouldPruneToken(reason: string): boolean {
  return ['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic'].includes(reason);
}

// ── APNs JWT cache (one JWT per request, reused across all tokens) ────────────
// Apple recommends no more than one token per 20 minutes; regenerating per device
// token wastes time and risks Edge Function timeouts on batch room sends.

let cachedApnsJwt: { token: string; topic: string } | null = null;

async function getApnsJwt(): Promise<{ token: string; topic: string }> {
  if (cachedApnsJwt) return cachedApnsJwt;

  const keyId = Deno.env.get('APPLE_PUSH_KEY_ID')?.trim() ?? '';
  const teamId = Deno.env.get('APPLE_PUSH_TEAM_ID')?.trim() ?? '';
  const rawKey = Deno.env.get('APPLE_PUSH_PRIVATE_KEY') ?? '';
  if (!keyId || !teamId || !rawKey) throw new Error('APPLE_PUSH_KEY_ID, APPLE_PUSH_TEAM_ID, and APPLE_PUSH_PRIVATE_KEY are required.');

  const privateKey = await importPKCS8(normalizeApplePushPrivateKey(rawKey), 'ES256');
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);

  const topic = (Deno.env.get('APPLE_PUSH_TOPIC') ?? Deno.env.get('VITE_IOS_BUNDLE_ID') ?? 'com.hiitsme.app').trim();
  cachedApnsJwt = { token, topic };
  return cachedApnsJwt;
}

// APNs sends over HTTP/2 — Deno fetch supports HTTP/2 natively.
async function sendApnsNotification(
  host: string,
  deviceToken: string,
  payload: unknown,
): Promise<{ status: number; body: string }> {
  const { token: jwt, topic } = await getApnsJwt();

  // Expire after 24 hours — tells APNs to store-and-forward the notification
  // if the device is temporarily unreachable (asleep, airplane mode, poor signal).
  // Without this header APNs treats the push as immediate-or-discard.
  const expiration = Math.floor(Date.now() / 1000) + 86400;

  const res = await fetch(`${host}/3/device/${deviceToken}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': topic,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-expiration': String(expiration),
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return { status: res.status, body: await res.text() };
}

// ── main handler ──────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // Reset per-request JWT cache (Deno may reuse the module across invocations).
  cachedApnsJwt = null;

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

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  let body: { kind?: string; messageId?: number | string; roomMessageId?: string; buddyId?: string };
  try { body = await req.json(); }
  catch { return Response.json({ error: 'Invalid request body.' }, { status: 400, headers: CORS_HEADERS }); }

  // ── shared sub-functions ──

  async function resolveSenderName(senderId: string): Promise<string> {
    const { data } = await admin.from('users').select('screenname').eq('id', senderId).maybeSingle();
    return (data as { screenname?: string | null } | null)?.screenname?.trim() || 'H.I.M.';
  }

  async function getPreviewModes(recipientIds: string[]): Promise<Map<string, NotificationPreviewMode>> {
    const { data } = await admin
      .from('user_privacy_settings')
      .select('user_id,notification_preview_mode')
      .in('user_id', recipientIds);
    const map = new Map<string, NotificationPreviewMode>();
    for (const row of (data ?? []) as { user_id: string; notification_preview_mode?: string | null }[]) {
      const m = row.notification_preview_mode;
      map.set(row.user_id, m === 'hidden' || m === 'name_only' ? m : 'full');
    }
    return map;
  }

  async function getPushTokens(recipientIds: string[]) {
    const resp = await admin
      .from('user_push_tokens')
      .select('token,user_id,push_environment')
      .eq('platform', 'ios')
      .in('user_id', recipientIds);
    if (isPushEnvironmentSchemaMissingError(resp.error)) {
      const legacy = await admin
        .from('user_push_tokens')
        .select('token,user_id')
        .eq('platform', 'ios')
        .in('user_id', recipientIds);
      return (legacy.data ?? []) as { token: string; user_id: string; push_environment?: string | null }[];
    }
    if (resp.error) throw new Error(resp.error.message);
    return (resp.data ?? []) as { token: string; user_id: string; push_environment?: string | null }[];
  }

  async function dispatchToRecipients(input: {
    recipientIds: string[];
    senderName: string;
    previewText: string;
    targetPath: string;
    variant: string;
  }) {
    if (!input.recipientIds.length) return { delivered: 0, attempted: 0 };

    const [tokens, previewModes] = await Promise.all([
      getPushTokens(input.recipientIds),
      getPreviewModes(input.recipientIds),
    ]);

    const tokensByUser = new Map<string, { token: string; env: ApnsEnvironment | null }[]>();
    for (const row of tokens) {
      const list = tokensByUser.get(row.user_id) ?? [];
      if (!list.some((e) => e.token === row.token)) {
        list.push({ token: row.token, env: normalizePushEnvironment(row.push_environment) });
        tokensByUser.set(row.user_id, list);
      }
    }

    let attempted = 0, delivered = 0;
    for (const recipientId of input.recipientIds) {
      const userTokens = tokensByUser.get(recipientId) ?? [];
      if (!userTokens.length) continue;

      // Fall back to 'name_only' for recipients with no stored preference —
      // new accounts without a user_privacy_settings row get the privacy-forward default.
      const mode = previewModes.get(recipientId) ?? 'name_only';
      const preview = applyNotificationPreview(
        { senderName: input.senderName, messagePreview: input.previewText },
        mode,
      );
      const payload = {
        aps: {
          alert: { title: preview.senderName, body: preview.messagePreview },
          sound: 'default',
          // mutable-content: 1 lets a future Notification Service Extension
          // decrypt content client-side or enrich the alert before display.
          // No extension is implemented yet; the flag is a forward-compatibility hook.
          'mutable-content': 1,
        },
        senderName: preview.senderName,
        messagePreview: preview.messagePreview,
        targetPath: input.targetPath,
        variant: input.variant,
      };

      for (const entry of userTokens) {
        attempted++;
        const hosts = resolveApnsHosts(entry.env);
        let deliveredThis = false, sawResponse = false, allPrunable = true;

        for (const host of hosts) {
          try {
            const res = await sendApnsNotification(host, entry.token, payload);
            sawResponse = true;
            if (res.status >= 200 && res.status < 300) { delivered++; deliveredThis = true; break; }
            if (!shouldPruneToken(readApnsFailureReason(res.body))) allPrunable = false;
          } catch (e) {
            allPrunable = false;
            console.error('APNs delivery failed:', e);
          }
        }

        if (!deliveredThis && sawResponse && allPrunable) {
          await admin.from('user_push_tokens').delete().eq('token', entry.token);
        }
      }
    }

    return { delivered, attempted };
  }

  // ── dispatch by kind ──

  try {
    // DM push (default when kind is absent)
    if (!body.kind || body.kind === 'dm') {
      const messageId = typeof body.messageId === 'string' ? body.messageId.trim() : String(body.messageId ?? '').trim();
      if (!messageId) {
        return Response.json({ error: 'messageId is required.' }, { status: 400, headers: CORS_HEADERS });
      }
      const { data: msg, error: msgErr } = await admin
        .from('messages')
        .select('id,sender_id,receiver_id,content,preview_type')
        .eq('id', messageId)
        .maybeSingle();
      if (msgErr || !msg) return Response.json({ error: 'Message not found.' }, { status: 404, headers: CORS_HEADERS });
      const m = msg as { sender_id: string; receiver_id: string; content: string; preview_type?: string | null };
      if (m.sender_id !== user.id) return Response.json({ error: 'Message not found.' }, { status: 404, headers: CORS_HEADERS });

      const senderName = await resolveSenderName(user.id);
      const result = await dispatchToRecipients({
        recipientIds: [m.receiver_id],
        senderName,
        previewText: resolvePreviewText(m.content, m.preview_type),
        targetPath: `/hi-its-me?dm=${encodeURIComponent(user.id)}`,
        variant: 'dm',
      });
      return Response.json({ ok: true, ...result }, { headers: CORS_HEADERS });
    }

    // Room push
    if (body.kind === 'room') {
      const roomMessageId = typeof body.roomMessageId === 'string' ? body.roomMessageId.trim() : '';
      if (!roomMessageId) return Response.json({ error: 'roomMessageId is required.' }, { status: 400, headers: CORS_HEADERS });

      const { data: msg, error: msgErr } = await admin
        .from('room_messages')
        .select('id,room_id,user_id,body')
        .eq('id', roomMessageId)
        .maybeSingle();
      if (msgErr || !msg) return Response.json({ error: 'Room message not found.' }, { status: 404, headers: CORS_HEADERS });
      const rm = msg as { room_id: string; user_id: string; body: string };
      if (rm.user_id !== user.id) return Response.json({ error: 'Room message not found.' }, { status: 404, headers: CORS_HEADERS });

      const { data: room, error: roomErr } = await admin
        .from('rooms')
        .select('id,name,slug')
        .eq('id', rm.room_id)
        .maybeSingle();
      if (roomErr || !room) return Response.json({ error: 'Room not found.' }, { status: 404, headers: CORS_HEADERS });
      const r = room as { name: string; slug: string };

      const { data: members } = await admin.from('room_memberships').select('user_id').eq('room_id', rm.room_id);
      const recipientIds = Array.from(
        new Set(((members ?? []) as { user_id: string }[]).map((m) => m.user_id).filter((id) => id && id !== user.id)),
      );

      const senderName = await resolveSenderName(user.id);
      const result = await dispatchToRecipients({
        recipientIds,
        senderName,
        previewText: clampPreview(`${r.name}: ${htmlToPlainText(rm.body) || 'New room message'}`),
        targetPath: `/hi-its-me?tab=chat&room=${encodeURIComponent(r.slug)}`,
        variant: 'room',
      });
      return Response.json({ ok: true, ...result }, { headers: CORS_HEADERS });
    }

    // Buddy push
    if (body.kind === 'buddy_request' || body.kind === 'buddy_accept') {
      const buddyId = typeof body.buddyId === 'string' ? body.buddyId.trim() : '';
      if (!buddyId) return Response.json({ error: 'buddyId is required.' }, { status: 400, headers: CORS_HEADERS });

      const senderName = await resolveSenderName(user.id);
      const previewText = body.kind === 'buddy_request' ? 'sent you a buddy request.' : 'accepted your buddy request.';
      const targetPath =
        body.kind === 'buddy_request'
          ? '/hi-its-me?tab=im'
          : `/hi-its-me?tab=im&dm=${encodeURIComponent(user.id)}`;
      const result = await dispatchToRecipients({ recipientIds: [buddyId], senderName, previewText, targetPath, variant: 'buddy' });
      return Response.json({ ok: true, ...result }, { headers: CORS_HEADERS });
    }

    return Response.json({ error: 'Unknown kind.' }, { status: 400, headers: CORS_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to dispatch push notification.';
    const status = message.includes('APPLE_PUSH_') ? 503 : 500;
    return Response.json({ error: message }, { status, headers: CORS_HEADERS });
  }
});
