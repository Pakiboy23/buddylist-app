import { NextResponse } from 'next/server';
import { assertAdminUser } from '@/lib/passwordRecovery';
import { createSupabaseAdminClient, getRequestUser } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

type AdminChatAction = 'delete_message' | 'clear_room' | 'reset_room';

interface AdminChatRoomRequestBody {
  action?: AdminChatAction;
  roomId?: string;
  messageId?: string;
}

function normalizeRoomKey(input: string) {
  return input.trim().toLowerCase().replace(/^#+/, '');
}

export async function POST(request: Request) {
  const actor = await getRequestUser(request);
  if (!actor) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: AdminChatRoomRequestBody;
  try {
    body = (await request.json()) as AdminChatRoomRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const action = body.action;
  if (!action) {
    return NextResponse.json({ error: 'Action is required.' }, { status: 400 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const isAdmin = await assertAdminUser(admin, actor.id);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    if (action === 'delete_message') {
      const messageId = typeof body.messageId === 'string' ? body.messageId.trim() : '';
      if (!messageId) {
        return NextResponse.json({ error: 'messageId is required.' }, { status: 400 });
      }

      const { error } = await admin.from('room_messages').delete().eq('id', messageId);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, action, messageId });
    }

    const roomId = typeof body.roomId === 'string' ? body.roomId.trim() : '';
    if (!roomId) {
      return NextResponse.json({ error: 'roomId is required.' }, { status: 400 });
    }

    const { data: room, error: roomError } = await admin
      .from('chat_rooms')
      .select('id,name')
      .eq('id', roomId)
      .maybeSingle();

    if (roomError) {
      return NextResponse.json({ error: roomError.message }, { status: 500 });
    }

    if (!room) {
      return NextResponse.json({ error: 'Chat room not found.' }, { status: 404 });
    }

    const { error: clearError } = await admin.from('room_messages').delete().eq('room_id', roomId);
    if (clearError) {
      return NextResponse.json({ error: clearError.message }, { status: 500 });
    }

    if (action === 'reset_room') {
      const roomKey = normalizeRoomKey(room.name ?? '');
      if (roomKey) {
        const { error: resetError } = await admin.from('user_active_rooms').delete().eq('room_key', roomKey);
        if (resetError) {
          return NextResponse.json({ error: resetError.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      action,
      roomId,
      roomName: room.name,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to process admin chat action.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
