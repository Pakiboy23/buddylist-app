import { getEdgeFunctionUrl } from '@/lib/appApi';

export function selectInvitableBuddies<T extends { id: string }>(input: {
  buddies: T[];
  memberIds: Iterable<string>;
  blockedUserIds?: Iterable<string>;
  /** False until the full membership map has loaded. An empty map is otherwise
   * indistinguishable from "nobody has joined yet," which would list every
   * buddy as invitable and turn a duplicate invite into a fake success. */
  membershipReady?: boolean;
}): T[] {
  if (input.membershipReady === false) {
    return [];
  }
  const excluded = new Set<string>([
    ...input.memberIds,
    ...(input.blockedUserIds ?? []),
  ]);
  return input.buddies.filter((buddy) => !excluded.has(buddy.id));
}

/**
 * Mirror of rooms-invite: an accepted row in either direction counts.
 * `buddies` is asymmetric; some accepted mirrors are missing.
 */
export function confirmedAcceptedBuddyIds(input: {
  callerId: string;
  invitedIds: string[];
  relationships: Array<{ user_id: string; buddy_id: string }>;
}): string[] {
  const confirmed = new Set(
    input.relationships.map((row) =>
      row.user_id === input.callerId ? row.buddy_id : row.user_id,
    ),
  );
  return input.invitedIds.filter((id) => confirmed.has(id));
}

export type RoomsInviteResult =
  | { ok: true; invited: string[] }
  | { ok: false; error: string };

export async function inviteAcceptedBuddiesToRoom(input: {
  roomId: string;
  buddyIds: string[];
  accessToken: string | null;
  fetchImpl?: typeof fetch;
}): Promise<RoomsInviteResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const anonKey = ((import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '').trim();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (anonKey) {
    headers.apikey = anonKey;
  }
  if (input.accessToken) {
    headers.Authorization = `Bearer ${input.accessToken}`;
  }

  let response: Response;
  try {
    response = await fetchImpl(getEdgeFunctionUrl('rooms-invite'), {
      method: 'POST',
      headers,
      body: JSON.stringify({ roomId: input.roomId, buddyIds: input.buddyIds }),
    });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Invite failed.',
    };
  }

  let result: { invited?: string[]; error?: string } = {};
  try {
    result = (await response.json()) as { invited?: string[]; error?: string };
  } catch {
    return { ok: false, error: 'Invite failed.' };
  }

  if (!response.ok || result.error) {
    return { ok: false, error: result.error ?? 'Invite failed.' };
  }

  return { ok: true, invited: result.invited ?? [] };
}
