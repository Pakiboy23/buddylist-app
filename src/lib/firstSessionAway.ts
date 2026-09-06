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

function readFlag(key: string): boolean {
  return getRaw(key) === '1';
}

function writeFlag(key: string): boolean {
  if (readFlag(key)) {
    return false;
  }
  return setRaw(key, '1');
}

export function wasFirstSessionAwayNudgeShown(): boolean {
  return readFlag(NUDGE_SHOWN_KEY);
}

/** Returns true the first time this install records the nudge. */
export function markFirstSessionAwayNudgeShown(): boolean {
  return writeFlag(NUDGE_SHOWN_KEY);
}

export function wasFirstSessionAwaySetLogged(): boolean {
  return readFlag(AWAY_SET_LOGGED_KEY);
}

/** Returns true the first time this install records an away-message set. */
export function markFirstSessionAwaySetLogged(): boolean {
  return writeFlag(AWAY_SET_LOGGED_KEY);
}
