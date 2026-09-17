import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  isNativePlatform,
  getPlatform,
  isPluginAvailable,
  shellIsAvailable,
  shellGetPushEnvironment,
} = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  getPlatform: vi.fn(() => 'web'),
  isPluginAvailable: vi.fn(() => true),
  shellIsAvailable: vi.fn(async () => ({ available: true, platform: 'ios' })),
  shellGetPushEnvironment: vi.fn(async () => ({ environment: null as string | null })),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform,
    getPlatform,
    isPluginAvailable,
  },
  registerPlugin: () => ({
    isAvailable: shellIsAvailable,
    getPushEnvironment: shellGetPushEnvironment,
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

describe('getNativePushEnvironment', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: {},
      configurable: true,
      writable: true,
    });
    vi.resetModules();
    isNativePlatform.mockReset();
    getPlatform.mockReset();
    isPluginAvailable.mockReset();
    shellIsAvailable.mockReset();
    shellGetPushEnvironment.mockReset();
    isNativePlatform.mockReturnValue(true);
    getPlatform.mockReturnValue('ios');
    isPluginAvailable.mockReturnValue(true);
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

  it('resolves the signed environment even though the presentation shell is unavailable', async () => {
    // Regression: the lookup used to gate on isAvailable(), which has returned
    // false since f6fbad5 handed the whole UI to React. That made this resolve
    // null for every device, so user_push_tokens.push_environment was always
    // null and push-dispatch had to try both APNs hosts. The signed push
    // environment is a native service, not a question about who draws the UI.
    shellIsAvailable.mockResolvedValue({ available: false, platform: 'ios' });
    shellGetPushEnvironment.mockResolvedValue({ environment: 'sandbox' });

    const { getNativePushEnvironment } = await import('@/lib/nativeShell');

    await expect(getNativePushEnvironment()).resolves.toBe('sandbox');
    expect(shellGetPushEnvironment).toHaveBeenCalled();
  });

  it('returns null off native iOS without touching the bridge', async () => {
    getPlatform.mockReturnValue('android');

    const { getNativePushEnvironment } = await import('@/lib/nativeShell');

    await expect(getNativePushEnvironment()).resolves.toBeNull();
    expect(shellGetPushEnvironment).not.toHaveBeenCalled();
  });

  it('returns null when the bridge reports an unrecognised environment', async () => {
    shellGetPushEnvironment.mockResolvedValue({ environment: 'staging' });

    const { getNativePushEnvironment } = await import('@/lib/nativeShell');

    await expect(getNativePushEnvironment()).resolves.toBeNull();
  });

  it('caches a resolved environment across calls', async () => {
    shellGetPushEnvironment.mockResolvedValue({ environment: 'production' });

    const { getNativePushEnvironment } = await import('@/lib/nativeShell');

    await expect(getNativePushEnvironment()).resolves.toBe('production');
    await expect(getNativePushEnvironment()).resolves.toBe('production');
    expect(shellGetPushEnvironment).toHaveBeenCalledTimes(1);
  });
});

describe('nativeShell presentation chrome', () => {
  it('does not export dead chrome publish/command/bridge APIs', async () => {
    const nativeShell = await import('@/lib/nativeShell');

    expect(nativeShell).not.toHaveProperty('publishNativeShellChromeState');
    expect(nativeShell).not.toHaveProperty('subscribeNativeShellCommands');
    expect(nativeShell).not.toHaveProperty('registerNativeShellBridge');
    expect(nativeShell).not.toHaveProperty('routeOwnsNativeShellChrome');
    expect(nativeShell).toHaveProperty('getNativePushEnvironment');
    expect(nativeShell).toHaveProperty('confirmNativeShellAvailable');
  });
});
