import { supabase } from '@/lib/supabase';
import { dispatchBuddyAcceptedPush, dispatchBuddyRequestPush } from '@/lib/pushDispatch';

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
    return { status: 'error', feedback: checkError.message, ok: false };
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
    const [outRes, inRes] = await Promise.all([
      supabase.from('buddies').upsert(
        { user_id: currentUserId, buddy_id: buddyId, status: 'accepted' },
        { onConflict: 'user_id,buddy_id' },
      ),
      supabase.from('buddies').upsert(
        { user_id: buddyId, buddy_id: currentUserId, status: 'accepted' },
        { onConflict: 'user_id,buddy_id' },
      ),
    ]);
    const acceptError = outRes.error ?? inRes.error;
    if (acceptError) return { status: 'error', feedback: acceptError.message, ok: false };
    dispatchBuddyAcceptedPush(buddyId);
    return { status: 'accepted_incoming', feedback: 'Buddy request accepted!', ok: true };
  }

  if (outgoing === 'pending') {
    return { status: 'already_sent', feedback: 'Buddy request already sent.', ok: true };
  }

  const { error: insertError } = await supabase.from('buddies').upsert(
    { user_id: currentUserId, buddy_id: buddyId, status: 'pending' },
    { onConflict: 'user_id,buddy_id' },
  );
  if (insertError) return { status: 'error', feedback: insertError.message, ok: false };

  dispatchBuddyRequestPush(buddyId);
  return { status: 'sent', feedback: 'Buddy request sent.', ok: true };
}
