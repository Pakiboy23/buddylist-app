import { describe, expect, it } from 'vitest';
import {
  createOutboxItem,
  isOutboxItemDue,
  markOutboxSending,
  markOutboxAttemptFailure,
  normalizeOutboxItems,
  requeueInterruptedOutboxSends,
  scheduleOutboxRetryNow,
  type OutboxItem,
} from '@/lib/outbox';

describe('createOutboxItem', () => {
  it('uses the provided client message id as the stable outbox id', () => {
    const item = createOutboxItem({
      type: 'dm',
      targetId: 'buddy-a',
      content: 'hello there',
      clientMessageId: 'client-msg-1',
    });

    expect(item.id).toBe('client-msg-1');
    expect(item.content).toBe('hello there');
    expect(item.status).toBe('queued');
  });

  it('preserves Knock as a typed offline DM', () => {
    const item = createOutboxItem({
      type: 'dm',
      targetId: 'buddy-a',
      content: '👋 Knock',
      clientMessageId: 'knock-1',
      previewType: 'knock',
    });

    expect(item.previewType).toBe('knock');
  });
});

describe('normalizeOutboxItems', () => {
  it('dedupes items by stable id and keeps the latest payload', () => {
    const normalized = normalizeOutboxItems([
      {
        id: 'client-msg-1',
        type: 'dm',
        targetId: 'buddy-a',
        content: 'first',
        expiresAt: null,
        replyToMessageId: null,
        forwardSourceMessageId: null,
        forwardSourceSenderId: null,
        previewType: 'text',
        createdAt: '2026-03-06T00:00:00.000Z',
        status: 'queued',
        attempts: 0,
        nextAttemptAt: '2026-03-06T00:00:00.000Z',
        lastError: null,
      },
      {
        id: 'client-msg-1',
        type: 'dm',
        targetId: 'buddy-a',
        content: 'second',
        expiresAt: null,
        replyToMessageId: null,
        forwardSourceMessageId: null,
        forwardSourceSenderId: null,
        previewType: 'text',
        createdAt: '2026-03-06T00:00:01.000Z',
        status: 'failed',
        attempts: 1,
        nextAttemptAt: '2026-03-06T00:00:05.000Z',
        lastError: 'temporary',
      },
    ]);

    expect(normalized).toHaveLength(1);
    expect(normalized[0]?.content).toBe('second');
    expect(normalized[0]?.attempts).toBe(1);
  });
});

describe('markOutboxAttemptFailure', () => {
  it('increments attempts and stores the last error', () => {
    const item = createOutboxItem({
      type: 'room',
      targetId: 'room-1',
      content: 'queued room message',
      clientMessageId: 'client-msg-2',
    });

    const failed = markOutboxAttemptFailure(item, 'network timeout');
    expect(failed.attempts).toBe(1);
    expect(failed.lastError).toBe('network timeout');
    expect(failed.status).toBe('failed');
    expect(Date.parse(failed.nextAttemptAt)).toBeGreaterThanOrEqual(Date.parse(item.nextAttemptAt));
  });
});

describe('markOutboxSending', () => {
  it('marks items as in-flight and clears stale errors', () => {
    const item = markOutboxAttemptFailure(
      createOutboxItem({
        type: 'dm',
        targetId: 'buddy-c',
        content: 'resend me',
        clientMessageId: 'client-msg-4',
      }),
      'offline',
    );

    const sending = markOutboxSending(item);
    expect(sending.status).toBe('sending');
    expect(sending.lastError).toBeNull();
  });
});

describe('scheduleOutboxRetryNow', () => {
  it('clears the failure state and makes the item immediately due', () => {
    const item = markOutboxAttemptFailure(
      createOutboxItem({
        type: 'room',
        targetId: 'room-2',
        content: 'retry me now',
        clientMessageId: 'client-msg-5',
      }),
      'offline',
    );

    const scheduled = scheduleOutboxRetryNow(item);
    expect(scheduled.status).toBe('queued');
    expect(scheduled.lastError).toBeNull();
    expect(isOutboxItemDue(scheduled)).toBe(true);
  });
});

describe('isOutboxItemDue', () => {
  it('treats invalid retry timestamps as immediately due', () => {
    expect(
      isOutboxItemDue({
        id: 'client-msg-3',
        type: 'dm',
        targetId: 'buddy-b',
        content: 'ping',
        expiresAt: null,
        replyToMessageId: null,
        forwardSourceMessageId: null,
        forwardSourceSenderId: null,
        previewType: 'text',
        createdAt: '2026-03-06T00:00:00.000Z',
        status: 'queued',
        attempts: 0,
        nextAttemptAt: 'not-a-date',
        lastError: null,
      }),
    ).toBe(true);
  });
});

describe('requeueInterruptedOutboxSends', () => {
  const interrupted = () =>
    markOutboxSending(
      createOutboxItem({
        type: 'dm',
        targetId: 'buddy-killed',
        content: 'sent right before the app was killed',
        clientMessageId: 'client-msg-killed',
      }),
    );

  it('puts a row left in sending back on the queue so flush retries it', () => {
    const [recovered] = requeueInterruptedOutboxSends([interrupted()]);

    expect(recovered?.status).toBe('queued');
    expect(recovered?.lastError).toBeNull();
    expect(isOutboxItemDue(recovered!, Date.now())).toBe(true);
  });

  it('keeps the client message id so a retry of a landed send dedupes', () => {
    const [recovered] = requeueInterruptedOutboxSends([interrupted()]);

    expect(recovered?.id).toBe('client-msg-killed');
    expect(recovered?.content).toBe('sent right before the app was killed');
    expect(recovered?.attempts).toBe(0);
  });

  it('leaves queued and failed rows alone, including failed backoff', () => {
    const queued = createOutboxItem({
      type: 'room',
      targetId: 'room-1',
      content: 'waiting',
      clientMessageId: 'client-msg-queued',
    });
    const failed = {
      ...markOutboxAttemptFailure(
        createOutboxItem({
          type: 'dm',
          targetId: 'buddy-b',
          content: 'offline',
          clientMessageId: 'client-msg-failed',
        }),
        'network down',
      ),
      nextAttemptAt: '2099-01-01T00:00:00.000Z',
    };

    const [stillQueued, stillFailed] = requeueInterruptedOutboxSends([queued, failed]);

    expect(stillQueued).toBe(queued);
    expect(stillFailed).toBe(failed);
    expect(stillFailed?.lastError).toBe('network down');
    expect(isOutboxItemDue(stillFailed!, Date.parse('2026-10-08T00:00:00.000Z'))).toBe(false);
  });

  it('survives the persisted round trip that an app kill goes through', () => {
    const persisted = JSON.parse(JSON.stringify([interrupted()])) as OutboxItem[];
    const [recovered] = requeueInterruptedOutboxSends(normalizeOutboxItems(persisted));

    expect(recovered?.status).toBe('queued');
  });
});
