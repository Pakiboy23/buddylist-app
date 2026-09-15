import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getSessionMock, signOutMock, authListeners } = vi.hoisted(() => ({
  getSessionMock: vi.fn(),
  signOutMock: vi.fn(),
  authListeners: [] as Array<(event: string, session: unknown) => void>,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: getSessionMock,
      signOut: signOutMock,
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
        authListeners.push(callback);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
  },
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => true,
  },
}));

vi.mock('@/lib/securityEvent', () => ({
  logSecurityEvent: vi.fn(),
}));

import { getSessionOrNull, waitForSessionOrNull } from '@/lib/authClient';

describe('native session lookup after sign-in', () => {
  beforeEach(() => {
    vi.stubGlobal('window', globalThis);
    getSessionMock.mockReset();
    signOutMock.mockReset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('does not locally sign out when getSession reports an invalid refresh token', async () => {
    getSessionMock.mockResolvedValueOnce({
      data: { session: null },
      error: { message: 'Invalid Refresh Token: Refresh Token Not Found' },
    });

    const session = await getSessionOrNull();

    expect(session).toBeNull();
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('does not reuse a pre-login null lookup after SIGNED_IN', async () => {
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });

    const firstLookup = waitForSessionOrNull();

    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(100);

    for (const listener of authListeners) {
      listener('SIGNED_IN', { access_token: 'new-session' });
    }

    getSessionMock.mockResolvedValue({
      data: { session: { access_token: 'new-session', user: { id: 'user-1' } } },
      error: null,
    });

    const afterSignIn = await waitForSessionOrNull();
    expect(afterSignIn?.access_token).toBe('new-session');

    await vi.runAllTimersAsync();
    await firstLookup;
  });
});
