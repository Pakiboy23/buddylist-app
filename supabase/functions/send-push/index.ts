import { createClient } from 'npm:@supabase/supabase-js@2';

const ONESIGNAL_APP_ID = 'a3c7e63e-311b-4acd-8b4c-b7fff89f011b';
const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications';

type MessageRecord = {
  sender_id?: string | null;
  receiver_id?: string | null;
  sender_screenname?: string | null;
  room_name?: string | null;
  room_id?: string | null;
  content?: string | null;
};

type DatabaseWebhookPayload = {
  type?: string;
  table?: string;
  schema?: string;
  record?: MessageRecord;
  old_record?: MessageRecord | null;
  new?: MessageRecord;
};

function textOrNull(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRoomKey(input: string) {
  return input.trim().toLowerCase().replace(/^#+/, '');
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

async function resolveSenderScreenname(
  admin: ReturnType<typeof createClient>,
  senderId: string | null,
  senderFromPayload: string | null,
) {
  if (senderFromPayload) {
    return senderFromPayload;
  }

  if (!senderId) {
    return 'New message';
  }

  const { data, error } = await admin
    .from('users')
    .select('screenname')
    .eq('id', senderId)
    .maybeSingle();

  if (error) {
    console.error('Failed to resolve sender screenname:', error.message);
    return 'New message';
  }

  return textOrNull(data?.screenname) ?? 'New message';
}

async function resolveRoomName(
  admin: ReturnType<typeof createClient>,
  roomNameFromPayload: string | null,
  roomId: string | null,
) {
  if (roomNameFromPayload) {
    return roomNameFromPayload;
  }

  if (!roomId) {
    return null;
  }

  const { data, error } = await admin.from('chat_rooms').select('name').eq('id', roomId).maybeSingle();
  if (error) {
    console.error('Failed to resolve room name from room_id:', error.message);
    return null;
  }

  return textOrNull(data?.name);
}

async function resolveRecipientUserIds(
  admin: ReturnType<typeof createClient>,
  record: MessageRecord,
) {
  const senderId = textOrNull(record.sender_id);
  const receiverId = textOrNull(record.receiver_id);
  if (receiverId) {
    return [receiverId];
  }

  const roomName = await resolveRoomName(
    admin,
    textOrNull(record.room_name),
    textOrNull(record.room_id),
  );

  if (!roomName) {
    return [];
  }

  const roomKey = normalizeRoomKey(roomName);
  if (!roomKey) {
    return [];
  }

  let query = admin.from('user_active_rooms').select('user_id').eq('room_key', roomKey);
  if (senderId) {
    query = query.neq('user_id', senderId);
  }

  const { data, error } = await query;
  if (error) {
    console.error('Failed to resolve active room recipients:', error.message);
    return [];
  }

  return unique(
    (data ?? [])
      .map((row) => textOrNull((row as { user_id?: unknown }).user_id))
      .filter((id): id is string => Boolean(id)),
  );
}

async function resolveOneSignalPlayerIds(
  admin: ReturnType<typeof createClient>,
  userIds: string[],
) {
  if (userIds.length === 0) {
    return [];
  }

  const { data, error } = await admin
    .from('users')
    .select('id,onesignal_id')
    .in('id', userIds)
    .not('onesignal_id', 'is', null);

  if (error) {
    console.error('Failed to resolve OneSignal IDs:', error.message);
    return [];
  }

  return unique(
    (data ?? [])
      .map((row) => textOrNull((row as { onesignal_id?: unknown }).onesignal_id))
      .filter((id): id is string => Boolean(id)),
  );
}

async function sendOneSignalPush(
  oneSignalRestApiKey: string,
  playerIds: string[],
  heading: string,
  content: string,
) {
  const response = await fetch(ONESIGNAL_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${oneSignalRestApiKey}`,
    },
    body: JSON.stringify({
      app_id: ONESIGNAL_APP_ID,
      include_player_ids: playerIds,
      headings: { en: heading },
      contents: { en: content },
    }),
  });

  const responseText = await response.text();
  if (!response.ok) {
    throw new Error(`OneSignal ${response.status}: ${responseText}`);
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const oneSignalRestApiKey = Deno.env.get('ONESIGNAL_REST_API_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.' }, 500);
  }

  if (!oneSignalRestApiKey) {
    return jsonResponse({ error: 'Missing ONESIGNAL_REST_API_KEY.' }, 500);
  }

  let payload: DatabaseWebhookPayload;
  try {
    payload = (await request.json()) as DatabaseWebhookPayload;
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload.' }, 400);
  }

  const record = payload.record ?? payload.new;
  if (!record) {
    return jsonResponse({ ok: true, skipped: 'No record in payload.' });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const senderId = textOrNull(record.sender_id);
  const senderScreenname = await resolveSenderScreenname(
    admin,
    senderId,
    textOrNull(record.sender_screenname),
  );
  const messageContent = textOrNull(record.content) ?? 'New message';

  const recipientUserIds = await resolveRecipientUserIds(admin, record);
  if (recipientUserIds.length === 0) {
    return jsonResponse({
      ok: true,
      skipped: 'No push recipients for this message.',
    });
  }

  const oneSignalPlayerIds = await resolveOneSignalPlayerIds(admin, recipientUserIds);
  if (oneSignalPlayerIds.length === 0) {
    return jsonResponse({
      ok: true,
      skipped: 'Recipients have no onesignal_id.',
    });
  }

  try {
    await sendOneSignalPush(oneSignalRestApiKey, oneSignalPlayerIds, senderScreenname, messageContent);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown OneSignal error.';
    console.error('Failed sending OneSignal push:', message);
    return jsonResponse({ error: message }, 502);
  }

  return jsonResponse({
    ok: true,
    recipientCount: oneSignalPlayerIds.length,
  });
});
