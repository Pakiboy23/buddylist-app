import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  confirmedAcceptedBuddyIds,
  inviteAcceptedBuddiesToRoom,
  selectInvitableBuddies,
} from '@/lib/roomsInvite';

describe('selectInvitableBuddies', () => {
  const buddies = [
    { id: 'accepted-1', screenname: 'ada' },
    { id: 'accepted-2', screenname: 'bek' },
    { id: 'accepted-3', screenname: 'cam' },
  ];

  it('excludes people who already have a membership, not just who is present', () => {
    expect(
      selectInvitableBuddies({
        buddies,
        memberIds: ['accepted-2'],
      }).map((buddy) => buddy.id),
    ).toEqual(['accepted-1', 'accepted-3']);
  });

  it('excludes blocked accounts even when they are still accepted buddies', () => {
    expect(
      selectInvitableBuddies({
        buddies,
        memberIds: [],
        blockedUserIds: ['accepted-1'],
      }).map((buddy) => buddy.id),
    ).toEqual(['accepted-2', 'accepted-3']);
  });

  it('does not treat an empty membership map as "everyone is already in"', () => {
    expect(
      selectInvitableBuddies({
        buddies,
        memberIds: [],
        membershipReady: true,
      }).map((buddy) => buddy.id),
    ).toEqual(['accepted-1', 'accepted-2', 'accepted-3']);
  });

  it('returns no candidates until the membership map has loaded', () => {
    expect(
      selectInvitableBuddies({
        buddies,
        memberIds: [],
        membershipReady: false,
      }),
    ).toEqual([]);
  });
});

describe('confirmedAcceptedBuddyIds', () => {
  it('accepts either direction of an accepted pair', () => {
    expect(
      confirmedAcceptedBuddyIds({
        callerId: 'me',
        invitedIds: ['them', 'stranger'],
        relationships: [{ user_id: 'them', buddy_id: 'me' }],
      }),
    ).toEqual(['them']);
  });

  it('keeps an accepted row when the mirror is missing', () => {
    expect(
      confirmedAcceptedBuddyIds({
        callerId: 'me',
        invitedIds: ['orphan'],
        relationships: [{ user_id: 'me', buddy_id: 'orphan' }],
      }),
    ).toEqual(['orphan']);
  });
});

describe('inviteAcceptedBuddiesToRoom', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('POSTs roomId and buddyIds to rooms-invite with the user JWT and apikey', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'anon-key');
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, invited: ['buddy-1'] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await inviteAcceptedBuddiesToRoom({
      roomId: 'room-1',
      buddyIds: ['buddy-1'],
      accessToken: 'user-jwt',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ ok: true, invited: ['buddy-1'] });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://example.supabase.co/functions/v1/rooms-invite');
    expect(init.method).toBe('POST');
    expect(init.body).toBe(JSON.stringify({ roomId: 'room-1', buddyIds: ['buddy-1'] }));
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      apikey: 'anon-key',
      Authorization: 'Bearer user-jwt',
    });
  });

  it('surfaces the function error body instead of a generic failure', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ error: 'None of the specified users are your buddies.' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await inviteAcceptedBuddiesToRoom({
      roomId: 'room-1',
      buddyIds: ['stranger'],
      accessToken: 'user-jwt',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({
      ok: false,
      error: 'None of the specified users are your buddies.',
    });
  });
});
