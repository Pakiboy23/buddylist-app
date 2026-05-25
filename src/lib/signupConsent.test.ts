import { describe, expect, it } from 'vitest';
import { CONSENT_ERROR_MESSAGES, validateSignupConsent } from './signupConsent';

describe('validateSignupConsent', () => {
  it('returns null when both boxes are checked', () => {
    expect(validateSignupConsent({ ageConfirmed: true, art9Confirmed: true })).toBeNull();
  });

  it('blocks sign-up when age is unchecked', () => {
    expect(validateSignupConsent({ ageConfirmed: false, art9Confirmed: true })).toBe('age');
  });

  it('blocks sign-up when Art. 9 consent is unchecked', () => {
    expect(validateSignupConsent({ ageConfirmed: true, art9Confirmed: false })).toBe('art9');
  });

  it('blocks sign-up when both are unchecked (age error takes priority)', () => {
    expect(validateSignupConsent({ ageConfirmed: false, art9Confirmed: false })).toBe('age');
  });

  it('error messages are non-empty strings', () => {
    expect(CONSENT_ERROR_MESSAGES.age.length).toBeGreaterThan(0);
    expect(CONSENT_ERROR_MESSAGES.art9.length).toBeGreaterThan(0);
  });
});
