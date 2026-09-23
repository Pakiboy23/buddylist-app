/**
 * Map a native launch / appUrlOpen URL onto an in-app route.
 *
 * Custom-scheme URLs such as `HIM://reset-password#access_token=…&type=recovery`
 * put the route in the hostname (WHATWG treats `reset-password` as the host).
 * HTTPS / Capacitor-localhost URLs keep the route in pathname.
 */
export function resolveDeepLinkPath(url: string): string | null {
  try {
    const parsed = new URL(url);
    let pathname = parsed.pathname ?? '';
    const search = parsed.search ?? '';
    const hash = parsed.hash ?? '';

    if (!pathname || pathname === '/') {
      const host = (parsed.hostname ?? '').replace(/\/+$/, '');
      if (!host || host === 'localhost' || host === '127.0.0.1') {
        return null;
      }
      pathname = `/${host}`;
    }

    return pathname + search + hash;
  } catch {
    return null;
  }
}
