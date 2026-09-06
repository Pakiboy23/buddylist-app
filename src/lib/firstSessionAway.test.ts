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
  beforeEach(() => {
    removeValue('him.firstSession.awayNudgeShown');
    removeValue('him.firstSession.awaySetLogged');
  });

  it('records the nudge and the conversion once each', () => {
    expect(wasFirstSessionAwayNudgeShown()).toBe(false);
    expect(markFirstSessionAwayNudgeShown()).toBe(true);
    expect(markFirstSessionAwayNudgeShown()).toBe(false);
    expect(wasFirstSessionAwayNudgeShown()).toBe(true);

    expect(wasFirstSessionAwaySetLogged()).toBe(false);
    expect(markFirstSessionAwaySetLogged()).toBe(true);
    expect(markFirstSessionAwaySetLogged()).toBe(false);
    expect(wasFirstSessionAwaySetLogged()).toBe(true);
  });
});
