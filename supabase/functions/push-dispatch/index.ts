import { createClient } from 'npm:@supabase/supabase-js@2';
import { importPKCS8, SignJWT } from 'npm:jose';

// ── inline helpers ────────────────────────────────────────────────────────────

type NotificationPreviewMode = 'full' | 'name_only' | 'hidden';
type ApnsEnvironment = 'sandbox' | 'production';
type PushPlatform = 'ios' | 'android';

interface PushTokenRow {
  token: string;
  user_id: string;
  platform: PushPlatform;
  push_environment?: string | null;
}

// One entry per token we tried and failed to deliver to. Never contains the
// token itself — this is written to a table an operator reads, not a debug dump.
interface PushDispatchFailure {
  platform: PushPlatform;
  env: ApnsEnvironment | null;
  status: number | null;
  reason: string;
}

interface DispatchResult {
  delivered: number;
  attempted: number;
  tokens: number;
  pruned: number;
  failures: PushDispatchFailure[];
}

const MAX_LOGGED_FAILURES = 20;
const MAX_FAILURE_REASON_LENGTH = 200;

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
  if (previewType === 'knock') return '👋 Knock — wants to talk.';
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

// Failure text reaches push_dispatch_log, which promises to hold no device
// tokens — so it is redacted before it is stored, not merely trimmed.
//
// The device token is a path segment of the APNs request URL
// (`/3/device/<token>`), and a transport-level fetch error quotes the URL it
// failed on, so an APNs outage would otherwise persist every token it touched.
// FCM error bodies echo the registration token the same way. Both are covered:
// the APNs device path explicitly, and then any remaining long unbroken
// token-shaped run (APNs tokens are 64 hex characters, FCM's are longer still).
//
// Mirrored in src/lib/pushFailureRedaction.ts, which carries the tests — keep
// both in sync.
function redactPushTokens(raw: string): string {
  return raw
    .replace(/(\/3\/device\/)[A-Za-z0-9_-]+/g, '$1[redacted]')
    .replace(/[A-Za-z0-9_:-]{40,}/g, '[redacted]');
}

function clampFailureReason(raw: string): string {
  const n = redactPushTokens((raw ?? '').replace(/\s+/g, ' ').trim());
  if (!n) return 'unknown';
  return n.length <= MAX_FAILURE_REASON_LENGTH ? n : `${n.slice(0, MAX_FAILURE_REASON_LENGTH - 1)}\u2026`;
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

// ── FCM (Android) ─────────────────────────────────────────────────────────────
// Android push goes through Firebase Cloud Messaging HTTP v1. Auth is a short-lived
// OAuth2 access token minted from a Google service account (RS256 JWT → Google token
// endpoint). One access token is cached per request and reused across every Android
// token, mirroring the APNs JWT cache above. If FCM is not configured the dispatcher
// skips Android tokens silently so iOS delivery still succeeds.

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const GOOGLE_TOKEN_URI = 'https://oauth2.googleapis.com/token';

interface FcmServiceAccount {
  clientEmail: string;
  privateKey: string;
  projectId: string;
  tokenUri: string;
}

// undefined = not yet read this request; null = read and not configured.
let cachedFcmConfig: FcmServiceAccount | null | undefined;

function getFcmServiceAccount(): FcmServiceAccount | null {
  if (cachedFcmConfig !== undefined) return cachedFcmConfig;

  const raw = Deno.env.get('FCM_SERVICE_ACCOUNT_JSON')?.trim();
  if (!raw) {
    cachedFcmConfig = null;
    return null;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('FCM_SERVICE_ACCOUNT_JSON is not valid JSON.');
  }

  const clientEmail = String(parsed.client_email ?? '').trim();
  // The service-account PEM may arrive with literal \n if stored single-line.
  const privateKey = String(parsed.private_key ?? '').replace(/\\n/g, '\n').trim();
  const projectId = String(parsed.project_id ?? '').trim();
  const tokenUri = String(parsed.token_uri ?? '').trim() || GOOGLE_TOKEN_URI;
  if (!clientEmail || !privateKey || !projectId) {
    throw new Error('FCM_SERVICE_ACCOUNT_JSON must include client_email, private_key, and project_id.');
  }

  cachedFcmConfig = { clientEmail, privateKey, projectId, tokenUri };
  return cachedFcmConfig;
}

let cachedFcmAccessToken: { token: string; projectId: string } | null = null;

async function getFcmAccessToken(account: FcmServiceAccount): Promise<{ token: string; projectId: string }> {
  if (cachedFcmAccessToken) return cachedFcmAccessToken;

  const privateKey = await importPKCS8(account.privateKey, 'RS256');
  const assertion = await new SignJWT({ scope: FCM_SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(account.clientEmail)
    .setSubject(account.clientEmail)
    .setAudience(account.tokenUri)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKey);

  const res = await fetch(account.tokenUri, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`FCM token exchange failed (${res.status}): ${body}`);

  let accessToken = '';
  try { accessToken = (JSON.parse(body) as { access_token?: string }).access_token ?? ''; } catch { /* handled below */ }
  if (!accessToken) throw new Error('FCM token exchange returned no access_token.');

  cachedFcmAccessToken = { token: accessToken, projectId: account.projectId };
  return cachedFcmAccessToken;
}

async function sendFcmNotification(
  projectId: string,
  accessToken: string,
  deviceToken: string,
  message: { title: string; body: string; data: Record<string, string> },
): Promise<{ status: number; body: string }> {
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      message: {
        token: deviceToken,
        notification: { title: message.title, body: message.body },
        data: message.data,
        android: {
          priority: 'high',
          notification: { sound: 'default' },
        },
      },
    }),
  });
  return { status: res.status, body: await res.text() };
}

