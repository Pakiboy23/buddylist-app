import { describe, expect, it } from 'vitest';
import { buildReactionMutationKey, summarizeReactionRows } from '@/lib/messageReactions';

describe('buildReactionMutationKey', () => {
  it('joins the message id and emoji into a stable mutation key', () => {
    expect(buildReactionMutationKey(42, '❤️')).toBe('42:❤️');
  });
});

describe('summarizeReactionRows', () => {
  it('aggregates counts and reactedByMe state per message and emoji', () => {
    const summary = summarizeReactionRows(
      [
        { message_id: 1, user_id: 'user-1', emoji: '❤️' },
        { message_id: 1, user_id: 'user-2', emoji: '❤️' },
        { message_id: 1, user_id: 'user-3', emoji: '😂' },
      ],
      'user-1',
    );

    expect(summary.get('1')).toEqual([
      { emoji: '❤️', count: 2, reactedByMe: true },
      { emoji: '😂', count: 1, reactedByMe: false },
    ]);
  });

  it('keeps different message ids isolated', () => {
    const summary = summarizeReactionRows(
      [
        { message_id: 'room-1', user_id: 'user-1', emoji: '🔥' },
        { message_id: 'room-2', user_id: 'user-2', emoji: '🔥' },
      ],
      'user-9',
    );

    expect(summary.get('room-1')).toEqual([{ emoji: '🔥', count: 1, reactedByMe: false }]);
    expect(summary.get('room-2')).toEqual([{ emoji: '🔥', count: 1, reactedByMe: false }]);
  });
});
