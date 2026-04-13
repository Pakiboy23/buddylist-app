import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isNativeIosShell, publishNativeShellChromeState } from '@/lib/nativeShell';

const HI_ITS_ME_PATH = '/hi-its-me';

export default function NativeShellRouteSync() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (!isNativeIosShell()) {
      return;
    }

    if (pathname.startsWith(HI_ITS_ME_PATH)) {
      return;
    }

    const isDark =
      typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

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
  }, [pathname]);

  return null;
}
