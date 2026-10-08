import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveDeepLinkPath } from '@/lib/deepLinkPath';

const RECOVERY_HASH = '#access_token=abc.def&expires_in=3600&refresh_token=r1&type=recovery';

describe('resolveDeepLinkPath', () => {
  it('routes the iOS password reset redirect and keeps the recovery tokens', () => {
    expect(resolveDeepLinkPath(`HIM://reset-password${RECOVERY_HASH}`)).toBe(`/reset-password${RECOVERY_HASH}`);
  });

  it('treats a trailing slash after the host the same way', () => {
    expect(resolveDeepLinkPath(`HIM://reset-password/${RECOVERY_HASH}`)).toBe(`/reset-password${RECOVERY_HASH}`);
  });

  it('routes hiitsme host-style links and keeps the query', () => {
    expect(resolveDeepLinkPath('hiitsme://reset-password?next=1#t')).toBe('/reset-password?next=1#t');
  });

  it('keeps path-style custom scheme links working', () => {
    expect(resolveDeepLinkPath('hiitsme:///hi-its-me?dm=buddy-1')).toBe('/hi-its-me?dm=buddy-1');
    expect(resolveDeepLinkPath(`HIM://localhost/reset-password${RECOVERY_HASH}`)).toBe(
      `/reset-password${RECOVERY_HASH}`,
    );
  });

  it('keeps universal links on their pathname', () => {
    expect(resolveDeepLinkPath(`https://hiitsme-app.vercel.app/reset-password${RECOVERY_HASH}`)).toBe(
      `/reset-password${RECOVERY_HASH}`,
    );
  });

  it('ignores links with no route', () => {
    expect(resolveDeepLinkPath('HIM://')).toBeNull();
    expect(resolveDeepLinkPath('HIM://localhost')).toBeNull();
    expect(resolveDeepLinkPath('HIM://localhost/')).toBeNull();
    expect(resolveDeepLinkPath('https://hiitsme-app.vercel.app/')).toBeNull();
    expect(resolveDeepLinkPath('not a url')).toBeNull();
  });
});

describe('iOS URL scheme registration', () => {
  const read = (relative: string) => readFileSync(path.resolve(__dirname, '../..', relative), 'utf-8');

  it('registers the scheme the native reset email redirects to, alongside hiitsme', () => {
    const plist = read('ios/App/App/Info.plist');
    const schemesBlock = plist.match(/<key>CFBundleURLSchemes<\/key>\s*<array>([\s\S]*?)<\/array>/)?.[1] ?? '';
    const schemes = [...schemesBlock.matchAll(/<string>([^<]+)<\/string>/g)].map((match) => match[1]);

    const redirect = read('src/app/page.tsx').match(/NATIVE_RESET_PASSWORD_URL = '([A-Za-z][A-Za-z0-9+.-]*):\/\//)?.[1];
    expect(redirect).toBe('HIM');
    expect(schemes).toContain('hiitsme');
    expect(schemes.map((scheme) => scheme.toLowerCase())).toContain(redirect!.toLowerCase());
  });
});
