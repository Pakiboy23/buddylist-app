import { Capacitor } from '@capacitor/core';
import type { SupportedStorage } from '@supabase/supabase-js';
import {
  getNativePersistentItem,
  removeNativePersistentItem,
  setNativePersistentItem,
} from '@/lib/nativePersistentKv';

export interface PersistentKv {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

interface LocalStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface CreateHimAuthStorageOptions {
  isNative?: boolean;
  localStore?: LocalStore;
  nativeStore?: PersistentKv | null;
}

function defaultLocalStore(): LocalStore | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const storage = window.localStorage;
    const probeKey = '__him_auth_storage_probe__';
    storage.setItem(probeKey, '1');
    storage.removeItem(probeKey);
    return storage;
  } catch {
    return null;
  }
}

const memoryStore = new Map<string, string>();

function readLocal(store: LocalStore | null, key: string): string | null {
  if (store) {
    try {
      return store.getItem(key);
    } catch {
      return memoryStore.get(key) ?? null;
    }
  }
  return memoryStore.get(key) ?? null;
}

function writeLocal(store: LocalStore | null, key: string, value: string) {
  if (store) {
    try {
      store.setItem(key, value);
      return;
    } catch {
      // Fall through to memory.
    }
  }
  memoryStore.set(key, value);
}

function removeLocal(store: LocalStore | null, key: string) {
  if (store) {
    try {
      store.removeItem(key);
    } catch {
      // Ignore and drop the memory copy.
    }
  }
  memoryStore.delete(key);
}

/**
 * Supabase auth storage that keeps the session in native UserDefaults on
 * Capacitor iOS (survives WKWebView site-data wipes and iOS localStorage
 * eviction) and in localStorage on web.
 */
export function createHimAuthStorage(options: CreateHimAuthStorageOptions = {}): SupportedStorage {
  const isNative = options.isNative ?? (typeof window !== 'undefined' && Capacitor.isNativePlatform());
  const localStore = options.localStore ?? defaultLocalStore();
  const nativeStore =
    options.nativeStore === undefined
      ? isNative
        ? {
            getItem: getNativePersistentItem,
            setItem: setNativePersistentItem,
            removeItem: removeNativePersistentItem,
          }
        : null
      : options.nativeStore;

  return {
    async getItem(key: string) {
      if (nativeStore) {
        const nativeValue = await nativeStore.getItem(key);
        if (typeof nativeValue === 'string' && nativeValue.length > 0) {
          writeLocal(localStore, key, nativeValue);
          return nativeValue;
        }
      }

      const localValue = readLocal(localStore, key);
      if (localValue && nativeStore) {
        await nativeStore.setItem(key, localValue);
      }
      return localValue;
    },
    async setItem(key: string, value: string) {
      writeLocal(localStore, key, value);
      if (nativeStore) {
        await nativeStore.setItem(key, value);
      }
    },
    async removeItem(key: string) {
      removeLocal(localStore, key);
      if (nativeStore) {
        await nativeStore.removeItem(key);
      }
    },
  };
}
