interface SupabaseLikeError {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message?: string | null;
}

export function isPushEnvironmentSchemaMissingError(error: SupabaseLikeError | null | undefined) {
  if (!error) {
    return false;
  }

  const combinedMessage = [error.code, error.message, error.details, error.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!combinedMessage.includes('push_environment')) {
    return false;
  }

  return (
    combinedMessage.includes("column of 'user_push_tokens'") ||
    combinedMessage.includes('schema cache') ||
    combinedMessage.includes('does not exist')
  );
}
