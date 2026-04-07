import { describe, expect, it } from 'vitest';
import { normalizeAppPath } from '@/lib/appNavigation';

describe('normalizeAppPath', () => {
  it('keeps web paths unchanged', () => {
    expect(normalizeAppPath('/hi-its-me?dm=123', false)).toBe('/hi-its-me?dm=123');
    expect(normalizeAppPath('/', false)).toBe('/');
  });

  it('adds the exported trailing slash for native hi-its-me paths', () => {
    expect(normalizeAppPath('/hi-its-me', true)).toBe('/hi-its-me/');
    expect(normalizeAppPath('/hi-its-me?dm=123', true)).toBe('/hi-its-me/?dm=123');
    expect(normalizeAppPath('/hi-its-me#profile', true)).toBe('/hi-its-me/#profile');
  });
});
