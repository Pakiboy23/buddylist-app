import { getJSON, setJSON } from '@/lib/clientStorage';

export interface AppLockSettings {
  enabled: boolean;
  pinHash: string | null;
  autoLockSeconds: number;
  biometricsEnabled: boolean;
}

export const APP_LOCK_AUTO_LOCK_OPTIONS = [0, 30, 60, 300] as const;

export const DEFAULT_APP_LOCK_SETTINGS: AppLockSettings = {
  enabled: false,
  pinHash: null,
  autoLockSeconds: 30,
  biometricsEnabled: false,
};

const APP_LOCK_STORAGE_PREFIX = 'buddylist:app-lock:v1:';

function isAllowedAutoLockSeconds(value: unknown): value is (typeof APP_LOCK_AUTO_LOCK_OPTIONS)[number] {
  return typeof value === 'number' && APP_LOCK_AUTO_LOCK_OPTIONS.includes(value as (typeof APP_LOCK_AUTO_LOCK_OPTIONS)[number]);
}

export function getAppLockStorageKey(userId: string) {
  return `${APP_LOCK_STORAGE_PREFIX}${userId}`;
}

export function normalizeAppLockSettings(value: Partial<AppLockSettings> | null | undefined): AppLockSettings {
  return {
    enabled: Boolean(value?.enabled && typeof value?.pinHash === 'string' && value.pinHash.trim()),
    pinHash: typeof value?.pinHash === 'string' && value.pinHash.trim() ? value.pinHash.trim() : null,
    autoLockSeconds: isAllowedAutoLockSeconds(value?.autoLockSeconds)
      ? value.autoLockSeconds
      : DEFAULT_APP_LOCK_SETTINGS.autoLockSeconds,
    biometricsEnabled: Boolean(value?.biometricsEnabled),
  };
}

export function loadAppLockSettings(userId: string) {
  return normalizeAppLockSettings(
    getJSON<Partial<AppLockSettings>>(getAppLockStorageKey(userId), {
      fallback: DEFAULT_APP_LOCK_SETTINGS,
    }),
  );
}

export function saveAppLockSettings(userId: string, settings: AppLockSettings) {
  return setJSON(getAppLockStorageKey(userId), normalizeAppLockSettings(settings));
}

export function isValidAppLockPin(pin: string) {
  return /^\d{4,6}$/.test(pin.trim());
}

export function formatAppLockTimeoutLabel(seconds: number) {
  if (seconds <= 0) {
    return 'Immediately';
  }

  if (seconds < 60) {
    return `${seconds} seconds`;
  }

  const minutes = Math.round(seconds / 60);
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

function encodeBytes(bytes: Uint8Array) {
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashAppLockPin(pin: string) {
  const normalized = pin.trim();
  const encoder = new TextEncoder();
  const bytes = encoder.encode(normalized);

  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return encodeBytes(new Uint8Array(digest));
  }

  return encodeBytes(bytes);
}

export async function verifyAppLockPin(pin: string, expectedHash: string | null | undefined) {
  if (!expectedHash) {
    return false;
  }

  const actualHash = await hashAppLockPin(pin);
  return actualHash === expectedHash;
}
