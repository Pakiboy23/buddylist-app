export const AWAY_MESSAGE_REPLY_LABEL = 'Replying to away message:';

export function normalizeAwayMessageQuote(awayMessage: string): string {
  return awayMessage.trim().replace(/\s+/g, ' ');
}

export function buildAwayMessageReplyDraft(awayMessage: string, existingDraft = ''): string {
  const quote = normalizeAwayMessageQuote(awayMessage);
  if (!quote) {
    return existingDraft;
  }

  const quoteBlock = `${AWAY_MESSAGE_REPLY_LABEL}\n“${quote}”\n\n`;
  if (existingDraft.startsWith(quoteBlock)) {
    return existingDraft;
  }

  return `${quoteBlock}${existingDraft.trimStart()}`;
}
