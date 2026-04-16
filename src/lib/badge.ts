import { Capacitor } from '@capacitor/core';

type BadgePlugin = {
  set(options: { count: number }): Promise<void>;
  clear(): Promise<void>;
};

let badgePlugin: BadgePlugin | null = null;
let loadAttempted = false;

async function getBadgePlugin(): Promise<BadgePlugin | null> {
  if (badgePlugin) return badgePlugin;
  if (loadAttempted || !Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('Badge')) return null;
  loadAttempted = true;

  try {
    const { Badge } = await import('@capawesome/capacitor-badge');
    badgePlugin = Badge as BadgePlugin;
    return badgePlugin;
  } catch {
    return null;
  }
}

export async function setAppBadgeCount(count: number): Promise<void> {
  const plugin = await getBadgePlugin();
  if (!plugin) return;

  try {
    if (count <= 0) {
      await plugin.clear();
    } else {
      await plugin.set({ count });
    }
  } catch {
    // Badge permission not granted or unsupported
  }
}

export async function clearAppBadge(): Promise<void> {
  const plugin = await getBadgePlugin();
  if (!plugin) return;

  try {
    await plugin.clear();
  } catch {
    // ignore
  }
}
