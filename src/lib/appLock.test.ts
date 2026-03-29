import { describe, expect, it } from 'vitest';
import {
  formatAppLockTimeoutLabel,
  hashAppLockPin,
  isValidAppLockPin,
  normalizeAppLockSettings,
  verifyAppLockPin,
} from '@/lib/appLock';

describe('normalizeAppLockSettings', () => {
  it('disables app lock if no usable pin hash is present', () => {
    expect(
      normalizeAppLockSettings({
        enabled: true,
        pinHash: '',
        autoLockSeconds: 999,
      }),
    ).toEqual({
      enabled: false,
      pinHash: null,
      autoLockSeconds: 30,
      biometricsEnabled: false,
    });
  });
});

describe('isValidAppLockPin', () => {
  it('accepts 4 to 6 digit pins', () => {
    expect(isValidAppLockPin('1234')).toBe(true);
    expect(isValidAppLockPin('123456')).toBe(true);
    expect(isValidAppLockPin('123')).toBe(false);
    expect(isValidAppLockPin('abcd')).toBe(false);
  });
});

describe('hashAppLockPin', () => {
  it('verifies a matching pin against its stored hash', async () => {
    const pinHash = await hashAppLockPin('2468');

    await expect(verifyAppLockPin('2468', pinHash)).resolves.toBe(true);
    await expect(verifyAppLockPin('1357', pinHash)).resolves.toBe(false);
  });
});

describe('formatAppLockTimeoutLabel', () => {
  it('formats timeout labels for the privacy sheet', () => {
    expect(formatAppLockTimeoutLabel(0)).toBe('Immediately');
    expect(formatAppLockTimeoutLabel(30)).toBe('30 seconds');
    expect(formatAppLockTimeoutLabel(60)).toBe('1 minute');
  });
});
