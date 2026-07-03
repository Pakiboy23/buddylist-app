import { beforeEach, describe, expect, it, vi } from 'vitest';

const { from, getPublicUrl, createSignedUrl } = vi.hoisted(() => {
  const hoistedGetPublicUrl = vi.fn((storagePath: string) => ({
    data: { publicUrl: `https://cdn.example.test/public/${storagePath}` },
  }));
  const hoistedCreateSignedUrl = vi.fn(async (storagePath: string, _ttl: number) => ({
    data: { signedUrl: `https://cdn.example.test/signed/${storagePath}?token=abc` },
    error: null,
  }));
  const hoistedFrom = vi.fn(() => ({
    getPublicUrl: hoistedGetPublicUrl,
    createSignedUrl: hoistedCreateSignedUrl,
  }));
  return {
    from: hoistedFrom,
    getPublicUrl: hoistedGetPublicUrl,
    createSignedUrl: hoistedCreateSignedUrl,
  };
});

vi.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from,
    },
  },
}));

import {
  clearChatMediaUrlCacheForTesting,
  peekChatMediaUrl,
  resolveChatMediaUrl,
} from '@/lib/chatMediaUrl';

describe('resolveChatMediaUrl', () => {
  beforeEach(() => {
    clearChatMediaUrlCacheForTesting();
    from.mockClear();
    getPublicUrl.mockClear();
    createSignedUrl.mockClear();
  });

  it('returns a signed url and caches it for subsequent calls', async () => {
    const first = await resolveChatMediaUrl('chat-media', 'user-1/2026/07/03/file.png');
    expect(first).toBe('https://cdn.example.test/signed/user-1/2026/07/03/file.png?token=abc');
    expect(createSignedUrl).toHaveBeenCalledTimes(1);

    const second = await resolveChatMediaUrl('chat-media', 'user-1/2026/07/03/file.png');
    expect(second).toBe(first);
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent requests for the same object', async () => {
    const [a, b] = await Promise.all([
      resolveChatMediaUrl('chat-media', 'user-1/a.png'),
      resolveChatMediaUrl('chat-media', 'user-1/a.png'),
    ]);
    expect(a).toBe(b);
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
  });

  it('falls back to the public url when signing fails', async () => {
    createSignedUrl.mockResolvedValueOnce({ data: { signedUrl: '' }, error: null });
    const url = await resolveChatMediaUrl('chat-media', 'user-1/broken.png');
    expect(url).toBe('https://cdn.example.test/public/user-1/broken.png');
  });

  it('falls back to the public url when signing throws', async () => {
    createSignedUrl.mockRejectedValueOnce(new Error('network down'));
    const url = await resolveChatMediaUrl('chat-media', 'user-1/offline.png');
    expect(url).toBe('https://cdn.example.test/public/user-1/offline.png');
  });

  it('does not cache fallback urls so signing is retried next call', async () => {
    createSignedUrl.mockRejectedValueOnce(new Error('network down'));
    await resolveChatMediaUrl('chat-media', 'user-1/retry.png');

    const url = await resolveChatMediaUrl('chat-media', 'user-1/retry.png');
    expect(url).toBe('https://cdn.example.test/signed/user-1/retry.png?token=abc');
    expect(createSignedUrl).toHaveBeenCalledTimes(2);
  });
});

describe('peekChatMediaUrl', () => {
  beforeEach(() => {
    clearChatMediaUrlCacheForTesting();
    getPublicUrl.mockClear();
    createSignedUrl.mockClear();
  });

  it('returns the public url before anything is cached', () => {
    expect(peekChatMediaUrl('chat-media', 'user-1/fresh.png')).toBe(
      'https://cdn.example.test/public/user-1/fresh.png',
    );
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  it('returns the cached signed url after resolution', async () => {
    await resolveChatMediaUrl('chat-media', 'user-1/cached.png');
    expect(peekChatMediaUrl('chat-media', 'user-1/cached.png')).toBe(
      'https://cdn.example.test/signed/user-1/cached.png?token=abc',
    );
  });
});
