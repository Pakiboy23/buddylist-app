'use client';

import { Capacitor, registerPlugin } from '@capacitor/core';

export type NativeShellTab = 'im' | 'chat' | 'buddy' | 'profile';
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

export interface NativeShellChromeState {
  title: string;
  subtitle?: string | null;
  activeTab: NativeShellTab;
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

interface BuddyListShellPlugin {
  isAvailable(): Promise<{ available: boolean; platform?: string }>;
  setChromeState(state: NativeShellChromeState): Promise<void>;
}

const BuddyListShell = registerPlugin<BuddyListShellPlugin>('BuddyListShell');
const NATIVE_SHELL_COMMAND_EVENT = 'buddylist:native-shell-command';

declare global {
  interface Window {
    __buddyListNativeShell?: NativeShellBridge;
  }
}

export function isNativeIosShell() {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

export async function publishNativeShellChromeState(state: NativeShellChromeState) {
  if (!isNativeIosShell()) {
    return;
  }

  try {
    const availability = await BuddyListShell.isAvailable();
    if (!availability.available) {
      return;
    }

    await BuddyListShell.setChromeState(state);
  } catch (error) {
    console.warn('Native shell state update failed:', error);
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
    window.__buddyListNativeShell = bridge;
    return;
  }

  delete window.__buddyListNativeShell;
}
