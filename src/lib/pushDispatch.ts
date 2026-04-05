'use client';

import { getAppApiUrl } from '@/lib/appApi';
import { getAccessTokenOrNull } from '@/lib/authClient';

type PushDispatchPayload =
  | { kind: 'dm'; messageId: number }
  | { kind: 'room'; roomMessageId: string };

async function sendPushDispatch(payload: PushDispatchPayload) {
  const accessToken = await getAccessTokenOrNull();
  if (!accessToken) {
    return;
  }

  try {
    const response = await fetch(getAppApiUrl('/api/push/dispatch'), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('Push dispatch request failed:', body || response.statusText);
    }
  } catch (error) {
    console.error('Push dispatch request failed:', error);
  }
}

export function dispatchDirectMessagePush(messageId: number) {
  if (!Number.isFinite(messageId) || messageId <= 0) {
    return;
  }

  void sendPushDispatch({ kind: 'dm', messageId });
}

export function dispatchRoomMessagePush(roomMessageId: string) {
  if (!roomMessageId.trim()) {
    return;
  }

  void sendPushDispatch({ kind: 'room', roomMessageId: roomMessageId.trim() });
}
