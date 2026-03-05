export type DmStateEventType = 'INSERT' | 'UPDATE' | 'DELETE';

export interface UserDmStateRowLite {
  buddy_id: string | null;
  unread_count: number | null;
}

export function normalizeUnreadCount(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function getBuddyId(value: Partial<UserDmStateRowLite> | null | undefined) {
  return typeof value?.buddy_id === 'string' ? value.buddy_id : '';
}

export function mapRowsToUnreadDirectMessages(rows: UserDmStateRowLite[]) {
  const next: Record<string, number> = {};

  for (const row of rows) {
    const buddyId = getBuddyId(row);
    if (!buddyId) {
      continue;
    }

    const unreadCount = normalizeUnreadCount(row.unread_count);
    if (unreadCount > 0) {
      next[buddyId] = unreadCount;
    }
  }

  return next;
}

export function applyDmStateEvent(
  previous: Record<string, number>,
  eventType: DmStateEventType,
  row: Partial<UserDmStateRowLite> | null | undefined,
) {
  const buddyId = getBuddyId(row);
  if (!buddyId) {
    return previous;
  }

  if (eventType === 'DELETE') {
    if (!(buddyId in previous)) {
      return previous;
    }

    const next = { ...previous };
    delete next[buddyId];
    return next;
  }

  const unreadCount = normalizeUnreadCount(row?.unread_count);
  if (unreadCount <= 0) {
    if (!(buddyId in previous)) {
      return previous;
    }

    const next = { ...previous };
    delete next[buddyId];
    return next;
  }

  if (previous[buddyId] === unreadCount) {
    return previous;
  }

  return {
    ...previous,
    [buddyId]: unreadCount,
  };
}
