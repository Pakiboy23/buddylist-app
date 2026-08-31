import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  isNativePlatform,
  getPlatform,
  isPluginAvailable,
  shellIsAvailable,
  shellGetPushEnvironment,
  shellSetChromeState,
} = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  getPlatform: vi.fn(() => 'web'),
  isPluginAvailable: vi.fn(() => true),
  shellIsAvailable: vi.fn(async () => ({ available: true, platform: 'ios' })),
  shellGetPushEnvironment: vi.fn(async () => ({ environment: null as string | null })),
  shellSetChromeState: vi.fn(async () => undefined),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform,
    getPlatform,
    isPluginAvailable,
  },
  registerPlugin: () => ({
    isAvailable: shellIsAvailable,
    setChromeState: shellSetChromeState,
    getPushEnvironment: shellGetPushEnvironment,
  }),
}));

import {
  confirmNativeShellAvailable,
  routeOwnsNativeShellChrome,
  type NativeShellChromeState,
} from '@/lib/nativeShell';

describe('routeOwnsNativeShellChrome', () => {
  it('lets the main shell page own the chrome, with or without the native trailing slash', () => {
    expect(routeOwnsNativeShellChrome('/hi-its-me')).toBe(true);
    expect(routeOwnsNativeShellChrome('/hi-its-me/')).toBe(true);
  });

  it('hides the native chrome on standalone /hi-its-me sub-routes so their taps are never dropped', () => {
    // Regression: these routes have no native-command subscriber. Leaving the
    // chrome up made the tab bar and back button dead, which users reported as
    // the app freezing after opening a chat room.
    expect(routeOwnsNativeShellChrome('/hi-its-me/rooms')).toBe(false);
    expect(routeOwnsNativeShellChrome('/hi-its-me/rooms/new')).toBe(false);
    expect(routeOwnsNativeShellChrome('/hi-its-me/rooms/123e4567/preview')).toBe(false);
  });

  it('hides the native chrome on non-shell routes', () => {
    expect(routeOwnsNativeShellChrome('/account')).toBe(false);
    expect(routeOwnsNativeShellChrome('/')).toBe(false);
  });
});

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

describe('publishNativeShellChromeState', () => {
  const originalWindow = globalThis.window;
  const baseState: NativeShellChromeState = {
    title: 'H.I.M.',
    subtitle: null,
    mode: 'sheet',
    activeTab: 'im',
    tabBarVisibility: 'hidden',
    leadingAction: null,
    trailingActions: [],
    accentTone: 'amber',
    canGoBack: false,
    showsTopChrome: false,
    showsBottomChrome: false,
  };

  beforeEach(() => {
    vi.resetModules();
    vi.useRealTimers();
    Object.defineProperty(globalThis, 'window', {
      value: { setTimeout: globalThis.setTimeout },
      configurable: true,
      writable: true,
    });
    isNativePlatform.mockReset();
    getPlatform.mockReset();
    shellIsAvailable.mockReset();
    shellSetChromeState.mockReset();
    isNativePlatform.mockReturnValue(true);
    getPlatform.mockReturnValue('ios');
    shellIsAvailable.mockResolvedValue({ available: true, platform: 'ios' });
    shellSetChromeState.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
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

  it('attaches a monotonic sequence and drops an older availability result after a newer publish starts', async () => {
    const availabilityResolvers: Array<(value: { available: boolean; platform: string }) => void> = [];
    shellIsAvailable.mockImplementation(
      () => new Promise((resolve) => availabilityResolvers.push(resolve)),
    );

    const { publishNativeShellChromeState } = await import('@/lib/nativeShell');

    const olderPublish = publishNativeShellChromeState({ ...baseState, title: 'Older route' });
    await Promise.resolve();
    const newerPublish = publishNativeShellChromeState({ ...baseState, title: 'Current route' });
    await Promise.resolve();

    expect(shellIsAvailable).toHaveBeenCalledTimes(2);

    availabilityResolvers[1]?.({ available: true, platform: 'ios' });
    await newerPublish;

    availabilityResolvers[0]?.({ available: true, platform: 'ios' });
    await olderPublish;

    expect(shellSetChromeState).toHaveBeenCalledTimes(1);
    expect(shellSetChromeState).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Current route', sequence: 2 }),
    );
  });

  it('stops retrying a failed older publish once a newer state is published', async () => {
    vi.useFakeTimers();
    Object.defineProperty(globalThis, 'window', {
      value: { setTimeout: globalThis.setTimeout },
      configurable: true,
      writable: true,
    });
    shellSetChromeState.mockRejectedValueOnce(new Error('bridge busy'));

    const { publishNativeShellChromeState } = await import('@/lib/nativeShell');

    const olderPublish = publishNativeShellChromeState({ ...baseState, title: 'Retrying route' });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(shellSetChromeState).toHaveBeenCalledTimes(1);
    expect(shellSetChromeState).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ title: 'Retrying route', sequence: 1 }),
    );

    const newerPublish = publishNativeShellChromeState({ ...baseState, title: 'Replacement route' });
    await Promise.resolve();
    await Promise.resolve();

    expect(shellSetChromeState).toHaveBeenCalledTimes(2);
    expect(shellSetChromeState).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ title: 'Replacement route', sequence: 2 }),
    );

    await vi.advanceTimersByTimeAsync(120);
    await Promise.all([olderPublish, newerPublish]);

    expect(shellSetChromeState).toHaveBeenCalledTimes(2);
  });

  it('retries bridge failures for the current publish and keeps the same sequence', async () => {
    vi.useFakeTimers();
    Object.defineProperty(globalThis, 'window', {
      value: { setTimeout: globalThis.setTimeout },
      configurable: true,
      writable: true,
    });
    shellSetChromeState.mockRejectedValueOnce(new Error('bridge warming'));

    const { publishNativeShellChromeState } = await import('@/lib/nativeShell');

    const publish = publishNativeShellChromeState({ ...baseState, title: 'Current route' });
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(shellSetChromeState).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(120);
    await publish;

    expect(shellSetChromeState).toHaveBeenCalledTimes(2);
    expect(shellSetChromeState).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ title: 'Current route', sequence: 1 }),
    );
  });

  it('does not touch the bridge off native iOS', async () => {
    getPlatform.mockReturnValue('android');

    const { publishNativeShellChromeState } = await import('@/lib/nativeShell');

    await publishNativeShellChromeState(baseState);

    expect(shellIsAvailable).not.toHaveBeenCalled();
    expect(shellSetChromeState).not.toHaveBeenCalled();
  });

  it('does not call setChromeState when the native presentation shell is unavailable', async () => {
    shellIsAvailable.mockResolvedValue({ available: false, platform: 'ios' });

    const { publishNativeShellChromeState } = await import('@/lib/nativeShell');

    await publishNativeShellChromeState(baseState);

    expect(shellIsAvailable).toHaveBeenCalledTimes(1);
    expect(shellSetChromeState).not.toHaveBeenCalled();
  });
});
