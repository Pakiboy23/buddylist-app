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
  const [url, setUrl] = useState(() => peekChatMediaUrl(bucket, storagePath));

  useEffect(() => {
    let isCancelled = false;
    setUrl(peekChatMediaUrl(bucket, storagePath));
    void resolveChatMediaUrl(bucket, storagePath).then((resolved) => {
      if (!isCancelled) {
        setUrl(resolved);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [bucket, storagePath]);

  return url;
}
