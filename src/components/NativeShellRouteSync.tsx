'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { isNativeIosShell, publishNativeShellChromeState } from '@/lib/nativeShell';

const BUDDY_LIST_PATH = '/buddy-list';

export default function NativeShellRouteSync() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isNativeIosShell()) {
      return;
    }

    const isDark =
      typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

    if (pathname.startsWith(BUDDY_LIST_PATH)) {
      void publishNativeShellChromeState({
        title: 'Buddy List',
        subtitle: 'Private messaging for buddies',
        mode: 'standard',
        activeTab: 'im',
        tabBarVisibility: 'visible',
        leadingAction: null,
        trailingActions: ['openSaved', 'toggleTheme', 'openMenu'],
        accentTone: 'blue',
        canGoBack: false,
        isDark,
        showsTopChrome: true,
        showsBottomChrome: true,
      });
      return;
    }

    void publishNativeShellChromeState({
      title: 'Buddy List',
      subtitle: null,
      mode: 'sheet',
      activeTab: 'im',
      tabBarVisibility: 'hidden',
      leadingAction: null,
      trailingActions: [],
      accentTone: 'blue',
      canGoBack: false,
      isDark,
      showsTopChrome: false,
      showsBottomChrome: false,
    });
  }, [pathname]);

  return null;
}
