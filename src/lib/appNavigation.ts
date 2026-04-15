import { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';

interface RouterLike {
  push: (href: string, options?: { scroll?: boolean }) => void;
  replace: (href: string, options?: { scroll?: boolean }) => void;
}

interface NavigateOptions {
  replace?: boolean;
  scroll?: boolean;
  nativeDocumentNavigation?: boolean;
}

function isNativePlatform() {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform();
}

export function normalizeAppPath(path: string, native = isNativePlatform()) {
  const normalizedInput = path.trim() || '/';
  const url = new URL(normalizedInput, 'https://hiitsme.local');

  let pathname = url.pathname || '/';
  if (native && pathname === '/hi-its-me') {
    pathname = '/hi-its-me/';
  }

  return `${pathname}${url.search}${url.hash}`;
}

export function navigateAppPath(
  router: RouterLike,
  path: string,
  options: NavigateOptions = {},
) {
  const targetPath = normalizeAppPath(path);

  if (
    options.nativeDocumentNavigation &&
    isNativePlatform() &&
    typeof window !== 'undefined'
  ) {
    if (options.replace) {
      window.location.replace(targetPath);
      return;
    }

    window.location.assign(targetPath);
    return;
  }

  if (options.replace) {
    router.replace(targetPath, { scroll: options.scroll });
    return;
  }

  router.push(targetPath, { scroll: options.scroll });
}

export function replaceAppPathInPlace(path: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const targetPath = normalizeAppPath(path);
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (currentPath === targetPath) {
    return;
  }

  window.history.replaceState(window.history.state, '', targetPath);
}

/**
 * React Router adapter — returns a RouterLike compatible with navigateAppPath.
 * Replaces the Next.js useRouter() pattern:
 *   const router = useRouter();
 *   navigateAppPath(router, '/some-path');
 *
 * Becomes:
 *   const router = useAppRouter();
 *   navigateAppPath(router, '/some-path');
 */
export function useAppRouter(): RouterLike {
  const navigate = useNavigate();

  const push = useCallback(
    (href: string) => {
      navigate(href);
    },
    [navigate],
  );

  const replace = useCallback(
    (href: string) => {
      navigate(href, { replace: true });
    },
    [navigate],
  );

  return useMemo(() => ({ push, replace }), [push, replace]);
}