// FCM v1 returns 404 (UNREGISTERED) or 400 INVALID_ARGUMENT for permanently dead
// tokens — prune those. Transient 5xx and auth (401/403) errors must NOT prune.
function shouldPruneFcmToken(status: number, body: string): boolean {
  if (status === 404) return true;
  if (status !== 400) return false;
  try {
    const errorStatus = (JSON.parse(body) as { error?: { status?: string } }).error?.status ?? '';
    return errorStatus === 'INVALID_ARGUMENT' || errorStatus === 'NOT_FOUND' || errorStatus === 'UNREGISTERED';
  } catch {
    return false;
  }
}

// ── main handler ──────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-him-fanout-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req: Request) => {
  // Reset per-request auth caches (Deno may reuse the module across invocations).
  cachedApnsJwt = null;
  cachedFcmConfig = undefined;
  cachedFcmAccessToken = null;

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });
  if (req.method !== 'POST') return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: CORS_HEADERS });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // ── auth: two modes ──
  // 1. Client mode (the original): a signed-in user's JWT, and the caller must
  //    be the author of the message being announced.
  // 2. Automation mode: server-side inserts (the founder engine's welcome DMs,
  //    nudges and room prompts) are written straight to Postgres by a trigger,
  //    so no client is awake to dispatch. Those calls present a shared secret
  //    held in Vault and readable only by service_role. Without this path every
  //    automated message arrives silently.
  // Platform-level verify_jwt is off for this function (as with rooms-invite)
  // because the function performs its own verification below.
  const fanoutSecret = (req.headers.get('x-him-fanout-secret') ?? '').trim();
  let isAutomation = false;
  if (fanoutSecret) {
    const { data: expected, error: secretError } = await admin.rpc('push_fanout_secret');
    const expectedSecret = typeof expected === 'string' ? expected.trim() : '';
    if (secretError || !expectedSecret) {
      return Response.json({ error: 'Fanout secret unavailable.' }, { status: 503, headers: CORS_HEADERS });
    }
    if (fanoutSecret !== expectedSecret) {
      return Response.json({ error: 'Unauthorized.' }, { status: 401, headers: CORS_HEADERS });
    }
    isAutomation = true;
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  let user: { id: string } | null = null;
  if (!isAutomation) {
    if (!token) return Response.json({ error: 'Unauthorized.' }, { status: 401, headers: CORS_HEADERS });
    const anonClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user: authedUser } } = await anonClient.auth.getUser(token);
    if (!authedUser) return Response.json({ error: 'Unauthorized.' }, { status: 401, headers: CORS_HEADERS });
    user = { id: authedUser.id };
  }

  let body: { kind?: string; messageId?: number | string; roomMessageId?: string; buddyId?: string; actorId?: string };
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
      .select('token,user_id,platform,push_environment')
      .in('platform', ['ios', 'android'])
      .in('user_id', recipientIds);
    if (isPushEnvironmentSchemaMissingError(resp.error)) {
      const legacy = await admin
        .from('user_push_tokens')
        .select('token,user_id,platform')
        .in('platform', ['ios', 'android'])
        .in('user_id', recipientIds);
      return (legacy.data ?? []) as PushTokenRow[];
    }
    if (resp.error) throw new Error(resp.error.message);
    return (resp.data ?? []) as PushTokenRow[];
  }

  // Until this existed, a dispatch that reached nobody was indistinguishable
  // from one that reached everybody: the function returned 200 either way and
  // nothing recorded what APNs/FCM actually said. Four weeks of automated sends
  // went out to a user base with almost no registered tokens without any signal.
  // `recipients > 0 && tokens = 0` is the row that would have caught it.
  // Failures here are swallowed on purpose — observability must never be able to
  // break delivery.
  async function logDispatch(entry: {
    variant: string;
    kind: string;
    actorId: string | null;
    subjectId: string | null;
    recipients: number;
    result: DispatchResult;
  }) {
    try {
      const { error } = await admin.from('push_dispatch_log').insert({
        variant: entry.variant,
        kind: entry.kind,
        automation: isAutomation,
        actor_id: entry.actorId,
        subject_id: entry.subjectId,
        recipients: entry.recipients,
        tokens: entry.result.tokens,
        attempted: entry.result.attempted,
        delivered: entry.result.delivered,
        pruned: entry.result.pruned,
        failures: entry.result.failures,
      });
      if (error) console.error('push_dispatch_log insert failed:', error.message);
    } catch (e) {
      console.error('push_dispatch_log insert failed:', e);
    }
  }

  async function dispatchToRecipients(input: {
    recipientIds: string[];
    senderName: string;
    previewText: string;
    targetPath: string;
    variant: string;
  }): Promise<DispatchResult> {
    if (!input.recipientIds.length) {
      return { delivered: 0, attempted: 0, tokens: 0, pruned: 0, failures: [] };
    }

    const [tokens, previewModes] = await Promise.all([
      getPushTokens(input.recipientIds),
      getPreviewModes(input.recipientIds),
    ]);

    const tokensByUser = new Map<string, { token: string; platform: PushPlatform; env: ApnsEnvironment | null }[]>();
    for (const row of tokens) {
      const list = tokensByUser.get(row.user_id) ?? [];
      if (!list.some((e) => e.token === row.token)) {
        const platform: PushPlatform = row.platform === 'android' ? 'android' : 'ios';
        list.push({ token: row.token, platform, env: normalizePushEnvironment(row.push_environment) });
        tokensByUser.set(row.user_id, list);
      }
    }

    // Resolve FCM credentials lazily, once, and only if Android tokens are present.
    // A missing or broken FCM config skips Android delivery without failing iOS.
    let fcmCreds: { projectId: string; accessToken: string } | null = null;
    let fcmResolved = false;
    async function ensureFcm(): Promise<{ projectId: string; accessToken: string } | null> {
      if (fcmResolved) return fcmCreds;
      fcmResolved = true;
      try {
        const account = getFcmServiceAccount();
        if (!account) {
          console.warn('FCM not configured (FCM_SERVICE_ACCOUNT_JSON unset); skipping Android push.');
          return (fcmCreds = null);
        }
        const { token, projectId } = await getFcmAccessToken(account);
        return (fcmCreds = { projectId, accessToken: token });
      } catch (e) {
        console.error('FCM auth failed; skipping Android push:', e);
        return (fcmCreds = null);
      }
    }

    let attempted = 0, delivered = 0, pruned = 0;
    const failures: PushDispatchFailure[] = [];
    const tokenCount = tokens.length;
    function recordFailure(f: PushDispatchFailure) {
      if (failures.length >= MAX_LOGGED_FAILURES) return;
      failures.push({ ...f, reason: clampFailureReason(f.reason) });
    }

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
        // Android → FCM HTTP v1.
        if (entry.platform === 'android') {
          const creds = await ensureFcm();
          if (!creds) continue;
          attempted++;
          try {
            const res = await sendFcmNotification(creds.projectId, creds.accessToken, entry.token, {
              title: preview.senderName,
              body: preview.messagePreview,
              data: {
                senderName: preview.senderName,
                messagePreview: preview.messagePreview,
                targetPath: input.targetPath,
                variant: input.variant,
              },
            });
            if (res.status >= 200 && res.status < 300) {
              delivered++;
            } else if (shouldPruneFcmToken(res.status, res.body)) {
              await admin.from('user_push_tokens').delete().eq('token', entry.token);
              pruned++;
              recordFailure({ platform: 'android', env: null, status: res.status, reason: 'pruned: dead token' });
            } else {
              recordFailure({ platform: 'android', env: null, status: res.status, reason: res.body });
              console.error('FCM delivery failed:', res.status, res.body);
            }
          } catch (e) {
            recordFailure({
              platform: 'android',
              env: null,
              status: null,
              reason: e instanceof Error ? e.message : 'network error',
            });
            console.error('FCM delivery failed:', e);
          }
          continue;
        }

        // iOS → APNs.
        attempted++;
        const hosts = resolveApnsHosts(entry.env);
        let deliveredThis = false, sawResponse = false, allPrunable = true;
        let lastStatus: number | null = null;
        let lastReason = '';

        for (const host of hosts) {
          try {
            const res = await sendApnsNotification(host, entry.token, payload);
            sawResponse = true;
            if (res.status >= 200 && res.status < 300) { delivered++; deliveredThis = true; break; }
            lastStatus = res.status;
            lastReason = readApnsFailureReason(res.body) || res.body;
            if (!shouldPruneToken(readApnsFailureReason(res.body))) allPrunable = false;
          } catch (e) {
            allPrunable = false;
            lastReason = e instanceof Error ? e.message : 'network error';
            console.error('APNs delivery failed:', e);
          }
        }

        const willPrune = !deliveredThis && sawResponse && allPrunable;
        if (!deliveredThis) {
          recordFailure({
            platform: 'ios',
            env: entry.env,
            status: lastStatus,
            reason: willPrune ? `pruned: ${lastReason}` : lastReason,
          });
        }

        if (willPrune) {
          await admin.from('user_push_tokens').delete().eq('token', entry.token);
          pruned++;
        }
      }
    }

    return { delivered, attempted, tokens: tokenCount, pruned, failures };
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
      // Client mode may only announce its own message; automation takes the
      // author from the row it was handed.
      if (!isAutomation && m.sender_id !== user!.id) {
        return Response.json({ error: 'Message not found.' }, { status: 404, headers: CORS_HEADERS });
      }
      const senderId = m.sender_id;

      const senderName = await resolveSenderName(senderId);
      const result = await dispatchToRecipients({
        recipientIds: [m.receiver_id],
        senderName,
        previewText: resolvePreviewText(m.content, m.preview_type),
        targetPath: `/hi-its-me?dm=${encodeURIComponent(senderId)}`,
        variant: 'dm',
      });
      await logDispatch({
        variant: 'dm',
        kind: body.kind ?? 'dm',
        actorId: senderId,
        subjectId: messageId,
        recipients: 1,
        result,
      });
      return Response.json({ ok: true, delivered: result.delivered, attempted: result.attempted }, { headers: CORS_HEADERS });
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
      if (!isAutomation && rm.user_id !== user!.id) {
        return Response.json({ error: 'Room message not found.' }, { status: 404, headers: CORS_HEADERS });
      }
      const roomSenderId = rm.user_id;

      const { data: room, error: roomErr } = await admin
        .from('rooms')
        .select('id,name,slug')
        .eq('id', rm.room_id)
        .maybeSingle();
      if (roomErr || !room) return Response.json({ error: 'Room not found.' }, { status: 404, headers: CORS_HEADERS });
      const r = room as { name: string; slug: string };

      const { data: members } = await admin.from('room_memberships').select('user_id').eq('room_id', rm.room_id);
      const recipientIds = Array.from(
        new Set(((members ?? []) as { user_id: string }[]).map((m) => m.user_id).filter((id) => id && id !== roomSenderId)),
      );

      const senderName = await resolveSenderName(roomSenderId);
      const result = await dispatchToRecipients({
        recipientIds,
        senderName,
        previewText: clampPreview(`${r.name}: ${htmlToPlainText(rm.body) || 'New room message'}`),
        targetPath: `/hi-its-me?tab=chat&room=${encodeURIComponent(r.slug)}`,
        variant: 'room',
      });
      await logDispatch({
        variant: 'room',
        kind: 'room',
        actorId: roomSenderId,
        subjectId: roomMessageId,
        recipients: recipientIds.length,
        result,
      });
      return Response.json({ ok: true, delivered: result.delivered, attempted: result.attempted }, { headers: CORS_HEADERS });
    }

    // Buddy push
    if (body.kind === 'buddy_request' || body.kind === 'buddy_accept') {
      const buddyId = typeof body.buddyId === 'string' ? body.buddyId.trim() : '';
      if (!buddyId) return Response.json({ error: 'buddyId is required.' }, { status: 400, headers: CORS_HEADERS });

      // Buddy pushes name the acting user. In client mode that is the caller.
      // In automation mode there is no caller — a buddies row was written
      // straight to Postgres (the founder engine's requests) and the trigger is
      // announcing it — so the actor arrives in the body and is verified against
      // the row it claims to announce. Without that check the fanout secret
      // would be enough to attribute a push to any account.
      let actorId: string;
      if (isAutomation) {
        if (body.kind !== 'buddy_request') {
          return Response.json({ error: 'Only buddy_request may be announced server-side.' }, { status: 400, headers: CORS_HEADERS });
        }
        const claimedActor = typeof body.actorId === 'string' ? body.actorId.trim() : '';
        if (!claimedActor) {
          return Response.json({ error: 'actorId is required for automation.' }, { status: 400, headers: CORS_HEADERS });
        }
        const { data: pair } = await admin
          .from('buddies')
          .select('user_id,buddy_id')
          .eq('user_id', claimedActor)
          .eq('buddy_id', buddyId)
          .maybeSingle();
        if (!pair) return Response.json({ error: 'Buddy request not found.' }, { status: 404, headers: CORS_HEADERS });
        actorId = claimedActor;
      } else {
        actorId = user!.id;
      }

      const senderName = await resolveSenderName(actorId);
      const previewText = body.kind === 'buddy_request' ? 'sent you a buddy request.' : 'accepted your buddy request.';
      const targetPath =
        body.kind === 'buddy_request'
          ? '/hi-its-me?tab=im'
          : `/hi-its-me?tab=im&dm=${encodeURIComponent(actorId)}`;
      const result = await dispatchToRecipients({ recipientIds: [buddyId], senderName, previewText, targetPath, variant: 'buddy' });
      await logDispatch({
        variant: 'buddy',
        kind: body.kind,
        actorId,
        subjectId: buddyId,
        recipients: 1,
        result,
      });
      return Response.json({ ok: true, delivered: result.delivered, attempted: result.attempted }, { headers: CORS_HEADERS });
    }

    return Response.json({ error: 'Unknown kind.' }, { status: 400, headers: CORS_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to dispatch push notification.';
    const status = message.includes('APPLE_PUSH_') ? 503 : 500;
    return Response.json({ error: message }, { status, headers: CORS_HEADERS });
  }
});
