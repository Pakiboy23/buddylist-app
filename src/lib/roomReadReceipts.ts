/**
 * Room "seen" receipts, derived from `room_memberships.last_seen_at`.
 *
 * While a member has a room open, their membership row heartbeats
 * `last_seen_at` every 30 seconds (final write on close). A member whose
 * `last_seen_at` is at or after a message's `created_at` therefore had the
 * room open after the message landed — the closest honest signal to "read"
 * a room offers without new schema. Presence in a room is already visible
 * to co-members via the roster, so this exposes nothing new.
 */

export function countSeenByOthers(
  memberLastSeenById: Record<string, string>,
  senderId: string,
  messageCreatedAt: string,
): number {
  const messageTime = Date.parse(messageCreatedAt);
  if (Number.isNaN(messageTime)) {
    return 0;
  }

  let count = 0;
  for (const [userId, lastSeenAt] of Object.entries(memberLastSeenById)) {
    if (userId === senderId) {
      continue;
    }
    const seenTime = Date.parse(lastSeenAt);
    if (!Number.isNaN(seenTime) && seenTime >= messageTime) {
      count += 1;
    }
  }
  return count;
}

export function formatSeenByLabel(count: number): string | null {
  if (count <= 0) {
    return null;
  }
  return `Seen by ${count}`;
}
