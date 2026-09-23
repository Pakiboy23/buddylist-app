import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveDeepLinkPath } from '@/lib/deepLinkPath';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LOGIN_PAGE = path.join(REPO_ROOT, 'src/app/page.tsx');
const INFO_PLIST = path.join(REPO_ROOT, 'ios/App/App/Info.plist');

const RECOVERY_HASH = '#access_token=tok&refresh_token=ref&type=recovery';

describe('resolveDeepLinkPath', () => {
  it('maps HIM://reset-password host-as-path and keeps the recovery hash', () => {
    expect(resolveDeepLinkPath(`HIM://reset-password${RECOVERY_HASH}`)).toBe(
      `/reset-password${RECOVERY_HASH}`,
    );
  });

  it('maps hiitsme://reset-password the same way', () => {
    expect(resolveDeepLinkPath(`hiitsme://reset-password${RECOVERY_HASH}`)).toBe(
      `/reset-password${RECOVERY_HASH}`,
    );
  });

  it('keeps pathname routes from https and Capacitor-localhost URLs', () => {
    expect(
      resolveDeepLinkPath(`https://hiitsme.app/reset-password${RECOVERY_HASH}`),
    ).toBe(`/reset-password${RECOVERY_HASH}`);
    expect(
      resolveDeepLinkPath(`HIM://localhost/reset-password${RECOVERY_HASH}`),
    ).toBe(`/reset-password${RECOVERY_HASH}`);
    expect(resolveDeepLinkPath('https://hiitsme.app/join/abc123')).toBe('/join/abc123');
  });

  it('returns null for empty or root custom-scheme URLs', () => {
    expect(resolveDeepLinkPath('HIM://localhost')).toBeNull();
    expect(resolveDeepLinkPath('HIM://localhost/')).toBeNull();
    expect(resolveDeepLinkPath('not a url')).toBeNull();
  });
});

describe('iOS password-reset deep link contracts', () => {
  it('sends native reset emails to the HIM custom scheme', () => {
    const source = readFileSync(LOGIN_PAGE, 'utf-8');
    expect(source).toMatch(/NATIVE_RESET_PASSWORD_URL\s*=\s*'HIM:\/\/reset-password'/);
  });

  it('registers HIM so Mail/Safari can open the reset redirect', () => {
    const plist = readFileSync(INFO_PLIST, 'utf-8');
    expect(plist).toMatch(/<string>HIM<\/string>/);
    expect(plist).toMatch(/<string>hiitsme<\/string>/);
  });
});
