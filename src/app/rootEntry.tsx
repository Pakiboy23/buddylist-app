import { Capacitor } from '@capacitor/core';
import { useLocation } from 'react-router-dom';
import LoginPage from '@/app/page';
import WebPorch from '@/app/porch';
import { shouldShowWebPorch } from '@/lib/webPorch';

export default function RootEntry() {
  const { pathname, search } = useLocation();
  if (shouldShowWebPorch({ native: Capacitor.isNativePlatform(), pathname, search })) {
    return <WebPorch />;
  }
  return <LoginPage />;
}
