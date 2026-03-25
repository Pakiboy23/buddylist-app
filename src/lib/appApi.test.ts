import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { isNativePlatform } = vi.hoisted(() => ({
  isNativePlatform: vi.fn(() => false),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform,
  },
}));

import { getAppApiUrl } from '@/lib/appApi';

describe('getAppApiUrl', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'window', {
      value: {},
      configurable: true,
      writable: true,
    });
    isNativePlatform.mockReset();
  });

  afterEach(() => {
    if (typeof originalWindow === 'undefined') {
      // @ts-expect-error restoring absent window for node test environment
      delete globalThis.window;
      return;
    }

    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      configurable: true,
      writable: true,
    });
  });

  it('keeps same-origin urls on web', () => {
    isNativePlatform.mockReturnValue(false);
    expect(getAppApiUrl('/api/admin/me')).toBe('/api/admin/me');
  });

  it('uses the hosted backend origin on native platforms', () => {
    isNativePlatform.mockReturnValue(true);
    expect(getAppApiUrl('/api/admin/me')).toBe('https://buddylist-app.vercel.app/api/admin/me');
  });
});
