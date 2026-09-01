/**
 * Strips device tokens out of push failure text before it is persisted.
 * Mirrors `redactPushTokens` in supabase/functions/push-dispatch/index.ts —
 * keep both in sync.
 *
 * `push_dispatch_log` promises to hold no device tokens, and the text it stores
 * comes from transport errors and provider error bodies:
 *
 * - The APNs device token is a path segment of the request URL
 *   (`/3/device/<token>`), and a fetch-level failure quotes the URL it failed
 *   on — so an APNs outage would otherwise persist every token it touched.
 * - FCM error bodies echo the registration token back in the message.
 *
 * Both are covered: the APNs device path explicitly, then any remaining long
 * unbroken token-shaped run. APNs tokens are 64 hex characters and FCM's are
 * longer still, while a UUID is 36 and stays readable.
 */
export function redactPushTokens(raw: string): string {
  return raw
    .replace(/(\/3\/device\/)[A-Za-z0-9_-]+/g, '$1[redacted]')
    .replace(/[A-Za-z0-9_:-]{40,}/g, '[redacted]');
}
