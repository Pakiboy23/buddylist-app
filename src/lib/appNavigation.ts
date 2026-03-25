'use client';

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
  const url = new URL(normalizedInput, 'https://buddylist.local');

  let pathname = url.pathname || '/';
  if (native && pathname === '/buddy-list') {
    pathname = '/buddy-list/';
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
