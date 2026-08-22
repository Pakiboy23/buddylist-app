import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { isNativePlatformMock } = vi.hoisted(() => ({
  isNativePlatformMock: vi.fn(() => false),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: isNativePlatformMock },
}));

import {
  captureAcquisitionSource,
  readAcquisitionSource,
  resolveAcquisitionSource,
  DIRECT_SOURCE,
} from '@/lib/acquisitionSource';

const STORAGE_KEY = 'him.acquisition_source';

// The suite runs on vitest's node environment (no jsdom in this repo), so the
// handful of browser globals the module touches are stubbed by hand.
function createMemoryStorage() {
  const entries = new Map<string, string>();
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, String(value));
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
    clear: () => {
      entries.clear();
    },
  };
}

type StubWindow = { sessionStorage: ReturnType<typeof createMemoryStorage>; location: { search: string } };

function stubWindow(search = ''): StubWindow {
  const win: StubWindow = { sessionStorage: createMemoryStorage(), location: { search } };
  (globalThis as { window?: unknown }).window = win;
  return win;
}

describe('acquisitionSource', () => {
  let win: StubWindow;

  beforeEach(() => {
    isNativePlatformMock.mockReset();
    isNativePlatformMock.mockReturnValue(false);
    win = stubWindow();
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  describe('resolveAcquisitionSource', () => {
    it('prefers utm_source', () => {
      expect(resolveAcquisitionSource('?utm_source=instagram&utm_medium=social&ref=x'))
        .toBe('instagram');
    });

    it('falls back to utm_medium, then ref, then direct', () => {
      expect(resolveAcquisitionSource('?utm_medium=social&ref=x')).toBe('social');
      expect(resolveAcquisitionSource('?ref=newsletter')).toBe('newsletter');
      expect(resolveAcquisitionSource('')).toBe(DIRECT_SOURCE);
    });

    it('skips params that are present but empty', () => {
      expect(resolveAcquisitionSource('?utm_source=&utm_medium=reddit')).toBe('reddit');
      expect(resolveAcquisitionSource('?utm_source=%20%20')).toBe(DIRECT_SOURCE);
    });

    it('lowercases and reduces values to a plain token', () => {
      expect(resolveAcquisitionSource('?utm_source=Instagram')).toBe('instagram');
      expect(resolveAcquisitionSource('?utm_source=reddit%20r%2Fnostalgia'))
        .toBe('reddit-r-nostalgia');
      expect(resolveAcquisitionSource('?utm_source=%3Cscript%3E')).toBe('script');
    });

    it('caps absurd values at 64 characters', () => {
      expect(resolveAcquisitionSource(`?utm_source=${'a'.repeat(500)}`)).toHaveLength(64);
    });
  });

  describe('captureAcquisitionSource', () => {
    it('stores the first touch and returns it', () => {
      expect(captureAcquisitionSource('?utm_source=instagram')).toBe('instagram');
      expect(readAcquisitionSource()).toBe('instagram');
    });

    it('reads window.location.search when no search is passed', () => {
      win.location.search = '?utm_source=tiktok';
      expect(captureAcquisitionSource()).toBe('tiktok');
      expect(readAcquisitionSource()).toBe('tiktok');
    });

    it('never overwrites the first touch', () => {
      captureAcquisitionSource('?utm_source=instagram');
      expect(captureAcquisitionSource('?utm_source=tiktok')).toBe('instagram');
      expect(captureAcquisitionSource('')).toBe('instagram');
      expect(readAcquisitionSource()).toBe('instagram');
    });

    it('treats a paramless landing as a real first touch of direct', () => {
      expect(captureAcquisitionSource('')).toBe(DIRECT_SOURCE);
      expect(captureAcquisitionSource('?utm_source=instagram')).toBe(DIRECT_SOURCE);
    });

    it('survives the create-account toggle, which only re-renders the form', () => {
      captureAcquisitionSource('?utm_source=instagram');
      // The toggle does not remount the tab, so the value is still readable
      // at the moment signup actually submits.
      expect(readAcquisitionSource()).toBe('instagram');
    });

    it('does nothing on native', () => {
      isNativePlatformMock.mockReturnValue(true);
      expect(captureAcquisitionSource('?utm_source=instagram')).toBeNull();
      expect(readAcquisitionSource()).toBeNull();
      expect(win.sessionStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('returns null on native even when a web capture already happened', () => {
      captureAcquisitionSource('?utm_source=instagram');
      isNativePlatformMock.mockReturnValue(true);
      expect(readAcquisitionSource()).toBeNull();
    });

    it('does not throw when sessionStorage is unavailable', () => {
      win.sessionStorage.getItem = () => {
        throw new Error('denied');
      };
      win.sessionStorage.setItem = () => {
        throw new Error('denied');
      };

      expect(() => captureAcquisitionSource('?utm_source=instagram')).not.toThrow();
      expect(readAcquisitionSource()).toBeNull();
    });
  });

  describe('readAcquisitionSource', () => {
    it('is null before anything is captured', () => {
      expect(readAcquisitionSource()).toBeNull();
    });
  });
});
