import { useEffect, useState } from 'react';
import { peekChatMediaUrl, resolveChatMediaUrl } from '@/lib/chatMediaUrl';

/**
 * Resolves a chat-media object to a renderable URL.
 *
 * Paints immediately with the best synchronous URL (fresh cached signed URL,
 * else the public object URL) and swaps to a freshly signed URL once it
 * resolves. Keeps attachments rendering across the bucket's public -> private
 * transition (docs/storage-privacy-rollout.md).
 */
export function useChatMediaUrl(bucket: string, storagePath: string): string {
  const requestKey = `${bucket}\u0000${storagePath}`;
  const [resolvedUrl, setResolvedUrl] = useState<{ requestKey: string; url: string } | null>(null);

  useEffect(() => {
    let isCancelled = false;
    void resolveChatMediaUrl(bucket, storagePath).then((resolved) => {
      if (!isCancelled) {
        setResolvedUrl({ requestKey, url: resolved });
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [bucket, requestKey, storagePath]);

  return resolvedUrl?.requestKey === requestKey
    ? resolvedUrl.url
    : peekChatMediaUrl(bucket, storagePath);
}
