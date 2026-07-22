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
      refreshRooms: vi.fn(async () => ({ ok: true as const })),
      openBuddy: vi.fn(async () => ({ ok: true as const })),
      openRoom: vi.fn(async () => ({ ok: true as const })),
      updatePresence: vi.fn(async () => ({ ok: true as const })),
      respondToBuddyRequest,
      sendMessage: vi.fn(async () => ({ ok: true as const })),
      closeConversation: vi.fn(async () => ({ ok: true as const })),
      sendTypingPulse: vi.fn(async () => ({ ok: true as const })),
      sendRoomMessage: vi.fn(async () => ({ ok: true as const })),
      closeRoomConversation: vi.fn(async () => ({ ok: true as const })),
      sendRoomTypingPulse: vi.fn(async () => ({ ok: true as const })),
      openProfile: vi.fn(async () => ({ ok: true as const })),
      togglePinned: vi.fn(async () => ({ ok: true as const })),
      toggleMuted: vi.fn(async () => ({ ok: true as const })),
      toggleArchived: vi.fn(async () => ({ ok: true as const })),
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

  it('publishes replyable away messages for native buddies and conversations', async () => {
    await publishNativeMilestoneOneState({
      phase: 'signedIn',
      buddies: [
        {
          id: 'buddy-1',
          screenname: 'coffeehound',
          presence: 'away',
          presenceLabel: 'Away',
          presenceDetail: 'grabbing coffee',
          awayMessage: 'grabbing coffee',
          unreadCount: 0,
          isPinned: false,
        },
      ],
      activeConversation: {
        buddyId: 'buddy-1',
        screenname: 'coffeehound',
        presence: 'away',
        presenceLabel: 'Away',
        presenceDetail: 'grabbing coffee',
        statusLine: null,
        awayMessage: 'grabbing coffee',
        isPinned: false,
        isMuted: false,
        isArchived: false,
        messages: [],
        isLoading: false,
        isSending: false,
      },
    });

    expect(setMilestoneOneState).toHaveBeenCalledWith(
      expect.objectContaining({
        buddies: [expect.objectContaining({ awayMessage: 'grabbing coffee' })],
        activeConversation: expect.objectContaining({ awayMessage: 'grabbing coffee' }),
      }),
    );
  });

  it('publishes joined rooms and the active native room conversation', async () => {
    await publishNativeMilestoneOneState({
      phase: 'signedIn',
      selectedSection: 'rooms',
      rooms: [
        {
          id: 'room-1',
          slug: 'new-york',
          name: 'New York',
          subtitle: 'local plans and people',
          unreadCount: 2,
          isJoined: true,
          activeCount: 2,
          activeScreennames: ['Pakiboy24', 'newbuddy'],
        },
      ],
      activeRoomConversation: {
        roomId: 'room-1',
        roomName: 'New York',
        activeCount: 3,
        participants: [
          { id: 'user-1', screenname: 'Pakiboy24', isMe: true },
          { id: 'user-2', screenname: 'newbuddy', isMe: false },
        ],
        messages: [
          {
            id: 'message-1',
            senderId: 'user-1',
            senderScreenname: 'Pakiboy24',
            content: 'hello room',
            createdAt: '2026-07-22T12:00:00.000Z',
            isMine: true,
          },
        ],
        isLoading: false,
        isSending: false,
      },
    });

    expect(setMilestoneOneState).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedSection: 'rooms',
        rooms: [expect.objectContaining({ id: 'room-1', unreadCount: 2 })],
        activeRoomConversation: expect.objectContaining({ roomId: 'room-1', activeCount: 3 }),
      }),
    );
  });
});
