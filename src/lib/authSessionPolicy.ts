import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

/**
 * True only when the user has actually signed out. `INITIAL_SESSION` with a
 * null session is "not restored yet" (common on Capacitor while storage is
 * still hydrating), not a logout. Treating that as signed-out bounces App
 * Review from a successful sign-in straight back to the login UI (2.1(a)).
 */
export function shouldBounceToSignedOutRoute(
  event: AuthChangeEvent,
  _session: Session | null,
): boolean {
  switch (event) {
    case 'SIGNED_OUT':
      return true;
    case 'INITIAL_SESSION':
    case 'SIGNED_IN':
    case 'TOKEN_REFRESHED':
    case 'USER_UPDATED':
    case 'PASSWORD_RECOVERY':
    case 'MFA_CHALLENGE_VERIFIED':
      return false;
    default: {
      const exhaustive: never = event;
      return exhaustive;
    }
  }
}
