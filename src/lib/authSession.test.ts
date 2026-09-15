import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { shouldBounceToSignedOutRoute } from '@/lib/authSessionPolicy';

const HI_ITS_ME_PAGE = path.resolve(__dirname, '../app/hi-its-me/page.tsx');
const LOGIN_PAGE = path.resolve(__dirname, '../app/page.tsx');

describe('shouldBounceToSignedOutRoute', () => {
  const events: AuthChangeEvent[] = [
    'INITIAL_SESSION',
    'SIGNED_IN',
    'SIGNED_OUT',
    'TOKEN_REFRESHED',
    'USER_UPDATED',
    'PASSWORD_RECOVERY',
    'MFA_CHALLENGE_VERIFIED',
  ];

  it('only treats SIGNED_OUT as a return to the login UI', () => {
    for (const event of events) {
      expect(shouldBounceToSignedOutRoute(event, null)).toBe(event === 'SIGNED_OUT');
      expect(shouldBounceToSignedOutRoute(event, { access_token: 'tok' } as Session)).toBe(
        event === 'SIGNED_OUT',
      );
    }
  });

  it('does not bounce on INITIAL_SESSION with a null session', () => {
    // App Review 2.1(a): /hi-its-me used to navigate to / on any null session,
    // including the INITIAL_SESSION emit that fires when the listener is
    // attached — which can be null on Capacitor while getSession is still
    // recovering. That looks like "logged in, then immediately signed out."
    expect(shouldBounceToSignedOutRoute('INITIAL_SESSION', null)).toBe(false);
  });
});

describe('signed-out bounce call sites', () => {
  it('hi-its-me only returns to login on SIGNED_OUT, not any null session', () => {
    const source = readFileSync(HI_ITS_ME_PAGE, 'utf-8');
    expect(source).toContain('shouldBounceToSignedOutRoute');
    expect(source).not.toMatch(/onAuthStateChange\(\(_event,\s*nextSession\)\s*=>\s*\{\s*if\s*\(\s*!nextSession\s*\)/);
  });

  it('login page still ignores everything except SIGNED_IN and does not await the sign-on sound', () => {
    const source = readFileSync(LOGIN_PAGE, 'utf-8');
    expect(source).toMatch(/if\s*\(\s*!session\s*\|\|\s*event\s*!==\s*'SIGNED_IN'\s*\)\s*return/);
    expect(source).toContain('void playSignOnSound()');
    expect(source).not.toMatch(/await playSignOnSound\(\)/);
  });
});
