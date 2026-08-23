import { describe, expect, it } from 'vitest';
import {
  PORCH_ADD_ME,
  PORCH_HEADLINE,
  PORCH_LEDE,
  PORCH_ROOMS,
  publicCopyIsClean,
  shouldShowWebPorch,
} from '@/lib/webPorch';

describe('shouldShowWebPorch', () => {
  it('never shows on native, even at /', () => {
    expect(shouldShowWebPorch({ native: true, pathname: '/', search: '' })).toBe(false);
  });

  it('shows on web logged-out /', () => {
    expect(shouldShowWebPorch({ native: false, pathname: '/', search: '' })).toBe(true);
    expect(shouldShowWebPorch({ native: false, pathname: '/', search: '?utm_source=instagram' })).toBe(
      true,
    );
  });

  it('keeps LoginPage for ?signin=1 and /signin', () => {
    expect(shouldShowWebPorch({ native: false, pathname: '/', search: '?signin=1' })).toBe(false);
    expect(shouldShowWebPorch({ native: false, pathname: '/signin', search: '' })).toBe(false);
    expect(shouldShowWebPorch({ native: false, pathname: '/signin', search: '?signup=1' })).toBe(false);
  });
});

describe('porch copy', () => {
  it('names seven rooms and stays inside public-copy rules', () => {
    expect(PORCH_ROOMS).toHaveLength(7);
    const blob = [PORCH_HEADLINE, PORCH_LEDE, PORCH_ADD_ME, ...PORCH_ROOMS.map((r) => `${r.name} ${r.blurb}`)].join(
      ' ',
    );
    expect(publicCopyIsClean(blob)).toBe(true);
    expect(blob.toLowerCase()).toContain('friends, not dates');
    expect(blob).toContain('Pakiboy24');
  });
});
