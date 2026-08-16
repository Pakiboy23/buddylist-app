import { OBJECTIONABLE_TERMS } from './profanityTerms.generated';

export const MESSAGE_HIDDEN_PLACEHOLDER = '[Message hidden — flagged for review]';

// Pre-compile the regex once. The terms file is auto-generated and already
// normalized to [a-z0-9 ]+ so no escaping is required. Word boundaries match
// the same logic as the postgres trigger (`\m` / `\M` in PCRE-ish syntax).
const COMPILED_REGEX = new RegExp(`\\b(?:${OBJECTIONABLE_TERMS.join('|')})\\b`, 'i');

/**
 * Returns true when the input text contains a term from the profanity
 * blocklist sourced from the `bad-words` package. Matches the behavior of
 * the postgres `message_content_appears_objectionable()` trigger function
 * so client and server agree on what counts as flagged.
 *
 * Strips HTML tags first so rich-text formatting can't disguise content.
 */
export function isObjectionable(input: string | null | undefined): boolean {
  if (!input) return false;
  const stripped = input.replace(/<[^>]+>/g, ' ');
  return COMPILED_REGEX.test(stripped);
}

export interface FlaggedMessageInput {
  flagged_at?: string | null;
}

/**
 * Decide what body to render for a message. The sender always sees their
 * own text — flagging only hides content from recipients. Returns
 * `MESSAGE_HIDDEN_PLACEHOLDER` if the message is flagged and the viewer
 * is not the author; otherwise returns the original body.
 */
export function displayBodyForMessage<T extends FlaggedMessageInput>(
  message: T,
  originalBody: string,
  viewerIsAuthor: boolean,
): string {
  if (!message.flagged_at) return originalBody;
  if (viewerIsAuthor) return originalBody;
  return MESSAGE_HIDDEN_PLACEHOLDER;
}
