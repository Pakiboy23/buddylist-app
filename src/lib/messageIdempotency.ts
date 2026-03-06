import { supabase } from '@/lib/supabase';

type DatabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

export interface DirectMessageRow {
  id: number;
  sender_id: string;
  receiver_id: string;
  content: string;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  client_msg_id?: string | null;
}

export interface RoomMessageRow {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  edited_at?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  client_msg_id?: string | null;
}

export const DIRECT_MESSAGE_SELECT_FIELDS =
  'id,sender_id,receiver_id,content,created_at,edited_at,deleted_at,deleted_by,client_msg_id';
export const ROOM_MESSAGE_SELECT_FIELDS =
  'id,room_id,sender_id,content,created_at,edited_at,deleted_at,deleted_by,client_msg_id';

function isClientMessageConflict(error: DatabaseErrorLike | null | undefined) {
  if (!error) {
    return false;
  }

  const message = typeof error.message === 'string' ? error.message.toLowerCase() : '';
  return error.code === '23505' && message.includes('client_msg_id');
}

export async function sendDirectMessageWithClientMessageId(input: {
  senderId: string;
  receiverId: string;
  content: string;
  clientMessageId: string;
}) {
  const { data, error } = await supabase
    .from('messages')
    .insert({
      sender_id: input.senderId,
      receiver_id: input.receiverId,
      content: input.content,
      client_msg_id: input.clientMessageId,
    })
    .select(DIRECT_MESSAGE_SELECT_FIELDS)
    .single();

  if (!isClientMessageConflict(error)) {
    return {
      data: (data as DirectMessageRow | null) ?? null,
      error,
      reconciled: false,
    };
  }

  const { data: existing, error: lookupError } = await supabase
    .from('messages')
    .select(DIRECT_MESSAGE_SELECT_FIELDS)
    .eq('sender_id', input.senderId)
    .eq('client_msg_id', input.clientMessageId)
    .maybeSingle();

  return {
    data: (existing as DirectMessageRow | null) ?? null,
    error: lookupError ?? (existing ? null : error),
    reconciled: Boolean(existing),
  };
}

export async function sendRoomMessageWithClientMessageId(input: {
  roomId: string;
  senderId: string;
  content: string;
  clientMessageId: string;
}) {
  const { data, error } = await supabase
    .from('room_messages')
    .insert({
      room_id: input.roomId,
      sender_id: input.senderId,
      content: input.content,
      client_msg_id: input.clientMessageId,
    })
    .select(ROOM_MESSAGE_SELECT_FIELDS)
    .single();

  if (!isClientMessageConflict(error)) {
    return {
      data: (data as RoomMessageRow | null) ?? null,
      error,
      reconciled: false,
    };
  }

  const { data: existing, error: lookupError } = await supabase
    .from('room_messages')
    .select(ROOM_MESSAGE_SELECT_FIELDS)
    .eq('sender_id', input.senderId)
    .eq('client_msg_id', input.clientMessageId)
    .maybeSingle();

  return {
    data: (existing as RoomMessageRow | null) ?? null,
    error: lookupError ?? (existing ? null : error),
    reconciled: Boolean(existing),
  };
}
