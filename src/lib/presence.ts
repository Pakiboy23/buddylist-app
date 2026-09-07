export type ResolvedPresenceState = 'available' | 'idle' | 'away' | 'offline';

/**
 * Browse (and any last_active-only surface) treats a person as signed on
 * when `last_active_at` is newer than this window.
 *
 * Buddy list still uses realtime presence for `isOnline`. This cutoff exists
 * because Browse cards do not subscribe to that channel — they only have
 * `status` + `last_active_at`. The activity heartbeat writes at most once a
 * minute, so anyone actually around stays well inside 24h. A leftover
 * `status = Available` with a 12-day-old stamp must not read as Available.
 */
export const PRESENCE_LAST_ACTIVE_ONLINE_MS = 24 * 60 * 60 * 1000;

interface PresenceStateInput {
  isOnline: boolean;
  status: string | null | undefined;
  idleSince: string | null | undefined;
}

export interface PresenceSignals {
  isOnline?: boolean;
  status?: string | null | undefined;
  idleSince?: string | null | undefined;
  lastActiveAt?: string | null | undefined;
  now?: number;
}

export interface VisiblePresenceInput extends PresenceSignals {
  showOnlineStatus?: boolean | null | undefined;
  isSelf?: boolean;
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

export function isRecentlyActive(lastActiveAt: string | null | undefined, now = Date.now()): boolean {
  if (!lastActiveAt) {
    return false;
  }

  const timestamp = Date.parse(lastActiveAt);
  if (Number.isNaN(timestamp)) {
    return false;
  }

  const ageMs = now - timestamp;
  return ageMs >= 0 && ageMs < PRESENCE_LAST_ACTIVE_ONLINE_MS;
}

/**
 * Single derivation for every presence chip / filter.
 * Prefer an explicit realtime `isOnline` when the caller has it (buddy list).
 * Otherwise infer signed-on from `last_active_at` (Browse cards).
 */
export function derivePresenceState({
  isOnline,
  status,
  idleSince,
  lastActiveAt,
  now = Date.now(),
}: PresenceSignals): ResolvedPresenceState {
  const signedOn = typeof isOnline === 'boolean' ? isOnline : isRecentlyActive(lastActiveAt, now);
  return resolvePresenceState({
    isOnline: signedOn,
    status,
    idleSince,
  });
}

/** Own profile always sees the truth. Missing/legacy rows default to visible. */
export function canViewerSeeActivity(
  showOnlineStatus: boolean | null | undefined,
  options?: { isSelf?: boolean },
): boolean {
  if (options?.isSelf) {
    return true;
  }
  return showOnlineStatus !== false;
}

export function maskPresenceSignals({
  showOnlineStatus,
  isSelf = false,
  isOnline,
  status,
  idleSince,
  lastActiveAt,
}: VisiblePresenceInput): {
  isOnline: boolean | undefined;
  status: string | null;
  idleSince: string | null;
  lastActiveAt: string | null;
} {
  if (canViewerSeeActivity(showOnlineStatus, { isSelf })) {
    return {
      isOnline,
      status: status ?? null,
      idleSince: idleSince ?? null,
      lastActiveAt: lastActiveAt ?? null,
    };
  }

  return {
    isOnline: false,
    status: null,
    idleSince: null,
    lastActiveAt: null,
  };
}

export function resolveVisiblePresence(input: VisiblePresenceInput): {
  state: ResolvedPresenceState;
  activityVisible: boolean;
  status: string | null;
  idleSince: string | null;
  lastActiveAt: string | null;
} {
  const activityVisible = canViewerSeeActivity(input.showOnlineStatus, { isSelf: input.isSelf });
  const masked = maskPresenceSignals(input);
  return {
    state: derivePresenceState({
      ...masked,
      now: input.now,
    }),
    activityVisible,
    status: masked.status,
    idleSince: masked.idleSince,
    lastActiveAt: masked.lastActiveAt,
  };
}

export function getPresenceLabel(state: ResolvedPresenceState) {
  switch (state) {
    case 'away':
      return 'Away';
    case 'idle':
      return 'Idle';
    case 'offline':
      return 'Offline';
    case 'available':
      return 'Available';
    default: {
      const _exhaustive: never = state;
      throw new Error(`Unhandled presence state: ${String(_exhaustive)}`);
    }
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
