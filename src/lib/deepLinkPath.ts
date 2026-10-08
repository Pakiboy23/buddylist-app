const WEB_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Maps a URL the OS hands the app (custom scheme or universal link) to an SPA
 * route, keeping search and hash so flows that carry tokens in the fragment
 * (Supabase recovery: `#access_token=...&type=recovery`) still receive them.
 *
 * WHATWG parsing puts the route in the host for `scheme://route` URLs:
 * `hiitsme://hi-its-me` has host `hi-its-me` and an empty pathname.
 * When a custom-scheme URL has no path, the host is the route. `localhost` is
 * Capacitor's own origin (`HIM://localhost/...`), never a route.
 */
export function resolveDeepLinkPath(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const { protocol, host, pathname, search, hash } = parsed;
  let route = pathname;
  if ((!route || route === '/') && !WEB_PROTOCOLS.has(protocol) && host && host.toLowerCase() !== 'localhost') {
    route = `/${host}`;
  }

  // Recovery tokens are accepted only on the app's associated HTTPS origin.
  if (route.replace(/\/$/, '') === '/reset-password' && parsed.origin !== 'https://hiitsme.app') {
    return null;
  }

  if (!route || route === '/') {
    return null;
  }
  return route + (search ?? '') + (hash ?? '');
}
