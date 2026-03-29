import { Capacitor } from '@capacitor/core';
import type {
  BiometryError,
  BiometryErrorType,
  BiometryType,
  CheckBiometryResult,
} from '@aparajita/capacitor-biometric-auth';

export interface BiometricAvailability {
  isAvailable: boolean;
  isDeviceSecure: boolean;
  type: 'face' | 'touch' | 'fingerprint' | 'biometric' | 'none';
  label: string;
  reason: string;
  code: string;
}

type BiometricModule = typeof import('@aparajita/capacitor-biometric-auth');

let modulePromise: Promise<BiometricModule> | null = null;

async function loadBiometricModule() {
  if (!modulePromise) {
    modulePromise = import('@aparajita/capacitor-biometric-auth');
  }

  return modulePromise;
}

function getBiometricLabelFromType(type: BiometryType) {
  if (type === 2) {
    return { type: 'face' as const, label: 'Face ID' };
  }
  if (type === 1) {
    return { type: 'touch' as const, label: 'Touch ID' };
  }
  if (type === 3) {
    return { type: 'fingerprint' as const, label: 'Fingerprint' };
  }
  return { type: 'biometric' as const, label: 'Biometric unlock' };
}

function normalizeCheckResult(result: CheckBiometryResult): BiometricAvailability {
  if (!result.isAvailable) {
    return {
      isAvailable: false,
      isDeviceSecure: result.deviceIsSecure,
      type: 'none',
      label: 'Biometric unlock',
      reason: result.reason,
      code: result.code,
    };
  }

  const resolved = getBiometricLabelFromType(result.biometryType);
  return {
    isAvailable: true,
    isDeviceSecure: result.deviceIsSecure,
    type: resolved.type,
    label: resolved.label,
    reason: result.reason,
    code: result.code,
  };
}

export const DEFAULT_BIOMETRIC_AVAILABILITY: BiometricAvailability = {
  isAvailable: false,
  isDeviceSecure: false,
  type: 'none',
  label: 'Biometric unlock',
  reason: '',
  code: '',
};

export async function checkBiometricAvailability(): Promise<BiometricAvailability> {
  if (!Capacitor.isNativePlatform()) {
    return DEFAULT_BIOMETRIC_AVAILABILITY;
  }

  try {
    const { BiometricAuth } = await loadBiometricModule();
    const result = await BiometricAuth.checkBiometry();
    return normalizeCheckResult(result);
  } catch (error) {
    return {
      ...DEFAULT_BIOMETRIC_AVAILABILITY,
      reason: error instanceof Error ? error.message : 'Biometric authentication unavailable.',
    };
  }
}

export async function authenticateWithBiometrics(reason: string) {
  const { BiometricAuth } = await loadBiometricModule();
  return BiometricAuth.authenticate({
    reason,
    cancelTitle: 'Use PIN',
    iosFallbackTitle: 'Use PIN',
    allowDeviceCredential: false,
    androidTitle: 'Unlock BuddyList',
    androidSubtitle: reason,
    androidConfirmationRequired: false,
  });
}

export function getBiometricErrorCode(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    const maybeCode = (error as BiometryError | { code?: unknown }).code;
    if (typeof maybeCode === 'string') {
      return maybeCode as BiometryErrorType | string;
    }
  }

  return '';
}
