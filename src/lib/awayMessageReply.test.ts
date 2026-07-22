import { describe, expect, it } from 'vitest';
import {
  AWAY_MESSAGE_REPLY_LABEL,
  buildAwayMessageReplyDraft,
  normalizeAwayMessageQuote,
} from '@/lib/awayMessageReply';

describe('away message replies', () => {
  it('normalizes whitespace before quoting an away message', () => {
    expect(normalizeAwayMessageQuote('  grabbing  coffee\nback soon  ')).toBe('grabbing coffee back soon');
  });

  it('turns an away message into a quoted DM draft', () => {
    expect(buildAwayMessageReplyDraft('grabbing coffee', 'Want company?')).toBe(
      `${AWAY_MESSAGE_REPLY_LABEL}\n“grabbing coffee”\n\nWant company?`,
    );
  });

  it('does not duplicate the same quote block', () => {
    const draft = buildAwayMessageReplyDraft('grabbing coffee', 'Want company?');
    expect(buildAwayMessageReplyDraft('grabbing coffee', draft)).toBe(draft);
  });

  it('leaves an existing draft alone when the away message is blank', () => {
    expect(buildAwayMessageReplyDraft('   ', 'Still here')).toBe('Still here');
  });
});
