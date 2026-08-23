/**
 * Decides what a visitor sees at the auth root (GH-108).
 *
 * Native Capacitor keeps `/` as the sign-in card — the porch is a web-only
 * surface for cold visitors who landed on hiitsme.app with no session. The
 * login card stays reachable at `/signin` and via the legacy `?signin=1`
 * links that predate this route.
 */

export type AuthLanding = 'porch' | 'signin';

export interface AuthLandingContext {
  isNative: boolean;
  pathname: string;
  search: string;
}

export function resolveAuthLanding({ isNative, pathname, search }: AuthLandingContext): AuthLanding {
  if (isNative) return 'signin';

  const normalizedPath = pathname.replace(/\/+$/, '') || '/';
  if (normalizedPath === '/signin') return 'signin';

  const params = new URLSearchParams(search);
  if (params.get('signin') === '1') return 'signin';
  if (params.get('create') === '1') return 'signin';

  return 'porch';
}
