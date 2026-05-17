import { Capacitor } from '@capacitor/core';

export type PushPermissionStatus = 'granted' | 'denied' | 'prompt' | 'not-native';

export async function checkPushPermission(): Promise<PushPermissionStatus> {
  if (!Capacitor.isNativePlatform()) return 'not-native';
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const state = await PushNotifications.checkPermissions();
    return state.receive as PushPermissionStatus;
  } catch {
    return 'denied';
  }
}

export async function requestAndRegisterPush(): Promise<PushPermissionStatus> {
  if (!Capacitor.isNativePlatform()) return 'not-native';
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const result = await PushNotifications.requestPermissions();
    if (result.receive === 'granted') {
      await PushNotifications.register();
    }
    return result.receive as PushPermissionStatus;
  } catch {
    return 'denied';
  }
}
