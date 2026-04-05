export type BuddyRelationshipStatus = 'pending' | 'accepted';

export interface BuddyRelationshipRecord {
  user_id: string;
  buddy_id: string;
  status: BuddyRelationshipStatus;
}

interface BuddyRelationshipAccumulator {
  buddyId: string;
  accepted: boolean;
  incomingPending: boolean;
  outgoingPending: boolean;
}

export interface AggregatedBuddyRelationshipRow {
  buddyId: string;
  relationshipStatus: BuddyRelationshipStatus;
}

export interface AggregatedBuddyRelationships {
  rows: AggregatedBuddyRelationshipRow[];
  acceptedBuddyIds: string[];
  incomingPendingBuddyIds: string[];
  outgoingPendingBuddyIds: string[];
}

export function aggregateBuddyRelationships(
  currentUserId: string,
  rows: BuddyRelationshipRecord[] | null | undefined,
): AggregatedBuddyRelationships {
  const byBuddyId = new Map<string, BuddyRelationshipAccumulator>();

  for (const row of rows ?? []) {
    const isOutgoing = row.user_id === currentUserId;
    const isIncoming = row.buddy_id === currentUserId;
    if (!isOutgoing && !isIncoming) {
      continue;
    }

    const buddyId = isOutgoing ? row.buddy_id : row.user_id;
    if (!buddyId || buddyId === currentUserId) {
      continue;
    }

    const existing = byBuddyId.get(buddyId) ?? {
      buddyId,
      accepted: false,
      incomingPending: false,
      outgoingPending: false,
    };

    if (row.status === 'accepted') {
      existing.accepted = true;
    } else if (isOutgoing) {
      existing.outgoingPending = true;
    } else {
      existing.incomingPending = true;
    }

    byBuddyId.set(buddyId, existing);
  }

  const acceptedBuddyIds: string[] = [];
  const incomingPendingBuddyIds: string[] = [];
  const outgoingPendingBuddyIds: string[] = [];
  const relationshipRows: AggregatedBuddyRelationshipRow[] = [];

  for (const relationship of byBuddyId.values()) {
    if (relationship.accepted) {
      acceptedBuddyIds.push(relationship.buddyId);
      relationshipRows.push({
        buddyId: relationship.buddyId,
        relationshipStatus: 'accepted',
      });
      continue;
    }

    if (relationship.incomingPending) {
      incomingPendingBuddyIds.push(relationship.buddyId);
    }

    if (relationship.outgoingPending) {
      outgoingPendingBuddyIds.push(relationship.buddyId);
      relationshipRows.push({
        buddyId: relationship.buddyId,
        relationshipStatus: 'pending',
      });
    }
  }

  return {
    rows: relationshipRows,
    acceptedBuddyIds,
    incomingPendingBuddyIds,
    outgoingPendingBuddyIds,
  };
}
