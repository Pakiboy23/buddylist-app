import * as http2 from 'http2';
import { importPKCS8, SignJWT } from 'jose';
import {
  applyNotificationPreview,
  DEFAULT_USER_PRIVACY_SETTINGS,
  normalizeUserPrivacySettings,
  type NotificationPreviewMode,
} from '@/lib/privateChat';
import { normalizeApplePushPrivateKey } from '@/lib/apnsKey';
import { createCorsPreflightResponse, jsonWithCors } from '@/lib/apiCors';
import { isPushEnvironmentSchemaMissingError } from '@/lib/pushEnvironmentSchema';
import { htmlToPlainText } from '@/lib/richText';
import { normalizeRoomKey } from '@/lib/roomName';
import { createSupabaseAdminClient, getRequestUser } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
const PUSH_DISPATCH_METHODS = ['POST'];

interface DispatchBody {
  kind?: 'dm' | 'room' | 'buddy_request' | 'buddy_accept';
  messageId?: number | string;
  roomMessageId?: string;
  buddyId?: string;
}

interface PushTokenRow {
  token: string;
  user_id: string;
  push_environment?: 'sandbox' | 'production' | null;
}

interface PrivacySettingsRow {
  user_id: string;
  notification_preview_mode?: NotificationPreviewMode | null;
}

interface UserRow {
  id: string;
  screenname: string | null;
}

interface DirectMessageRow {
  id: number;
  sender_id: string;
  receiver_id: string;
  content: string;
  preview_type?: string | null;
}

interface RoomMessageRow {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
}

interface ChatRoomRow {
  id: string;
  name: string;
  room_key?: string | null;
}

type ApnsEnvironment = 'sandbox' | 'production';

const APNS_PRODUCTION_HOST = 'https://api.push.apple.com';
const APNS_SANDBOX_HOST = 'https://api.sandbox.push.apple.com';
const PUSH_SOUND = 'default';
const MAX_PREVIEW_LENGTH = 140;

let cachedJwt: { token: string; expiresAtMs: number } | null = null;

function requirePushEnv(name: string) {
  const value = process.env[name];
  if (!value?.trim()) {
    throw new Error(`${name} is required for remote push delivery.`);
  }
  return value.trim();
}

function getApnsConfig() {
  return {
    keyId: requirePushEnv('APPLE_PUSH_KEY_ID'),
    teamId: requirePushEnv('APPLE_PUSH_TEAM_ID'),
    privateKey: normalizeApplePushPrivateKey(requirePushEnv('APPLE_PUSH_PRIVATE_KEY')),
    topic: (process.env.APPLE_PUSH_TOPIC ?? process.env.NEXT_PUBLIC_IOS_BUNDLE_ID ?? 'com.hiitsme.app').trim(),
  };
}

async function getApnsJwt() {
  if (cachedJwt && cachedJwt.expiresAtMs > Date.now() + 60_000) {
    return cachedJwt.token;
  }

  const config = getApnsConfig();
  const privateKey = await importPKCS8(config.privateKey, 'ES256');
  const token = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: config.keyId })
    .setIssuer(config.teamId)
    .setIssuedAt()
    .sign(privateKey);
  cachedJwt = {
    token,
    expiresAtMs: Date.now() + 50 * 60 * 1000,
  };
  return token;
}

