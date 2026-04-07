import { describe, expect, it } from 'vitest';
import {
  getPrimaryAuthEmail,
  getSignInAuthEmailCandidates,
  isInvalidCredentialsError,
} from '@/lib/authIdentity';

describe('getPrimaryAuthEmail', () => {
  it('maps new screen names to the H.I.M. auth domain', () => {
    expect(getPrimaryAuthEmail('Pakiboy24')).toBe('pakiboy24@hiitsme.app');
  });

  it('preserves direct email input', () => {
    expect(getPrimaryAuthEmail('Pakiboy24@buddylist.com')).toBe('pakiboy24@buddylist.com');
  });
});

describe('getSignInAuthEmailCandidates', () => {
  it('tries the current domain before the legacy BuddyList domain', () => {
    expect(getSignInAuthEmailCandidates('Pakiboy24')).toEqual([
      'pakiboy24@hiitsme.app',
      'pakiboy24@buddylist.com',
    ]);
  });

  it('preserves direct email input as a single candidate', () => {
    expect(getSignInAuthEmailCandidates('Pakiboy24@buddylist.com')).toEqual(['pakiboy24@buddylist.com']);
  });
});

describe('isInvalidCredentialsError', () => {
  it('matches Supabase invalid-credentials responses', () => {
    expect(isInvalidCredentialsError('Invalid login credentials')).toBe(true);
  });

  it('ignores unrelated auth failures', () => {
    expect(isInvalidCredentialsError('Email not confirmed')).toBe(false);
  });
});
