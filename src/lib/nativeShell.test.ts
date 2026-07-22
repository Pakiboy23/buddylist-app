import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  isNativePlatform,
  getPlatform,
  isPluginAvailable,
  shellIsAvailable,
  setMilestoneOneState,
} = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
  getPlatform: vi.fn(() => 'web'),
  isPluginAvailable: vi.fn(() => true),
  shellIsAvailable: vi.fn(async () => ({ available: true, platform: 'ios' })),
  setMilestoneOneState: vi.fn(async () => undefined),
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
    setMilestoneOneState,
    getPushEnvironment: vi.fn(async () => ({ environment: null })),
  }),
}));

import {
  confirmNativeShellAvailable,
  publishNativeMilestoneOneState,
  registerNativeMilestoneOneBridge,
  routeOwnsNativeShellChrome,
  type NativeMilestoneOneBridge,
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
    setMilestoneOneState.mockReset();
    isNativePlatform.mockReturnValue(true);
    getPlatform.mockReturnValue('ios');
    shellIsAvailable.mockResolvedValue({ available: true, platform: 'ios' });
    setMilestoneOneState.mockResolvedValue(undefined);
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

describe('native milestone-one request bridge', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: {},
      configurable: true,
      writable: true,
    });
    isNativePlatform.mockReturnValue(true);
    getPlatform.mockReturnValue('ios');
    shellIsAvailable.mockResolvedValue({ available: true, platform: 'ios' });
    setMilestoneOneState.mockClear();
  });

  afterEach(() => {
    registerNativeMilestoneOneBridge(null);
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

  it('registers the native accept/decline action and removes it during cleanup', async () => {
    const respondToBuddyRequest = vi.fn(async () => ({ ok: true as const }));
    const bridge: NativeMilestoneOneBridge = {
      signIn: vi.fn(async () => ({ ok: true as const })),
      refreshBuddyList: vi.fn(async () => ({ ok: true as const })),
      openBuddy: vi.fn(async () => ({ ok: true as const })),
      updatePresence: vi.fn(async () => ({ ok: true as const })),
      respondToBuddyRequest,
      signOut: vi.fn(async () => ({ ok: true as const })),
      showWebAuth: vi.fn(async () => ({ ok: true as const })),
    };

    registerNativeMilestoneOneBridge(bridge);
    await expect(
      window.__hiItsMeNativeMilestoneOne?.respondToBuddyRequest('requester-1', 'accept'),
    ).resolves.toEqual({ ok: true });
    expect(respondToBuddyRequest).toHaveBeenCalledWith('requester-1', 'accept');

    registerNativeMilestoneOneBridge(null);
    expect(window.__hiItsMeNativeMilestoneOne).toBeUndefined();
  });

  it('publishes pending request identities for the native BuddyList', async () => {
    await publishNativeMilestoneOneState({
      phase: 'signedIn',
      pendingRequestCount: 1,
      pendingRequests: [{ id: 'requester-1', screenname: 'newbuddy' }],
    });

    expect(setMilestoneOneState).toHaveBeenCalledWith(
      expect.objectContaining({
        pendingRequestCount: 1,
        pendingRequests: [{ id: 'requester-1', screenname: 'newbuddy' }],
      }),
    );
  });
});
