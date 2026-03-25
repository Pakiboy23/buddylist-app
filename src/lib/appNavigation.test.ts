import { describe, expect, it } from 'vitest';
import { normalizeAppPath } from '@/lib/appNavigation';

describe('normalizeAppPath', () => {
  it('keeps web paths unchanged', () => {
    expect(normalizeAppPath('/buddy-list?dm=123', false)).toBe('/buddy-list?dm=123');
    expect(normalizeAppPath('/', false)).toBe('/');
  });

  it('adds the exported trailing slash for native buddy-list paths', () => {
    expect(normalizeAppPath('/buddy-list', true)).toBe('/buddy-list/');
    expect(normalizeAppPath('/buddy-list?dm=123', true)).toBe('/buddy-list/?dm=123');
    expect(normalizeAppPath('/buddy-list#profile', true)).toBe('/buddy-list/#profile');
  });
});
