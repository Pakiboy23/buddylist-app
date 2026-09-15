import { describe, expect, it, vi } from 'vitest';
import { createHimAuthStorage } from '@/lib/himAuthStorage';

function memoryLocalStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (key: string) => (key in data ? data[key] : null),
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    removeItem: (key: string) => {
      delete data[key];
    },
    snapshot: () => data,
  };
}

function memoryNativeStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: vi.fn(async (key: string) => (key in data ? data[key] : null)),
    setItem: vi.fn(async (key: string, value: string) => {
      data[key] = value;
    }),
    removeItem: vi.fn(async (key: string) => {
      delete data[key];
    }),
    snapshot: () => data,
  };
}

describe('createHimAuthStorage', () => {
  it('uses localStorage on web', async () => {
    const localStore = memoryLocalStore();
    const storage = createHimAuthStorage({ isNative: false, localStore });

    await storage.setItem('sb-auth-token', '{"access_token":"web"}');
    expect(await storage.getItem('sb-auth-token')).toBe('{"access_token":"web"}');
    await storage.removeItem('sb-auth-token');
    expect(await storage.getItem('sb-auth-token')).toBeNull();
  });

  it('prefers native UserDefaults on Capacitor and dual-writes localStorage', async () => {
    const localStore = memoryLocalStore();
    const nativeStore = memoryNativeStore();
    const storage = createHimAuthStorage({ isNative: true, localStore, nativeStore });

    await storage.setItem('sb-auth-token', '{"access_token":"native"}');

    expect(nativeStore.snapshot()['sb-auth-token']).toBe('{"access_token":"native"}');
    expect(localStore.snapshot()['sb-auth-token']).toBe('{"access_token":"native"}');
    expect(await storage.getItem('sb-auth-token')).toBe('{"access_token":"native"}');
  });

  it('migrates a localStorage-only session into native storage', async () => {
    const localStore = memoryLocalStore({ 'sb-auth-token': '{"access_token":"legacy"}' });
    const nativeStore = memoryNativeStore();
    const storage = createHimAuthStorage({ isNative: true, localStore, nativeStore });

    expect(await storage.getItem('sb-auth-token')).toBe('{"access_token":"legacy"}');
    expect(nativeStore.snapshot()['sb-auth-token']).toBe('{"access_token":"legacy"}');
  });

  it('survives a WKWebView localStorage wipe when native still has the session', async () => {
    const localStore = memoryLocalStore();
    const nativeStore = memoryNativeStore({ 'sb-auth-token': '{"access_token":"kept"}' });
    const storage = createHimAuthStorage({ isNative: true, localStore, nativeStore });

    expect(await storage.getItem('sb-auth-token')).toBe('{"access_token":"kept"}');
  });
});
