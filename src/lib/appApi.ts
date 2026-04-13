import { Capacitor } from '@capacitor/core';

const DEFAULT_NATIVE_API_ORIGIN = 'https://hiitsme-app.vercel.app';
const NATIVE_API_ORIGIN = (
  (import.meta.env.VITE_APP_API_ORIGIN as string | undefined) ?? DEFAULT_NATIVE_API_ORIGIN
)
  .trim()
  .replace(/\/+$/, '');

export function getAppApiUrl(path: string) {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
    return `${NATIVE_API_ORIGIN}${normalizedPath}`;
  }

  return normalizedPath;
}
