export type ResolvedPresenceState = 'available' | 'idle' | 'away' | 'offline';

interface PresenceStateInput {
  isOnline: boolean;
  status: string | null | undefined;
  idleSince: string | null | undefined;
}

interface PresenceDetailInput {
  state: ResolvedPresenceState;
  awayMessage?: string | null | undefined;
  statusMessage?: string | null | undefined;
  idleSince?: string | null | undefined;
  lastActiveAt?: string | null | undefined;
}

export function isAwayStatus(status: string | null | undefined) {
  return (status ?? '').trim().toLowerCase() === 'away';
}

export function resolvePresenceState({ isOnline, status, idleSince }: PresenceStateInput): ResolvedPresenceState {
  if (!isOnline) {
    return 'offline';
  }

  if (isAwayStatus(status)) {
    return 'away';
  }

  if (typeof idleSince === 'string' && idleSince.trim()) {
    return 'idle';
  }

  return 'available';
}

export function getPresenceLabel(state: ResolvedPresenceState) {
  switch (state) {
    case 'away':
      return 'Away';
    case 'idle':
      return 'Idle';
    case 'offline':
      return 'Offline';
    default:
      return 'Available';
  }
}

export function formatPresenceTime(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatPresenceSince(value: string | null | undefined, prefix = 'Since') {
  const time = formatPresenceTime(value);
  return time ? `${prefix} ${time}` : null;
}

export function getPresenceDetail({
  state,
  awayMessage,
  statusMessage,
  idleSince,
  lastActiveAt,
}: PresenceDetailInput) {
  const trimmedAwayMessage = (awayMessage ?? '').trim();
  const trimmedStatusMessage = (statusMessage ?? '').trim();

  switch (state) {
    case 'away':
      return trimmedAwayMessage || 'Away from keyboard.';
    case 'idle':
      return formatPresenceSince(idleSince, 'Idle since') || 'Idle';
    case 'offline':
      return formatPresenceSince(lastActiveAt, 'Last active') || 'Offline';
    default:
      return trimmedStatusMessage || 'Available';
  }
}

/**
 * The buddy's authored line for list rows — the thing H.I.M. is actually
 * about. Away messages and status lines are expression, not just presence
 * metadata, so a set note stays readable even while its author is offline
 * (which, on a small network, is most of the time anyone looks). Pass only
 * authored text: synthesized fallbacks ("Available", "Offline") must not
 * masquerade as something the buddy wrote.
 */
export function getStatusNote({
  state,
  awayMessage,
  statusMessage,
}: {
  state: ResolvedPresenceState;
  awayMessage?: string | null | undefined;
  statusMessage?: string | null | undefined;
}): string | null {
  const away = (awayMessage ?? '').trim();
  const status = (statusMessage ?? '').trim();

  if (state === 'away') {
    return away || null;
  }

  return status || away || null;
}
