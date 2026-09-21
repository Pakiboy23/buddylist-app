import { describe, expect, it } from 'vitest';
import {
  createOutboxItem,
  isFlushableOutboxItem,
  isOutboxItemDue,
  markOutboxSending,
  markOutboxAttemptFailure,
  normalizeOutboxItems,
  requeueInterruptedOutboxSends,
  scheduleOutboxRetryNow,
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
  it('turns leftover sending rows back into queued retries', () => {
    const sending = markOutboxSending(
      createOutboxItem({
        type: 'dm',
        targetId: 'buddy-d',
        content: 'still in flight',
        clientMessageId: 'client-msg-6',
      }),
    );
    const queued = createOutboxItem({
      type: 'room',
      targetId: 'room-3',
      content: 'already queued',
      clientMessageId: 'client-msg-7',
    });
    const failed = markOutboxAttemptFailure(
      createOutboxItem({
        type: 'dm',
        targetId: 'buddy-e',
        content: 'already failed',
        clientMessageId: 'client-msg-8',
      }),
      'offline',
    );

    const recovered = requeueInterruptedOutboxSends([sending, queued, failed]);

    expect(recovered[0]?.status).toBe('queued');
    expect(recovered[0]?.lastError).toBeNull();
    expect(recovered[1]?.status).toBe('queued');
    expect(recovered[2]?.status).toBe('failed');
    expect(recovered[2]?.lastError).toBe('offline');
  });
});

describe('isFlushableOutboxItem', () => {
  it('retries interrupted sending rows once they are due', () => {
    const sending = markOutboxSending(
      createOutboxItem({
        type: 'dm',
        targetId: 'buddy-f',
        content: 'killed mid-send',
        clientMessageId: 'client-msg-9',
      }),
    );

    expect(isFlushableOutboxItem(sending)).toBe(true);
  });

  it('still waits out backoff on failed rows', () => {
    const failed = {
      ...markOutboxAttemptFailure(
        createOutboxItem({
          type: 'room',
          targetId: 'room-4',
          content: 'wait for backoff',
          clientMessageId: 'client-msg-10',
        }),
        'offline',
      ),
      nextAttemptAt: '2099-01-01T00:00:00.000Z',
    };

    expect(isFlushableOutboxItem(failed, Date.parse('2026-09-21T00:00:00.000Z'))).toBe(false);
  });
});