function clampPreview(content: string) {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return 'New message';
  }

  if (normalized.length <= MAX_PREVIEW_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, MAX_PREVIEW_LENGTH - 1).trimEnd()}…`;
}

function resolvePreviewText(content: string, previewType?: string | null) {
  if (previewType === 'buzz') {
    return '⚡ Buzz!';
  }

  if (previewType === 'voice_note') {
    return 'Sent a voice note.';
  }

  if (previewType === 'attachment') {
    return 'Sent an attachment.';
  }

  return clampPreview(htmlToPlainText(content));
}

function buildApnsPayload(input: {
  senderName: string;
  messagePreview: string;
  targetPath: string;
  variant: 'dm' | 'room' | 'buddy';
}) {
  return {
    aps: {
      alert: {
        title: input.senderName,
        body: input.messagePreview,
      },
      sound: PUSH_SOUND,
    },
    senderName: input.senderName,
    messagePreview: input.messagePreview,
    targetPath: input.targetPath,
    variant: input.variant,
  };
}

async function sendApnsNotificationViaHost(
  host: string,
  deviceToken: string,
  payload: ReturnType<typeof buildApnsPayload>,
) {
  const jwt = await getApnsJwt();
  const { topic } = getApnsConfig();

  return await new Promise<{ status: number; body: string }>((resolve, reject) => {
    const client = http2.connect(host);
    client.on('error', (error) => {
      client.close();
      reject(error);
    });

    const request = client.request({
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      authorization: `bearer ${jwt}`,
      'apns-topic': topic,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    });

    let responseBody = '';
    let status = 0;

    request.setEncoding('utf8');
    request.on('response', (headers) => {
      const statusHeader = headers[':status'];
      status = typeof statusHeader === 'number' ? statusHeader : Number(statusHeader ?? 0);
    });
    request.on('data', (chunk) => {
      responseBody += chunk;
    });
    request.on('end', () => {
      client.close();
      resolve({ status, body: responseBody });
    });
    request.on('error', (error) => {
      client.close();
      reject(error);
    });

    request.end(JSON.stringify(payload));
  });
}

async function pruneInvalidToken(admin: ReturnType<typeof createSupabaseAdminClient>, token: string) {
  await admin.from('user_push_tokens').delete().eq('token', token);
}

function readApnsFailureReason(body: string) {
  if (!body.trim()) {
    return '';
  }

  try {
    const parsed = JSON.parse(body) as { reason?: string };
    return typeof parsed.reason === 'string' ? parsed.reason : '';
  } catch {
    return '';
  }
}

function normalizePushEnvironment(value?: string | null): ApnsEnvironment | null {
  if (value === 'sandbox' || value === 'production') {
    return value;
  }
  return null;
}

function resolveApnsHosts(pushEnvironment: ApnsEnvironment | null) {
  if (pushEnvironment === 'sandbox') {
    return [APNS_SANDBOX_HOST];
  }

  if (pushEnvironment === 'production') {
    return [APNS_PRODUCTION_HOST];
  }

  return [APNS_PRODUCTION_HOST, APNS_SANDBOX_HOST];
}

function shouldPruneTokenForReason(reason: string) {
  return ['BadDeviceToken', 'Unregistered', 'DeviceTokenNotForTopic'].includes(reason);
}

async function dispatchToRecipients(input: {
  recipientIds: string[];
  senderName: string;
  previewText: string;
  targetPath: string;
  variant: 'dm' | 'room' | 'buddy';
}) {
  if (input.recipientIds.length === 0) {
    return { delivered: 0, attempted: 0 };
  }

  const admin = createSupabaseAdminClient();
  const privacyPromise = admin
    .from('user_privacy_settings')
    .select('user_id,notification_preview_mode')
    .in('user_id', input.recipientIds);

  const initialTokenResponse = await admin
    .from('user_push_tokens')
    .select('token,user_id,push_environment')
    .eq('platform', 'ios')
    .in('user_id', input.recipientIds);

  let tokenRows = initialTokenResponse.data as PushTokenRow[] | null;
  let tokenError = initialTokenResponse.error;

  if (isPushEnvironmentSchemaMissingError(tokenError)) {
    const legacyTokenResponse = await admin
      .from('user_push_tokens')
      .select('token,user_id')
      .eq('platform', 'ios')
      .in('user_id', input.recipientIds);

    tokenRows = legacyTokenResponse.data as PushTokenRow[] | null;
    tokenError = legacyTokenResponse.error;
  }

  const privacyResponse = await privacyPromise;

  if (tokenError) {
    throw new Error(tokenError.message);
  }

  if (privacyResponse.error) {
    throw new Error(privacyResponse.error.message);
  }

  const privacyByUserId = new Map(
    ((privacyResponse.data ?? []) as PrivacySettingsRow[]).map((row) => [
      row.user_id,
      normalizeUserPrivacySettings({
        ...DEFAULT_USER_PRIVACY_SETTINGS,
        notificationPreviewMode: row.notification_preview_mode ?? DEFAULT_USER_PRIVACY_SETTINGS.notificationPreviewMode,
      }),
    ]),
  );

  const tokensByUserId = new Map<string, Array<{ token: string; pushEnvironment: ApnsEnvironment | null }>>();
  for (const row of tokenRows ?? []) {
    const existing = tokensByUserId.get(row.user_id) ?? [];
    if (!existing.some((entry) => entry.token === row.token)) {
      existing.push({
        token: row.token,
        pushEnvironment: normalizePushEnvironment(row.push_environment),
      });
      tokensByUserId.set(row.user_id, existing);
    }
  }

  let attempted = 0;
  let delivered = 0;

  for (const recipientId of input.recipientIds) {
    const tokens = tokensByUserId.get(recipientId) ?? [];
    if (tokens.length === 0) {
      continue;
    }

    const preview = applyNotificationPreview(
      {
        senderName: input.senderName,
        messagePreview: input.previewText,
      },
      privacyByUserId.get(recipientId) ?? DEFAULT_USER_PRIVACY_SETTINGS,
    );

    const payload = buildApnsPayload({
      senderName: preview.senderName,
      messagePreview: preview.messagePreview,
      targetPath: input.targetPath,
      variant: input.variant,
    });

    for (const tokenEntry of tokens) {
      attempted += 1;
      const hosts = resolveApnsHosts(tokenEntry.pushEnvironment);
      let deliveredForToken = false;
      let allResponsesPrunable = true;
      let sawResponse = false;

      for (const host of hosts) {
        try {
          const response = await sendApnsNotificationViaHost(host, tokenEntry.token, payload);
          sawResponse = true;

          if (response.status >= 200 && response.status < 300) {
            delivered += 1;
            deliveredForToken = true;
            break;
          }

          const reason = readApnsFailureReason(response.body);
          if (!shouldPruneTokenForReason(reason)) {
            allResponsesPrunable = false;
          }
        } catch (error) {
          allResponsesPrunable = false;
          console.error('APNs delivery failed:', error);
        }
      }

      if (!deliveredForToken && sawResponse && allResponsesPrunable) {
        await pruneInvalidToken(admin, tokenEntry.token);
      }
    }
  }

  return {
    delivered,
    attempted,
  };
}

async function resolveSenderName(admin: ReturnType<typeof createSupabaseAdminClient>, senderId: string) {
  const { data, error } = await admin.from('users').select('id,screenname').eq('id', senderId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }

  const sender = data as UserRow | null;
  return sender?.screenname?.trim() || 'H.I.M.';
}

async function dispatchDirectMessagePush(admin: ReturnType<typeof createSupabaseAdminClient>, actorUserId: string, messageId: number) {
  const { data, error } = await admin
    .from('messages')
    .select('id,sender_id,receiver_id,content,preview_type')
    .eq('id', messageId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const message = data as DirectMessageRow | null;
  if (!message || message.sender_id !== actorUserId) {
    throw new Error('Message not found.');
  }

  const senderName = await resolveSenderName(admin, actorUserId);
  return await dispatchToRecipients({
    recipientIds: [message.receiver_id],
    senderName,
    previewText: resolvePreviewText(message.content, message.preview_type),
    targetPath: `/hi-its-me?dm=${encodeURIComponent(actorUserId)}`,
    variant: 'dm',
  });
}

async function dispatchRoomMessagePush(admin: ReturnType<typeof createSupabaseAdminClient>, actorUserId: string, roomMessageId: string) {
  const { data: messageData, error: messageError } = await admin
    .from('room_messages')
    .select('id,room_id,sender_id,content')
    .eq('id', roomMessageId)
    .maybeSingle();

  if (messageError) {
    throw new Error(messageError.message);
  }

  const message = messageData as RoomMessageRow | null;
  if (!message || message.sender_id !== actorUserId) {
    throw new Error('Room message not found.');
  }

  const { data: roomData, error: roomError } = await admin
    .from('chat_rooms')
    .select('id,name,room_key')
    .eq('id', message.room_id)
    .maybeSingle();

  if (roomError) {
    throw new Error(roomError.message);
  }

  const room = roomData as ChatRoomRow | null;
  if (!room) {
    throw new Error('Room not found.');
  }

  const roomKey = normalizeRoomKey(room.room_key ?? room.name);
  const { data: participantData, error: participantError } = await admin
    .from('room_participants')
    .select('user_id')
    .eq('room_key', roomKey);

  if (participantError) {
    throw new Error(participantError.message);
  }

  const recipientIds = Array.from(
    new Set(
      (participantData ?? [])
        .map((row) => (typeof row.user_id === 'string' ? row.user_id : ''))
        .filter((userId) => userId && userId !== actorUserId),
    ),
  );

  const senderName = await resolveSenderName(admin, actorUserId);
  return await dispatchToRecipients({
    recipientIds,
    senderName,
    previewText: clampPreview(`${room.name}: ${htmlToPlainText(message.content) || 'New room message'}`),
    targetPath: `/hi-its-me?room=${encodeURIComponent(room.name)}`,
    variant: 'room',
  });
}

async function dispatchBuddyRelationshipPush(input: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  actorUserId: string;
  buddyId: string;
  kind: 'buddy_request' | 'buddy_accept';
}) {
  const senderName = await resolveSenderName(input.admin, input.actorUserId);
  const previewText =
    input.kind === 'buddy_request' ? 'sent you a buddy request.' : 'accepted your buddy request.';
  const targetPath =
    input.kind === 'buddy_request'
      ? '/hi-its-me?tab=im'
      : `/hi-its-me?tab=im&dm=${encodeURIComponent(input.actorUserId)}`;

  return await dispatchToRecipients({
    recipientIds: [input.buddyId],
    senderName,
    previewText,
    targetPath,
    variant: 'buddy',
  });
}

export async function POST(request: Request) {
  const user = await getRequestUser(request);
  if (!user) {
    return jsonWithCors(request, { error: 'Unauthorized.' }, { status: 401 }, PUSH_DISPATCH_METHODS);
  }

  let body: DispatchBody;
  try {
    body = (await request.json()) as DispatchBody;
  } catch {
    return jsonWithCors(request, { error: 'Invalid request body.' }, { status: 400 }, PUSH_DISPATCH_METHODS);
  }

  try {
    const admin = createSupabaseAdminClient();

    if (body.kind === 'room') {
      const roomMessageId = typeof body.roomMessageId === 'string' ? body.roomMessageId.trim() : '';
      if (!roomMessageId) {
        return jsonWithCors(
          request,
          { error: 'roomMessageId is required.' },
          { status: 400 },
          PUSH_DISPATCH_METHODS,
        );
      }

      const result = await dispatchRoomMessagePush(admin, user.id, roomMessageId);
      return jsonWithCors(request, { ok: true, ...result }, undefined, PUSH_DISPATCH_METHODS);
    }

    if (body.kind === 'buddy_request' || body.kind === 'buddy_accept') {
      const buddyId = typeof body.buddyId === 'string' ? body.buddyId.trim() : '';
      if (!buddyId) {
        return jsonWithCors(request, { error: 'buddyId is required.' }, { status: 400 }, PUSH_DISPATCH_METHODS);
      }

      const result = await dispatchBuddyRelationshipPush({
        admin,
        actorUserId: user.id,
        buddyId,
        kind: body.kind,
      });
      return jsonWithCors(request, { ok: true, ...result }, undefined, PUSH_DISPATCH_METHODS);
    }

    const messageId = typeof body.messageId === 'number' ? body.messageId : Number(body.messageId);
    if (!Number.isFinite(messageId) || messageId <= 0) {
      return jsonWithCors(request, { error: 'messageId is required.' }, { status: 400 }, PUSH_DISPATCH_METHODS);
    }

    const result = await dispatchDirectMessagePush(admin, user.id, messageId);
    return jsonWithCors(request, { ok: true, ...result }, undefined, PUSH_DISPATCH_METHODS);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to dispatch push notification.';
    const status = message.includes('APPLE_PUSH_') ? 503 : 500;
    return jsonWithCors(request, { error: message }, { status }, PUSH_DISPATCH_METHODS);
  }
}

export function OPTIONS(request: Request) {
  return createCorsPreflightResponse(request, PUSH_DISPATCH_METHODS);
}
