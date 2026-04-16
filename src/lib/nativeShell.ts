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

declare global {
  interface Window {
    __hiItsMeNativeShell?: NativeShellBridge;
  }
}

export function isNativeIosShell() {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
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
        const availability = await HiItsMeShell.isAvailable();
        if (!availability.available) {
          return null;
        }

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
  if (!isNativeIosShell() || !Capacitor.isPluginAvailable('HiItsMeShell')) {
    return;
  }

  let lastError: unknown = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const availability = await HiItsMeShell.isAvailable();
      if (!availability.available) {
        return;
      }

      await HiItsMeShell.setChromeState(state);
      return;
    } catch (error) {
      lastError = error;
      if (attempt === 3) {
        break;
      }

      await new Promise((resolve) => window.setTimeout(resolve, 120 * (attempt + 1)));
    }
  }

  if (lastError) {
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
