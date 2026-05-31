import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { isNativePlatform, getPlatform, isPluginAvailable, shellIsAvailable } = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  getPlatform: vi.fn(() => 'web'),
  isPluginAvailable: vi.fn(() => true),
  shellIsAvailable: vi.fn(async () => ({ available: true, platform: 'ios' })),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform,
    getPlatform,
    isPluginAvailable,
  },
  registerPlugin: () => ({
    isAvailable: shellIsAvailable,
    setChromeState: vi.fn(async () => undefined),
    getPushEnvironment: vi.fn(async () => ({ environment: null })),
  }),
}));

import { confirmNativeShellAvailable } from '@/lib/nativeShell';

describe('confirmNativeShellAvailable', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: {},
      configurable: true,
      writable: true,
    });
    isNativePlatform.mockReset();
    getPlatform.mockReset();
    shellIsAvailable.mockReset();
    isNativePlatform.mockReturnValue(true);
    getPlatform.mockReturnValue('ios');
    shellIsAvailable.mockResolvedValue({ available: true, platform: 'ios' });
  });

  afterEach(() => {
    if (typeof originalWindow === 'undefined') {
      // @ts-expect-error restoring absent window for the node test environment
      delete globalThis.window;
      return;
    }

    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
  });

  it('returns false when not running in a native iOS shell', async () => {
    getPlatform.mockReturnValue('android');

    await expect(confirmNativeShellAvailable()).resolves.toBe(false);
    expect(shellIsAvailable).not.toHaveBeenCalled();
  });

  it('returns true when the native bridge reports the shell is hosting the view', async () => {
    shellIsAvailable.mockResolvedValue({ available: true, platform: 'ios' });

    await expect(confirmNativeShellAvailable()).resolves.toBe(true);
  });

  it('returns false when the shell controller is not the root', async () => {
    shellIsAvailable.mockResolvedValue({ available: false, platform: 'ios' });

    await expect(confirmNativeShellAvailable()).resolves.toBe(false);
  });

  it('returns false when the plugin is not registered (call rejects)', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    shellIsAvailable.mockRejectedValue(new Error('plugin not implemented'));

    await expect(confirmNativeShellAvailable()).resolves.toBe(false);
    warn.mockRestore();
  });
});
