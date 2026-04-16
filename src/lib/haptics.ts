import { Capacitor } from '@capacitor/core';
import type { HapticsPlugin } from '@capacitor/haptics';

let hapticsPlugin: HapticsPlugin | null = null;
let loadAttempted = false;
let impactStyleEnum: Record<string, unknown> | null = null;
let notificationTypeEnum: Record<string, unknown> | null = null;

async function getHapticsPlugin() {
  if (hapticsPlugin) {
    return hapticsPlugin;
  }

  if (loadAttempted || !Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('Haptics')) {
    return null;
  }

  loadAttempted = true;

  try {
    const mod = await import('@capacitor/haptics');
    hapticsPlugin = mod.Haptics;
    impactStyleEnum = mod.ImpactStyle as unknown as Record<string, unknown>;
    notificationTypeEnum = mod.NotificationType as unknown as Record<string, unknown>;
    return hapticsPlugin;
  } catch {
    return null;
  }
}

/** Light tap — button presses, selections. */
export async function hapticLight() {
  const haptics = await getHapticsPlugin();
  if (!haptics || !impactStyleEnum) return;
  await haptics.impact({ style: impactStyleEnum.Light as never });
}

/** Medium tap — confirmations, toggles. */
export async function hapticMedium() {
  const haptics = await getHapticsPlugin();
  if (!haptics || !impactStyleEnum) return;
  await haptics.impact({ style: impactStyleEnum.Medium as never });
}

/** Heavy tap — destructive actions, important state changes. */
export async function hapticHeavy() {
  const haptics = await getHapticsPlugin();
  if (!haptics || !impactStyleEnum) return;
  await haptics.impact({ style: impactStyleEnum.Heavy as never });
}

/** Success notification — message sent, action completed. */
export async function hapticSuccess() {
  const haptics = await getHapticsPlugin();
  if (!haptics || !notificationTypeEnum) return;
  await haptics.notification({ type: notificationTypeEnum.Success as never });
}

/** Warning notification — approaching limits, recoverable errors. */
export async function hapticWarning() {
  const haptics = await getHapticsPlugin();
  if (!haptics || !notificationTypeEnum) return;
  await haptics.notification({ type: notificationTypeEnum.Warning as never });
}

/** Error notification — failed actions. */
export async function hapticError() {
  const haptics = await getHapticsPlugin();
  if (!haptics || !notificationTypeEnum) return;
  await haptics.notification({ type: notificationTypeEnum.Error as never });
}

/** Selection tick — list reordering, picker scrolling. */
export async function hapticSelection() {
  const haptics = await getHapticsPlugin();
  if (!haptics) return;
  await haptics.selectionChanged();
}
