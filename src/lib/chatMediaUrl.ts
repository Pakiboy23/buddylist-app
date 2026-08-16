import { supabase } from '@/lib/supabase';

// Signed-URL resolution for chat media.
//
// Chat attachments render through short-lived signed URLs so the chat-media
// bucket can eventually be flipped private (docs/storage-privacy-rollout.md).
// While the bucket is still public we fall back to the public object URL on
// any signing failure (offline, RLS edge case), which matches the pre-signed
// behavior exactly.

const SIGNED_URL_TTL_SECONDS = 6 * 60 * 60;
// Re-sign this long before expiry so a URL handed to <img>/<video> never goes
// stale while the attachment is still on screen.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

interface CachedSignedUrl {
  url: string;
  expiresAtMs: number;
}

const signedUrlCache = new Map<string, CachedSignedUrl>();
const inFlight = new Map<string, Promise<string>>();

function cacheKey(bucket: string, storagePath: string) {
  return `${bucket}/${storagePath}`;
}

export function getChatMediaPublicUrl(bucket: string, storagePath: string): string {
  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  return data.publicUrl;
}

/**
 * Synchronous best-effort URL: the cached signed URL when fresh, otherwise the
 * public object URL. Lets components paint immediately and swap to the signed
 * URL once resolveChatMediaUrl settles.
 */
export function peekChatMediaUrl(bucket: string, storagePath: string): string {
  const cached = signedUrlCache.get(cacheKey(bucket, storagePath));
  if (cached && cached.expiresAtMs - REFRESH_MARGIN_MS > Date.now()) {
    return cached.url;
  }
  return getChatMediaPublicUrl(bucket, storagePath);
}

export async function resolveChatMediaUrl(bucket: string, storagePath: string): Promise<string> {
  const key = cacheKey(bucket, storagePath);

  const cached = signedUrlCache.get(key);
  if (cached && cached.expiresAtMs - REFRESH_MARGIN_MS > Date.now()) {
    return cached.url;
  }

  const pending = inFlight.get(key);
  if (pending) {
    return pending;
  }

  const promise = (async () => {
    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS);
      const signedUrl = data?.signedUrl;
      if (error || !signedUrl) {
        throw error ?? new Error('No signed URL returned.');
      }
      signedUrlCache.set(key, {
        url: signedUrl,
        expiresAtMs: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
      });
      return signedUrl;
    } catch {
      return getChatMediaPublicUrl(bucket, storagePath);
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, promise);
  return promise;
}

/** Test-only: reset module state between cases. */
export function clearChatMediaUrlCacheForTesting() {
  signedUrlCache.clear();
  inFlight.clear();
}
