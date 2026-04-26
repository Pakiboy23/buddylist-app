import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { useNavigate } from 'react-router-dom';

function resolveDeepLinkPath(url: string): string | null {
  try {
    const { pathname, search } = new URL(url);
    if (!pathname || pathname === '/') {
      return null;
    }
    return pathname + (search ?? '');
  } catch {
    return null;
  }
}

export default function DeepLinkHandler() {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let isCancelled = false;
    let listenerHandle: { remove: () => Promise<void> } | null = null;

    const handleUrl = (url: string) => {
      if (isCancelled) return;
      const path = resolveDeepLinkPath(url);
      if (path) {
        navigate(path);
      }
    };

    const setup = async () => {
      const { App } = await import('@capacitor/app');

      // Cold-launch: URL that caused the app to open from a stopped state.
      const launch = await App.getLaunchUrl();
      if (!isCancelled && launch?.url) {
        handleUrl(launch.url);
      }

      // Foreground: URL received while the app is already running.
      listenerHandle = await App.addListener('appUrlOpen', (event) => {
        handleUrl(event.url);
      });
    };

    void setup();

    return () => {
      isCancelled = true;
      void listenerHandle?.remove();
    };
  }, [navigate]);

  return null;
}
