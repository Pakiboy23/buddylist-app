import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  isNativeIosShell,
  publishNativeShellChromeState,
  routeOwnsNativeShellChrome,
} from '@/lib/nativeShell';
import { useTheme } from '@/hooks/useTheme';

export default function NativeShellRouteSync() {
  const { pathname } = useLocation();
  const { isDark } = useTheme();

  useEffect(() => {
    if (!isNativeIosShell()) {
      return;
    }

    if (routeOwnsNativeShellChrome(pathname)) {
      return;
    }

    void publishNativeShellChromeState({
      title: 'H.I.M.',
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
  }, [pathname, isDark]);

  return null;
}
