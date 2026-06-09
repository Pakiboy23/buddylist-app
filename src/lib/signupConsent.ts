export type ConsentError = 'age' | 'art9' | null;

export interface ConsentState {
  ageConfirmed: boolean;
  art9Confirmed: boolean;
}

export const CONSENT_ERROR_MESSAGES: Record<NonNullable<ConsentError>, string> = {
  age: 'You must confirm you are 18 or older to create an account.',
  art9: 'You must consent to H.I.M. processing your data to create an account.',
};

export function validateSignupConsent({ ageConfirmed, art9Confirmed }: ConsentState): ConsentError {
  if (!ageConfirmed) return 'age';
  if (!art9Confirmed) return 'art9';
  return null;
}
