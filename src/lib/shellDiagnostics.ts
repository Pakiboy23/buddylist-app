import { Capacitor } from '@capacitor/core';
import { confirmNativeShellAvailable } from '@/lib/nativeShell';

// Injected by vite.config.ts `define`. Absent under Vitest (which doesn't
// load the app's vite config), so every read goes through the typeof guard.
declare const __HIM_BUILD_STAMP__: string;

export function getBuildStamp(): string {
  return typeof __HIM_BUILD_STAMP__ === 'string' ? __HIM_BUILD_STAMP__ : 'dev';
}

export interface ShellDiagnostics {
  buildStamp: string;
  platform: string;
  nativePlatform: boolean;
  pluginRegistered: boolean;
  shellActive: boolean;
}

export async function collectShellDiagnostics(): Promise<ShellDiagnostics> {
  let pluginRegistered = false;
  try {
    pluginRegistered = Capacitor.isPluginAvailable('HiItsMeShell');
  } catch {
    // Treat a throwing plugin registry the same as an absent plugin.
  }

  return {
    buildStamp: getBuildStamp(),
    platform: Capacitor.getPlatform(),
    nativePlatform: Capacitor.isNativePlatform(),
    pluginRegistered,
    shellActive: await confirmNativeShellAvailable(),
  };
}

/**
 * One support-readable line, e.g. `Build 46b62cd 2026-08-01 02:10Z · ios · shell active`.
 * "registered, inactive" means the plugin exists but isAvailable() said no —
 * a native packaging problem. "plugin missing" on a native platform means the
 * shell never registered at all (stock Capacitor shell or a broken build).
 */
export function describeShellDiagnostics(diagnostics: ShellDiagnostics): string {
  const shellLabel = !diagnostics.nativePlatform
    ? 'web'
    : diagnostics.shellActive
      ? 'shell active'
      : diagnostics.pluginRegistered
        ? 'shell registered, inactive'
        : 'shell plugin missing';
  return `Build ${diagnostics.buildStamp} · ${diagnostics.platform} · ${shellLabel}`;
}
