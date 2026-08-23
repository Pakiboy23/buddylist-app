import { describe, expect, it } from 'vitest';
import { resolveAuthLanding } from '@/lib/authLanding';

describe('resolveAuthLanding', () => {
  it('always keeps native on the sign-in card', () => {
    expect(resolveAuthLanding({ isNative: true, pathname: '/', search: '' })).toBe('signin');
    expect(resolveAuthLanding({ isNative: true, pathname: '/signin', search: '' })).toBe('signin');
    expect(resolveAuthLanding({ isNative: true, pathname: '/', search: '?utm_source=instagram' })).toBe('signin');
  });

  it('shows the porch to logged-out web visitors on /', () => {
    expect(resolveAuthLanding({ isNative: false, pathname: '/', search: '' })).toBe('porch');
  });

  it('keeps UTM landings on the porch — attribution params are not a signin intent', () => {
    expect(
      resolveAuthLanding({ isNative: false, pathname: '/', search: '?utm_source=instagram&utm_campaign=him_v2_2' }),
    ).toBe('porch');
    expect(resolveAuthLanding({ isNative: false, pathname: '/', search: '?ref=porch' })).toBe('porch');
  });

  it('keeps /signin on the login card, trailing slash included', () => {
    expect(resolveAuthLanding({ isNative: false, pathname: '/signin', search: '' })).toBe('signin');
    expect(resolveAuthLanding({ isNative: false, pathname: '/signin/', search: '' })).toBe('signin');
  });

  it('honors the legacy ?signin=1 links', () => {
    expect(resolveAuthLanding({ isNative: false, pathname: '/', search: '?signin=1' })).toBe('signin');
    expect(resolveAuthLanding({ isNative: false, pathname: '/', search: '?signin=1&utm_source=x' })).toBe('signin');
  });

  it('treats ?create=1 as signin intent so create-account deep links skip the porch', () => {
    expect(resolveAuthLanding({ isNative: false, pathname: '/', search: '?create=1' })).toBe('signin');
    expect(resolveAuthLanding({ isNative: false, pathname: '/signin', search: '?create=1' })).toBe('signin');
  });

  it('does not treat other signin values as intent', () => {
    expect(resolveAuthLanding({ isNative: false, pathname: '/', search: '?signin=0' })).toBe('porch');
  });
});
