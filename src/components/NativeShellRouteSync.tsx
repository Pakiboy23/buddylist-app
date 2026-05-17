import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isNativeIosShell, publishNativeShellChromeState } from '@/lib/nativeShell';
import { useTheme } from '@/hooks/useTheme';

const HI_ITS_ME_PATH = '/hi-its-me';

export default function NativeShellRouteSync() {
  const { pathname } = useLocation();
  const { isDark } = useTheme();

  useEffect(() => {
    if (!isNativeIosShell()) {
      return;
    }

    if (pathname.startsWith(HI_ITS_ME_PATH)) {
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
