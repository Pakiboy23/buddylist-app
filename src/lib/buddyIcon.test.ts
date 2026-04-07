import { beforeEach, describe, expect, it, vi } from 'vitest';

const { from, getPublicUrl } = vi.hoisted(() => {
  const hoistedGetPublicUrl = vi.fn((storagePath: string) => ({
    data: { publicUrl: `https://cdn.example.test/${storagePath}` },
  }));
  const hoistedFrom = vi.fn(() => ({ getPublicUrl: hoistedGetPublicUrl }));
  return {
    from: hoistedFrom,
    getPublicUrl: hoistedGetPublicUrl,
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from,
    },
  },
}));

import { BUDDY_ICON_BUCKET, resolveBuddyIconUrl } from '@/lib/buddyIcon';

describe('resolveBuddyIconUrl', () => {
  beforeEach(() => {
    from.mockClear();
    getPublicUrl.mockClear();
  });

  it('passes through direct image urls unchanged', () => {
    expect(resolveBuddyIconUrl('blob:https://hiitsme.app/avatar-123')).toBe(
      'blob:https://hiitsme.app/avatar-123',
    );
    expect(resolveBuddyIconUrl('https://hiitsme.app/avatar.png')).toBe('https://hiitsme.app/avatar.png');
    expect(resolveBuddyIconUrl('/avatars/local-preview.png')).toBe('/avatars/local-preview.png');
    expect(from).not.toHaveBeenCalled();
  });

  it('converts storage paths into public bucket urls', () => {
    expect(resolveBuddyIconUrl('user-1/profile/avatar.png')).toBe(
      'https://cdn.example.test/user-1/profile/avatar.png',
    );
    expect(from).toHaveBeenCalledWith(BUDDY_ICON_BUCKET);
    expect(getPublicUrl).toHaveBeenCalledWith('user-1/profile/avatar.png');
  });

  it('returns null for empty input', () => {
    expect(resolveBuddyIconUrl(null)).toBeNull();
    expect(resolveBuddyIconUrl('   ')).toBeNull();
  });
});
