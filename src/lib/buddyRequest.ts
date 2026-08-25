import { supabase } from '@/lib/supabase';
import { dispatchBuddyAcceptedPush, dispatchBuddyRequestPush } from '@/lib/pushDispatch';
import { maybePromptForPushAfterFriendshipAction } from '@/lib/pushPromptMoments';
import { humanizeDbError } from '@/lib/friendlyError';

interface BuddyRow {
  user_id: string;
  buddy_id: string;
  status: string;
}

export type BuddyRequestStatus =
  | 'sent'
  | 'already_sent'
  | 'already_accepted'
  | 'accepted_incoming'
  | 'error';

export interface BuddyRequestResult {
  status: BuddyRequestStatus;
  feedback: string;
  ok: boolean;
}


export interface AcceptBuddyRequestResult {
  ok: boolean;
  /** Raw Postgrest message; callers humanize for display. */
  error?: string;
}

/**
 * Accept an incoming buddy request.
 *
 * This is the ONLY place the accept writes live. Both Accept buttons reach it —
 * the native buddy-list row via `respondToBuddyRequest`, and the web Requests
 * list — so the contextual push prompt fires wherever a request is accepted.
 *
 * That co-location is the point. The prompt used to live only in
 * `sendOrAcceptBuddyRequest`, which is reached from search and suggestions, so
 * tapping Accept on a pending request — the single moment the contextual prompt
 * exists for — never asked. `pushColdLaunchGuard.test.ts` restricts the prompt
 * to this module and `messageIdempotency.ts`, so the accept path has to route
 * through here rather than prompting from the page component.
 *
 * `buddies` is asymmetric: pending is one directional row (requester -> target),
 * so accepting writes both directions explicitly.
 */
export async function acceptIncomingBuddyRequest(
  currentUserId: string,
  senderId: string,
  options?: { notifyBuddy?: boolean },
): Promise<AcceptBuddyRequestResult> {
  const [outgoing, incoming] = await Promise.all([
    supabase.from('buddies').upsert(
      { user_id: currentUserId, buddy_id: senderId, status: 'accepted' },
      { onConflict: 'user_id,buddy_id' },
    ),
    supabase.from('buddies').upsert(
      { user_id: senderId, buddy_id: currentUserId, status: 'accepted' },
      { onConflict: 'user_id,buddy_id' },
    ),
  ]);

  const error = outgoing.error ?? incoming.error;
  if (error) {
    return { ok: false, error: error.message };
  }

  if (options?.notifyBuddy !== false) {
    dispatchBuddyAcceptedPush(senderId);
  }
  // A mutual buddy is the moment push is obviously worth having. Fires
  // regardless of notifyBuddy: that flag is about notifying them, this is about
  // asking us.
  void maybePromptForPushAfterFriendshipAction('buddy_accepted');
  return { ok: true };
}

export async function sendOrAcceptBuddyRequest(
  currentUserId: string,
  buddyId: string,
): Promise<BuddyRequestResult> {
  const { data, error: checkError } = await supabase
    .from('buddies')
    .select('user_id,buddy_id,status')
    .or(
      `and(user_id.eq.${currentUserId},buddy_id.eq.${buddyId}),and(user_id.eq.${buddyId},buddy_id.eq.${currentUserId})`,
    )
    .in('status', ['accepted', 'pending']);

  if (checkError) {
    return { status: 'error', feedback: humanizeDbError(checkError.message), ok: false };
  }

  let outgoing: string | null = null;
  let incoming: string | null = null;
  for (const row of (data ?? []) as BuddyRow[]) {
    if (row.user_id === currentUserId && row.buddy_id === buddyId) outgoing = row.status;
    if (row.user_id === buddyId && row.buddy_id === currentUserId) incoming = row.status;
  }

  if (outgoing === 'accepted' || incoming === 'accepted') {
    return { status: 'already_accepted', feedback: 'Already in your H.I.M. contacts.', ok: true };
  }

  if (incoming === 'pending') {
    const accept = await acceptIncomingBuddyRequest(currentUserId, buddyId);
    if (!accept.ok) {
      return { status: 'error', feedback: humanizeDbError(accept.error ?? ''), ok: false };
    }
    return { status: 'accepted_incoming', feedback: 'Buddy request accepted!', ok: true };
  }

  if (outgoing === 'pending') {
    return { status: 'already_sent', feedback: 'Buddy request already sent.', ok: true };
  }

  const { error: insertError } = await supabase.from('buddies').upsert(
    { user_id: currentUserId, buddy_id: buddyId, status: 'pending' },
    { onConflict: 'user_id,buddy_id' },
  );
  if (insertError) return { status: 'error', feedback: humanizeDbError(insertError.message), ok: false };

  dispatchBuddyRequestPush(buddyId);
  return { status: 'sent', feedback: 'Buddy request sent.', ok: true };
}
