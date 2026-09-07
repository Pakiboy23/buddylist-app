import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  confirmedAcceptedBuddyIds,
  formatInviteClientError,
  inviteAcceptedBuddiesToRoom,
  selectInvitableBuddies,
} from '@/lib/roomsInvite';

const ROOMS_INVITE_FUNCTION = path.resolve(
  __dirname,
  '..',
  '..',
  'supabase',
  'functions',
  'rooms-invite',
  'index.ts',
);
const GROUP_CHAT_WINDOW = path.resolve(__dirname, '..', 'components', 'GroupChatWindow.tsx');

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

  it('maps WebKit CORS transport errors instead of showing "Load failed"', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('Load failed');
    });

    const result = await inviteAcceptedBuddiesToRoom({
      roomId: 'room-1',
      buddyIds: ['buddy-1'],
      accessToken: 'user-jwt',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({
      ok: false,
      error: 'Could not reach the invite service. Try again in a moment.',
    });
  });
});

describe('formatInviteClientError', () => {
  it('rewrites WebKit and Chromium fetch failures', () => {
    expect(formatInviteClientError(new TypeError('Load failed'))).toBe(
      'Could not reach the invite service. Try again in a moment.',
    );
    expect(formatInviteClientError(new TypeError('Failed to fetch'))).toBe(
      'Could not reach the invite service. Try again in a moment.',
    );
  });

  it('keeps a real function error message', () => {
    expect(formatInviteClientError(new Error('You are not a member of this room.'))).toBe(
      'You are not a member of this room.',
    );
  });
});

describe('rooms-invite edge function contract', () => {
  const source = readFileSync(ROOMS_INVITE_FUNCTION, 'utf-8');
  const inviteSheet = readFileSync(GROUP_CHAT_WINDOW, 'utf-8');

  it('allows the apikey header the web client sends on CORS preflight', () => {
    expect(source).toMatch(
      /Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'/,
    );
  });

  it('verifies accepted buddies with .in() lookups instead of a nested .or() filter', () => {
    expect(source).toMatch(/\.in\('buddy_id', invitedIds\)/);
    expect(source).toMatch(/\.in\('user_id', invitedIds\)/);
    expect(source).not.toMatch(/invitedIds\s*\.map\(\(id\) => `and\(/);
  });

  it('still requires an accepted buddy row and caller membership', () => {
    expect(source).toMatch(/\.eq\('status', 'accepted'\)/);
    expect(source).toMatch(/None of the specified users are your buddies/);
    expect(source).toMatch(/You are not a member of this room/);
  });

  it('does not treat a failed roster query as ready for invites', () => {
    expect(inviteSheet).toMatch(/membershipReady: isRosterMembershipReady/);
    expect(inviteSheet).toMatch(/Failed to load room memberships:/);
    expect(inviteSheet).toMatch(/setRosterMembershipError\(error\.message\)/);
    expect(inviteSheet).toMatch(/setIsRosterMembershipReady\(true\)/);
    expect(inviteSheet).not.toMatch(/membershipReady: !isRosterInitialLoading/);
  });

  it('loads the session token with a static import so Safari cannot show Load failed from a missing chunk', () => {
    expect(inviteSheet).toMatch(/import \{ getAccessTokenOrNull \} from '@\/lib\/authClient'/);
    expect(inviteSheet).not.toMatch(/await import\('@\/lib\/authClient'\)/);
  });
});
