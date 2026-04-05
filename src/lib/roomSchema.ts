interface SupabaseLikeError {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message?: string | null;
}

function hasRoomKeySchemaError(error: SupabaseLikeError | null | undefined, tableName: string) {
  if (!error) {
    return false;
  }

  const combinedMessage = [error.code, error.message, error.details, error.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!combinedMessage.includes('room_key')) {
    return false;
  }

  return combinedMessage.includes(tableName) || combinedMessage.includes('schema cache') || combinedMessage.includes('does not exist');
}

export function isChatRoomsRoomKeyMissingError(error: SupabaseLikeError | null | undefined) {
  return hasRoomKeySchemaError(error, 'chat_rooms');
}

export function isUserActiveRoomsRoomKeyMissingError(error: SupabaseLikeError | null | undefined) {
  return hasRoomKeySchemaError(error, 'user_active_rooms');
}
