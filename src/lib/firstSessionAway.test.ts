import { beforeEach, describe, expect, it } from 'vitest';
import { removeValue } from '@/lib/clientStorage';
import {
  FIRST_SESSION_MS,
  isFirstSession,
  markFirstSessionAwayNudgeShown,
  markFirstSessionAwaySetLogged,
  wasFirstSessionAwayNudgeShown,
  wasFirstSessionAwaySetLogged,
} from '@/lib/firstSessionAway';

describe('isFirstSession', () => {
  const now = Date.parse('2026-09-06T20:00:00.000Z');

  it('is true only within the first day of the account', () => {
    expect(isFirstSession(new Date(now - 60_000).toISOString(), now)).toBe(true);
    expect(isFirstSession(new Date(now - FIRST_SESSION_MS + 1).toISOString(), now)).toBe(true);
    expect(isFirstSession(new Date(now - FIRST_SESSION_MS).toISOString(), now)).toBe(false);
  });

  it('rejects missing or invalid created-at', () => {
    expect(isFirstSession(null, now)).toBe(false);
    expect(isFirstSession('soon', now)).toBe(false);
  });
});

describe('first-session away flags', () => {
  const userA = 'user-a';
  const userB = 'user-b';

  beforeEach(() => {
    removeValue(`him.firstSession.awayNudgeShown:${userA}`);
    removeValue(`him.firstSession.awayNudgeShown:${userB}`);
    removeValue(`him.firstSession.awaySetLogged:${userA}`);
    removeValue(`him.firstSession.awaySetLogged:${userB}`);
  });

  it('records the nudge and the conversion once per account', () => {
    expect(wasFirstSessionAwayNudgeShown(userA)).toBe(false);
    expect(markFirstSessionAwayNudgeShown(userA)).toBe(true);
    expect(markFirstSessionAwayNudgeShown(userA)).toBe(false);
    expect(wasFirstSessionAwayNudgeShown(userA)).toBe(true);

    expect(wasFirstSessionAwaySetLogged(userA)).toBe(false);
    expect(markFirstSessionAwaySetLogged(userA)).toBe(true);
    expect(markFirstSessionAwaySetLogged(userA)).toBe(false);
    expect(wasFirstSessionAwaySetLogged(userA)).toBe(true);
  });

  it('keeps first-session flags isolated across accounts on the same install', () => {
    expect(markFirstSessionAwayNudgeShown(userA)).toBe(true);
    expect(markFirstSessionAwaySetLogged(userA)).toBe(true);

    expect(wasFirstSessionAwayNudgeShown(userB)).toBe(false);
    expect(wasFirstSessionAwaySetLogged(userB)).toBe(false);
    expect(markFirstSessionAwayNudgeShown(userB)).toBe(true);
    expect(markFirstSessionAwaySetLogged(userB)).toBe(true);
  });

  it('does not write a shared install-wide flag when userId is missing', () => {
    expect(wasFirstSessionAwayNudgeShown(null)).toBe(false);
    expect(markFirstSessionAwayNudgeShown(undefined)).toBe(false);
    expect(wasFirstSessionAwayNudgeShown('')).toBe(false);
  });
});
