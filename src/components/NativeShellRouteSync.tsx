import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import {
  confirmNativeShellAvailable,
  isNativeIosShell,
  publishNativeShellChromeState,
  routeOwnsNativeShellChrome,
} from '@/lib/nativeShell';
import { useTheme } from '@/hooks/useTheme';

export default function NativeShellRouteSync() {
  const { pathname } = useLocation();
  const { isDark } = useTheme();
  const routeSequenceRef = useRef(0);

  useEffect(() => {
    const routeSequence = ++routeSequenceRef.current;
    let cancelled = false;

    if (!isNativeIosShell()) {
      return () => {
        cancelled = true;
      };
    }

    if (routeOwnsNativeShellChrome(pathname)) {
      return () => {
        cancelled = true;
      };
    }

    void (async () => {
      const available = await confirmNativeShellAvailable();
      if (!available || cancelled || routeSequenceRef.current !== routeSequence) {
        return;
      }

      await publishNativeShellChromeState({
        title: 'H.I.M.',
        subtitle: null,
        mode: 'sheet',
        activeTab: 'im',
        tabBarVisibility: 'hidden',
        leadingAction: null,
        trailingActions: [],
        accentTone: 'amber',
        canGoBack: false,
        isDark,
        showsTopChrome: false,
        showsBottomChrome: false,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, isDark]);

  return null;
}
