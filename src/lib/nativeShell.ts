'use client';

import { Capacitor, registerPlugin } from '@capacitor/core';

export type NativeShellTab = 'im' | 'chat' | 'buddy' | 'profile';
export type NativeShellMode = 'standard' | 'conversation' | 'sheet';
export type NativeShellTabBarVisibility = 'visible' | 'hidden';
export type NativeShellAccentTone = 'blue' | 'violet' | 'emerald' | 'amber' | 'slate';
export type NativeShellAction =
  | 'toggleTheme'
  | 'openSaved'
  | 'openAdd'
  | 'openMenu'
  | 'openAccount'
  | 'openPrivacy'
  | 'openAdminReset'
  | 'signOff'
  | 'goBack';

export type NativeShellNotificationPreviewMode = 'full' | 'name_only' | 'hidden';
export type NativePushEnvironment = 'sandbox' | 'production';

export interface NativeShellChromeState {
  title: string;
  subtitle?: string | null;
  mode?: NativeShellMode;
  activeTab: NativeShellTab;
  tabBarVisibility?: NativeShellTabBarVisibility;
  leadingAction?: NativeShellAction | null;
  trailingActions?: NativeShellAction[];
  accentTone?: NativeShellAccentTone;
  canGoBack?: boolean;
  isDark?: boolean;
  isAdminUser?: boolean;
  unreadDirectCount?: number;
  showsTopChrome?: boolean;
  showsBottomChrome?: boolean;
  sequence?: number;
}

export interface NativeShellPrivacySettings {
  shareReadReceipts: boolean;
  notificationPreviewMode: NativeShellNotificationPreviewMode;
  screenShieldEnabled: boolean;
}

export interface NativeShellPrivacyState {
  settings: NativeShellPrivacySettings;
  appLockEnabled: boolean;
  appLockTimeoutLabel: string;
  biometricsEnabled: boolean;
  biometricLabel?: string | null;
  blockedBuddyCount: number;
}

export type NativeShellPrivacyResult =
  | {
      ok: true;
      state: NativeShellPrivacyState;
      warning?: string | null;
    }
  | {
      ok: false;
      error: string;
    };

export interface NativeShellAdminAuditItem {
  id: number;
  title: string;
  timestamp: string;
  actorLabel: string;
  targetLabel: string;
  reason?: string | null;
}

export type NativeShellAdminAuditResult =
  | {
      ok: true;
      entries: NativeShellAdminAuditItem[];
    }
  | {
      ok: false;
      error: string;
    };

export type NativeShellAdminIssueResult =
  | {
      ok: true;
      screenname: string;
      ticket: string;
      expiresAt: string;
      handoff: string;
      feedback: string;
    }
  | {
      ok: false;
      error: string;
    };

export interface NativeShellBridge {
  loadPrivacyState(): Promise<NativeShellPrivacyResult>;
  updatePrivacySettings(patch: Partial<NativeShellPrivacySettings>): Promise<NativeShellPrivacyResult>;
  loadAdminResetAudit(limit?: number): Promise<NativeShellAdminAuditResult>;
  issueAdminResetTicket(screenname: string): Promise<NativeShellAdminIssueResult>;
}

export type NativeShellCommand =
  | {
      type: 'selectTab';
      tab: NativeShellTab;
    }
  | {
      type: 'triggerAction';
      action: NativeShellAction;
    };

interface HiItsMeShellPlugin {
  isAvailable(): Promise<{ available: boolean; platform?: string }>;
  setChromeState(state: NativeShellChromeState): Promise<void>;
  getPushEnvironment(): Promise<{ environment?: NativePushEnvironment | null }>;
}

const HiItsMeShell = registerPlugin<HiItsMeShellPlugin>('HiItsMeShell');
const NATIVE_SHELL_COMMAND_EVENT = 'hiitsme:native-shell-command';
let cachedPushEnvironment: NativePushEnvironment | null | undefined;
let pendingPushEnvironmentLookup: Promise<NativePushEnvironment | null> | null = null;
let chromeStateSequence = 0;

declare global {
  interface Window {
    __hiItsMeNativeShell?: NativeShellBridge;
  }
}

export function isNativeIosShell() {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

const MAIN_SHELL_PATH = '/hi-its-me';

/**
 * True only for the main /hi-its-me shell page — the one route that publishes
 * its own chrome state and subscribes to native shell commands. Sub-routes
 * (/hi-its-me/rooms, /hi-its-me/rooms/:id/preview, …) are standalone pages
 * with no command subscriber, so the native chrome must be hidden there:
 * otherwise its tab bar and back button dispatch commands nobody handles and
 * the app appears frozen until force-quit.
 */
export function routeOwnsNativeShellChrome(pathname: string): boolean {
  return pathname === MAIN_SHELL_PATH || pathname === `${MAIN_SHELL_PATH}/`;
}

/**
 * Confirms that the native shell is genuinely hosting the web view and can render
 * its own chrome (top nav + tab bar). This is stronger than {@link isNativeIosShell}:
 * a build can be native iOS yet not embed the custom `HiItsMeShell` root (stock
 * Capacitor, a failed plugin registration, or a native packaging regression). In
 * those cases the bridge reports the shell as unavailable and the web layer keeps
 * its own navigation chrome so the user is never stranded without nav buttons.
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

export async function publishNativeShellChromeState(state: NativeShellChromeState) {
  if (!isNativeIosShell()) {
    return;
  }
  // Availability is confirmed via the live `isAvailable()` round-trip below rather
  // than `Capacitor.isPluginAvailable`, which reports stale plugin headers and can
  // miss the manually-registered shell plugin on otherwise-healthy builds.

  const sequence = ++chromeStateSequence;
  const payload: NativeShellChromeState = { ...state, sequence };
  const isStale = () => chromeStateSequence !== sequence;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (isStale()) {
      return;
    }

    try {
      const availability = await HiItsMeShell.isAvailable();
      if (!availability.available || isStale()) {
        return;
      }

      await HiItsMeShell.setChromeState(payload);
      return;
    } catch (error) {
      lastError = error;
      if (attempt === 3 || isStale()) {
        break;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 120 * (attempt + 1)));
    }
  }

  if (lastError && !isStale()) {
    console.warn('Native shell state update failed:', lastError);
  }
}

export function subscribeNativeShellCommands(handler: (command: NativeShellCommand) => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const listener = (event: Event) => {
    const detail = (event as CustomEvent<NativeShellCommand | undefined>).detail;
    if (!detail || typeof detail !== 'object' || !('type' in detail)) {
      return;
    }
    handler(detail);
  };

  window.addEventListener(NATIVE_SHELL_COMMAND_EVENT, listener);
  return () => {
    window.removeEventListener(NATIVE_SHELL_COMMAND_EVENT, listener);
  };
}

export function registerNativeShellBridge(bridge: NativeShellBridge | null) {
  if (typeof window === 'undefined') {
    return;
  }

  if (bridge) {
    window.__hiItsMeNativeShell = bridge;
    return;
  }

  delete window.__hiItsMeNativeShell;
}
