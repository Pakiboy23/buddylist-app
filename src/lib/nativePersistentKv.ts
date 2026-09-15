import { Capacitor, registerPlugin } from '@capacitor/core';

interface HimPersistentKvPlugin {
  getPersistentItem(options: { key: string }): Promise<{ value?: string | null }>;
  setPersistentItem(options: { key: string; value: string }): Promise<void>;
  removePersistentItem(options: { key: string }): Promise<void>;
}

const HiItsMeShellKv = registerPlugin<HimPersistentKvPlugin>('HiItsMeShell');

function canUseNativeKv() {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('HiItsMeShell');
}

export async function getNativePersistentItem(key: string): Promise<string | null> {
  if (!canUseNativeKv()) {
    return null;
  }
  try {
    const result = await HiItsMeShellKv.getPersistentItem({ key });
    return typeof result.value === 'string' && result.value.length > 0 ? result.value : null;
  } catch {
    return null;
  }
}

export async function setNativePersistentItem(key: string, value: string): Promise<void> {
  if (!canUseNativeKv()) {
    return;
  }
  await HiItsMeShellKv.setPersistentItem({ key, value });
}

export async function removeNativePersistentItem(key: string): Promise<void> {
  if (!canUseNativeKv()) {
    return;
  }
  await HiItsMeShellKv.removePersistentItem({ key });
}
