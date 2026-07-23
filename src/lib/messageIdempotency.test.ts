import { beforeEach, describe, expect, it, vi } from 'vitest';

// Configurable per-test results for the two query chains the room sender uses:
//   insert(...).select(...).single()
//   select(...).eq(...).eq(...).maybeSingle()
const state: {
  insert: { data: unknown; error: unknown };
  lookup: { data: unknown; error: unknown };
  inserts: Array<Record<string, unknown>>;
} = { insert: { data: null, error: null }, lookup: { data: null, error: null }, inserts: [] };

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      insert: (payload: Record<string, unknown>) => {
        state.inserts.push(payload);
        return { select: () => ({ single: async () => state.insert }) };
      },
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => state.lookup }),
        }),
      }),
    }),
  },
}));

vi.mock('@/lib/pushDispatch', () => ({
  dispatchDirectMessagePush: vi.fn(),
  dispatchRoomMessagePush: vi.fn(),
}));

import { sendRoomMessageWithClientMessageId } from '@/lib/messageIdempotency';

const INPUT = { roomId: 'room-1', userId: 'user-1', body: 'hi', clientMessageId: 'cmid-1' };

describe('sendRoomMessageWithClientMessageId', () => {
  beforeEach(() => {
    state.insert = { data: null, error: null };
    state.lookup = { data: null, error: null };
    state.inserts = [];
  });

  it('inserts with the client_msg_id dedup key on the happy path', async () => {
    state.insert = { data: { id: 'm1', room_id: 'room-1', user_id: 'user-1', body: 'hi', created_at: 't' }, error: null };

    const result = await sendRoomMessageWithClientMessageId(INPUT);

    expect(state.inserts[0]).toMatchObject({ client_msg_id: 'cmid-1', room_id: 'room-1', user_id: 'user-1' });
    expect(result.reconciled).toBe(false);
    expect(result.data?.id).toBe('m1');
    expect(result.error).toBeNull();
  });

  it('reconciles to the existing row on a 23505 conflict instead of duplicating', async () => {
    // Lost-ack retry: the row already committed, unique index raises 23505.
    state.insert = { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "room_messages_user_client_msg_id_key"' } };
    state.lookup = { data: { id: 'already', room_id: 'room-1', user_id: 'user-1', body: 'hi', created_at: 't' }, error: null };

    const result = await sendRoomMessageWithClientMessageId(INPUT);

    expect(result.reconciled).toBe(true);
    expect(result.data?.id).toBe('already');
    expect(result.error).toBeNull();
    // Exactly one insert attempt — no duplicate row created.
    expect(state.inserts).toHaveLength(1);
  });

  it('falls back to a plain insert when the client_msg_id column is not applied yet', async () => {
    // First insert fails with 42703 (column missing); code retries without the key.
    let call = 0;
    const { supabase } = await import('@/lib/supabase');
    vi.spyOn(supabase, 'from').mockImplementation(
      () =>
        ({
          insert: (payload: Record<string, unknown>) => {
            call += 1;
            state.inserts.push(payload);
            const res =
              call === 1
                ? { data: null, error: { code: '42703', message: 'column "client_msg_id" of relation "room_messages" does not exist' } }
                : { data: { id: 'legacy', room_id: 'room-1', user_id: 'user-1', body: 'hi', created_at: 't' }, error: null };
            return { select: () => ({ single: async () => res }) };
          },
        }) as unknown as ReturnType<typeof supabase.from>,
    );

    const result = await sendRoomMessageWithClientMessageId(INPUT);

    expect(state.inserts[0]).toHaveProperty('client_msg_id');
    expect(state.inserts[1]).not.toHaveProperty('client_msg_id');
    expect(result.data?.id).toBe('legacy');
    expect(result.error).toBeNull();
  });
});
