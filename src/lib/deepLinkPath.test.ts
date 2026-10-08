import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveDeepLinkPath } from '@/lib/deepLinkPath';

const RECOVERY_HASH = '#access_token=abc.def&expires_in=3600&refresh_token=r1&type=recovery';

describe('resolveDeepLinkPath', () => {
  it('routes the associated recovery link and preserves tokens and query', () => {
    expect(resolveDeepLinkPath(`https://hiitsme.app/reset-password?next=1${RECOVERY_HASH}`)).toBe(
      `/reset-password?next=1${RECOVERY_HASH}`,
    );
  });

  it.each([
    'HIM://reset-password',
    'HIM://reset-password/',
    'HIM://localhost/reset-password',
    'hiitsme://reset-password',
    'http://hiitsme.app/reset-password',
    'https://hiitsme.app.evil.test/reset-password',
  ])('rejects recovery via an unassociated URL: %s', (url) => {
    expect(resolveDeepLinkPath(`${url}${RECOVERY_HASH}`)).toBeNull();
  });

  it('keeps unrelated custom scheme and universal links working', () => {
    expect(resolveDeepLinkPath('hiitsme:///hi-its-me?dm=buddy-1')).toBe('/hi-its-me?dm=buddy-1');
    expect(resolveDeepLinkPath('https://hiitsme.app/join/room-1')).toBe('/join/room-1');
  });

  it('ignores links with no route', () => {
    expect(resolveDeepLinkPath('HIM://')).toBeNull();
    expect(resolveDeepLinkPath('HIM://localhost')).toBeNull();
    expect(resolveDeepLinkPath('HIM://localhost/')).toBeNull();
    expect(resolveDeepLinkPath('https://hiitsme-app.vercel.app/')).toBeNull();
    expect(resolveDeepLinkPath('not a url')).toBeNull();
  });
});

describe('iOS recovery association', () => {
  const read = (relative: string) => readFileSync(path.resolve(__dirname, '../..', relative), 'utf-8');

  it('uses the same HTTPS callback in the client, association and Supabase allowlist', () => {
    const redirect = read('src/app/page.tsx').match(/NATIVE_RESET_PASSWORD_URL = '([^']+)'/)?.[1];
    expect(redirect).toBe('https://hiitsme.app/reset-password');
    const url = new URL(redirect!);
    expect(read('ios/App/App/App.entitlements')).toContain(`<string>applinks:${url.host}</string>`);
    const association = JSON.parse(read('public/.well-known/apple-app-site-association'));
    expect(association.applinks.details).toContainEqual({
      appID: '6KTSZRW2J6.com.hiitsme.app',
      paths: expect.arrayContaining([url.pathname]),
    });
    expect(read('supabase/config.toml')).toContain(`"${redirect}"`);
    expect(read('supabase/config.toml')).not.toContain('HIM://reset-password');
    expect(read('ios/App/App/Info.plist')).not.toContain('<string>HIM</string>');
  });
});
