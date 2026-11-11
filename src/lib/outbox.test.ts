import { describe, expect, it } from 'vitest';
import { removeValue } from '@/lib/clientStorage';
import {
  applyRemoteOutboxSnapshot,
  createOutboxItem,
  getOutboxStorageKey,
  isOutboxItemDue,
  loadOutbox,
  markOutboxSending,
  markOutboxAttemptFailure,
  normalizeOutboxItems,
  requeueInterruptedOutboxSends,
  saveOutbox,
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

  it('leaves interrupted room sends untouched until dedup support is confirmed', () => {
    const room = { ...interrupted(), type: 'room' as const };
    const dm = interrupted();
    expect(requeueInterruptedOutboxSends([room])[0]).toBe(room);
    const [stillRoom, recoveredDm] = requeueInterruptedOutboxSends([room, dm], false);
    expect(stillRoom).toBe(room);
    expect(recoveredDm.status).toBe('queued');
  });

  it('requeues interrupted room sends with the original key when dedup is supported', () => {
    const room = { ...interrupted(), type: 'room' as const };
    const persisted = normalizeOutboxItems(JSON.parse(JSON.stringify([room])));
    const [recovered] = requeueInterruptedOutboxSends(persisted, true);
    expect(recovered.status).toBe('queued');
    expect(recovered.id).toBe(room.id);
    expect(isOutboxItemDue(recovered)).toBe(true);
  });

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

describe('applyRemoteOutboxSnapshot', () => {
  const queued = (id: string, createdAt = '2026-10-30T00:00:00.000Z') => ({
    ...createOutboxItem({
      type: 'dm' as const,
      targetId: 'buddy-a',
      content: id,
      clientMessageId: id,
    }),
    createdAt,
  });

  it('keeps a local-only row that the other tab has not persisted yet', () => {
    const persisted = queued('from-other-tab');
    const unpersisted = queued('still-in-memory', '2026-10-30T00:00:01.000Z');

    const merged = applyRemoteOutboxSnapshot([unpersisted], [persisted]);

    expect(merged.map((item) => item.id)).toEqual(['from-other-tab', 'still-in-memory']);
  });

  it('does not let a stale persist rewind this tab\'s in-flight send', () => {
    const localSending = markOutboxSending(queued('in-flight'));
    const incomingQueued = queued('in-flight');

    const merged = applyRemoteOutboxSnapshot([localSending], [incomingQueued]);

    expect(merged).toHaveLength(1);
    expect(merged[0]?.status).toBe('sending');
  });

  it('requeues a remote DM left in sending so this tab can finish it', () => {
    const remoteSending = markOutboxSending(queued('other-tab-killed'));

    const merged = applyRemoteOutboxSnapshot([], [remoteSending]);

    expect(merged[0]?.status).toBe('queued');
    expect(merged[0]?.id).toBe('other-tab-killed');
    expect(isOutboxItemDue(merged[0]!)).toBe(true);
  });

  it('leaves a remote room sending row alone until dedup support is confirmed', () => {
    const remoteRoom = {
      ...markOutboxSending(
        createOutboxItem({
          type: 'room',
          targetId: 'room-1',
          content: 'hello room',
          clientMessageId: 'room-sending',
        }),
      ),
    };

    const merged = applyRemoteOutboxSnapshot([], [remoteRoom]);

    expect(merged[0]?.status).toBe('sending');
    expect(merged[0]?.id).toBe('room-sending');
  });
});

describe('saveOutbox', () => {
  it('drops the oldest rows instead of failing the persist when the envelope is over cap', () => {
    const userId = 'user-outbox-cap';
    removeValue(getOutboxStorageKey(userId));

    const items = Array.from({ length: 40 }, (_, index) =>
      createOutboxItem({
        type: 'dm',
        targetId: 'buddy-cap',
        content: 'x'.repeat(4000),
        clientMessageId: `cap-${String(index).padStart(2, '0')}`,
      }),
    );

    expect(saveOutbox(userId, items)).toBe(true);
    const loaded = loadOutbox(userId);
    expect(loaded.length).toBeGreaterThan(0);
    expect(loaded.length).toBeLessThan(items.length);
    expect(loaded[0]?.id).not.toBe('cap-00');
    expect(loaded.at(-1)?.id).toBe('cap-39');

    removeValue(getOutboxStorageKey(userId));
  });
});
