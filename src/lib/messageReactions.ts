export const REACTION_PICKER_EMOJIS = ['❤️', '👍', '😂', '🔥', '👀', '✨'] as const;

export interface ReactionRow<MessageId extends string | number = string | number> {
  message_id: MessageId;
  user_id: string;
  emoji: string;
}

export interface ReactionSummaryEntry {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export function buildReactionMutationKey(messageId: string | number, emoji: string) {
  return `${messageId}:${emoji}`;
}

export function summarizeReactionRows<MessageId extends string | number>(
  rows: ReactionRow<MessageId>[],
  currentUserId: string,
) {
  const byMessageId = new Map<string, Map<string, ReactionSummaryEntry>>();

  for (const row of rows) {
    const messageId = String(row.message_id);
    if (!byMessageId.has(messageId)) {
      byMessageId.set(messageId, new Map());
    }

    const byEmoji = byMessageId.get(messageId);
    if (!byEmoji) {
      continue;
    }

    const existing = byEmoji.get(row.emoji) ?? {
      emoji: row.emoji,
      count: 0,
      reactedByMe: false,
    };

    existing.count += 1;
    if (row.user_id === currentUserId) {
      existing.reactedByMe = true;
    }

    byEmoji.set(row.emoji, existing);
  }

  return new Map(
    Array.from(byMessageId.entries()).map(([messageId, byEmoji]) => [
      messageId,
      Array.from(byEmoji.values()).sort((left, right) => {
        if (right.count !== left.count) {
          return right.count - left.count;
        }
        if (left.reactedByMe !== right.reactedByMe) {
          return Number(right.reactedByMe) - Number(left.reactedByMe);
        }
        return left.emoji.localeCompare(right.emoji);
      }),
    ]),
  );
}
