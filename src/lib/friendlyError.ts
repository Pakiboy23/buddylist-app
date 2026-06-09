// Strips machine-readable prefixes that our Postgres `RAISE EXCEPTION` messages
// carry (e.g. "RATE_LIMIT_DM_NONBUDDY: You can only message 15 new people per
// hour…") so users see only the human sentence, never the ALL_CAPS token.
// Guideline 4.0 — raw error tokens leaking into the UI read as broken.
export function humanizeDbError(message: string | null | undefined): string {
  if (!message) return 'Something went wrong. Please try again.';
  const stripped = message.replace(/^[A-Z][A-Z0-9_]{2,}:\s*/, '').trim();
  return stripped || message;
}
