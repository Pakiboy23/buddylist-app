'use client';

import { Capacitor } from '@capacitor/core';
import { useEffect } from 'react';

export default function PwaBootstrap() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator) || Capacitor.isNativePlatform()) {
      return;
    }

    const registerServiceWorker = async () => {
      try {
        await navigator.serviceWorker.register('/sw.js');
      } catch (error) {
        console.error('Service worker registration failed:', error);
      }
    };

    void registerServiceWorker();
  }, []);

  return null;
}
