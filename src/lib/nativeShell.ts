import { Capacitor, registerPlugin } from '@capacitor/core';

export type NativePushEnvironment = 'sandbox' | 'production';

interface HiItsMeShellPlugin {
  isAvailable(): Promise<{ available: boolean; platform?: string }>;
  getPushEnvironment(): Promise<{ environment?: NativePushEnvironment | null }>;
}

const HiItsMeShell = registerPlugin<HiItsMeShellPlugin>('HiItsMeShell');
let cachedPushEnvironment: NativePushEnvironment | null | undefined;
let pendingPushEnvironmentLookup: Promise<NativePushEnvironment | null> | null = null;

export function isNativeIosShell() {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

/**
 * Confirms that the native presentation shell is hosting the web view.
 * Always false since f6fbad5 — the React app draws every pixel. Kept so
 * diagnostics can still ask the plugin whether a native chrome host exists.
 */
export async function confirmNativeShellAvailable(): Promise<boolean> {
  if (!isNativeIosShell()) {
    return false;
  }

  try {
    const availability = await HiItsMeShell.isAvailable();
    return availability.available === true;
  } catch (error) {
    console.warn('Native shell availability check failed:', error);
    return false;
  }
}

export async function getNativePushEnvironment(): Promise<NativePushEnvironment | null> {
  if (!isNativeIosShell() || !Capacitor.isPluginAvailable('HiItsMeShell')) {
    return null;
  }

  if (cachedPushEnvironment !== undefined) {
    return cachedPushEnvironment;
  }

  if (!pendingPushEnvironmentLookup) {
    pendingPushEnvironmentLookup = (async () => {
      try {
        // No `isAvailable()` gate here. That call reports whether the native
        // *presentation* shell is hosting the view, which is deliberately false
        // since f6fbad5 — the React app draws every pixel. The signed push
        // environment is a native service that is unrelated to who renders the
        // UI, and the guards above (native iOS + plugin registered) are its real
        // preconditions. Gating on availability made this always return null, so
        // every iOS token persisted push_environment: null and APNs delivery fell
        // back to trying both hosts.
        const result = await HiItsMeShell.getPushEnvironment();
        return result.environment === 'sandbox' || result.environment === 'production'
          ? result.environment
          : null;
      } catch (error) {
        console.warn('Native push environment lookup failed:', error);
        return null;
      }
    })().finally(() => {
      pendingPushEnvironmentLookup = null;
    });
  }

  const environment = await pendingPushEnvironmentLookup;
  if (environment !== null) {
    cachedPushEnvironment = environment;
  }
  return environment;
}
