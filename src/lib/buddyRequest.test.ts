import { beforeEach, describe, expect, it, vi } from 'vitest';

// Two chains are exercised here:
//   from('buddies').select(...).or(...).in(...)      relationship lookup
//   from('buddies').upsert(payload, { onConflict })  the accept writes
const state: {
  lookup: { data: unknown; error: unknown };
  upsertError: { message: string } | null;
  upserts: Array<Record<string, unknown>>;
} = { lookup: { data: [], error: null }, upsertError: null, upserts: [] };

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        or: () => ({ in: async () => state.lookup }),
      }),
      upsert: async (payload: Record<string, unknown>) => {
        state.upserts.push(payload);
        return { error: state.upsertError };
      },
    }),
  },
}));

vi.mock('@/lib/pushDispatch', () => ({
  dispatchBuddyAcceptedPush: vi.fn(),
  dispatchBuddyRequestPush: vi.fn(),
}));

vi.mock('@/lib/pushPromptMoments', () => ({
  maybePromptForPushAfterFriendshipAction: vi.fn(),
}));

import { acceptIncomingBuddyRequest, sendOrAcceptBuddyRequest } from '@/lib/buddyRequest';
import { dispatchBuddyAcceptedPush } from '@/lib/pushDispatch';
import { maybePromptForPushAfterFriendshipAction } from '@/lib/pushPromptMoments';

const ME = 'user-me';
const SENDER = 'user-sender';

beforeEach(() => {
  state.lookup = { data: [], error: null };
  state.upsertError = null;
  state.upserts = [];
  vi.mocked(dispatchBuddyAcceptedPush).mockClear();
  vi.mocked(maybePromptForPushAfterFriendshipAction).mockClear();
});

describe('acceptIncomingBuddyRequest', () => {
  it('writes both directions, because buddies is asymmetric', async () => {
    const result = await acceptIncomingBuddyRequest(ME, SENDER);

    expect(result.ok).toBe(true);
    expect(state.upserts).toEqual([
      { user_id: ME, buddy_id: SENDER, status: 'accepted' },
      { user_id: SENDER, buddy_id: ME, status: 'accepted' },
    ]);
  });

  // The regression this function exists to prevent. Accepting used to run
  // through an inline upsert in the page component that never prompted, so the
  // one moment the contextual prompt was built for was the one that skipped it.
  it('fires the contextual push prompt when an accept succeeds', async () => {
    await acceptIncomingBuddyRequest(ME, SENDER);

    expect(maybePromptForPushAfterFriendshipAction).toHaveBeenCalledWith('buddy_accepted');
  });

  it('does not prompt when the write fails', async () => {
    state.upsertError = { message: 'permission denied for table buddies' };

    const result = await acceptIncomingBuddyRequest(ME, SENDER);

    expect(result.ok).toBe(false);
    expect(result.error).toBe('permission denied for table buddies');
    expect(maybePromptForPushAfterFriendshipAction).not.toHaveBeenCalled();
    expect(dispatchBuddyAcceptedPush).not.toHaveBeenCalled();
  });

  it('still prompts when notifyBuddy is false, since that flag is about them', async () => {
    await acceptIncomingBuddyRequest(ME, SENDER, { notifyBuddy: false });

    expect(dispatchBuddyAcceptedPush).not.toHaveBeenCalled();
    expect(maybePromptForPushAfterFriendshipAction).toHaveBeenCalledWith('buddy_accepted');
  });

  it('notifies the buddy by default', async () => {
    await acceptIncomingBuddyRequest(ME, SENDER);

    expect(dispatchBuddyAcceptedPush).toHaveBeenCalledWith(SENDER);
  });
});

describe('sendOrAcceptBuddyRequest', () => {
  it('accepting an incoming pending request routes through the shared accept', async () => {
    state.lookup = {
      data: [{ user_id: SENDER, buddy_id: ME, status: 'pending' }],
      error: null,
    };

    const result = await sendOrAcceptBuddyRequest(ME, SENDER);

    expect(result.status).toBe('accepted_incoming');
    expect(state.upserts).toEqual([
      { user_id: ME, buddy_id: SENDER, status: 'accepted' },
      { user_id: SENDER, buddy_id: ME, status: 'accepted' },
    ]);
    expect(maybePromptForPushAfterFriendshipAction).toHaveBeenCalledWith('buddy_accepted');
  });

  it('sending a fresh request does not prompt — nothing mutual has happened yet', async () => {
    const result = await sendOrAcceptBuddyRequest(ME, SENDER);

    expect(result.status).toBe('sent');
    expect(maybePromptForPushAfterFriendshipAction).not.toHaveBeenCalled();
  });

  it('reports an already-accepted relationship without rewriting it', async () => {
    state.lookup = {
      data: [{ user_id: ME, buddy_id: SENDER, status: 'accepted' }],
      error: null,
    };

    const result = await sendOrAcceptBuddyRequest(ME, SENDER);

    expect(result.status).toBe('already_accepted');
    expect(state.upserts).toEqual([]);
  });
});
