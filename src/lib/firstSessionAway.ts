import { getRaw, setRaw } from '@/lib/clientStorage';

export const FIRST_SESSION_MS = 24 * 60 * 60 * 1000;
const NUDGE_SHOWN_KEY = 'him.firstSession.awayNudgeShown';
const AWAY_SET_LOGGED_KEY = 'him.firstSession.awaySetLogged';

export function isFirstSession(createdAt: string | null | undefined, now = Date.now()): boolean {
  if (!createdAt) {
    return false;
  }

  const timestamp = Date.parse(createdAt);
  if (Number.isNaN(timestamp)) {
    return false;
  }

  return now - timestamp < FIRST_SESSION_MS;
}

function flagKey(base: string, userId: string | null | undefined): string | null {
  const id = typeof userId === 'string' ? userId.trim() : '';
  if (!id) {
    return null;
  }
  return `${base}:${id}`;
}

function readFlag(key: string | null): boolean {
  if (!key) {
    return false;
  }
  return getRaw(key) === '1';
}

function writeFlag(key: string | null): boolean {
  if (!key || readFlag(key)) {
    return false;
  }
  return setRaw(key, '1');
}

export function wasFirstSessionAwayNudgeShown(userId: string | null | undefined): boolean {
  return readFlag(flagKey(NUDGE_SHOWN_KEY, userId));
}

/** Returns true the first time this account records the nudge on this install. */
export function markFirstSessionAwayNudgeShown(userId: string | null | undefined): boolean {
  return writeFlag(flagKey(NUDGE_SHOWN_KEY, userId));
}

export function wasFirstSessionAwaySetLogged(userId: string | null | undefined): boolean {
  return readFlag(flagKey(AWAY_SET_LOGGED_KEY, userId));
}

/** Returns true the first time this account records an away-message set on this install. */
export function markFirstSessionAwaySetLogged(userId: string | null | undefined): boolean {
  return writeFlag(flagKey(AWAY_SET_LOGGED_KEY, userId));
}
