export type NotificationPreviewMode = 'full' | 'name_only' | 'hidden';

/**
 * Applies the recipient's notification preview preference to the outgoing
 * push payload fields. Mirrors the same logic in supabase/functions/push-dispatch/index.ts —
 * keep both in sync if the mode set changes.
 *
 * 'full'      → sender name + message preview visible on lock screen
 * 'name_only' → sender name visible; message body replaced with "New message"
 * 'hidden'    → neither sender nor content visible; reduces outing risk
 */
export function applyNotificationPreview(
  input: { senderName: string; messagePreview: string },
  mode: NotificationPreviewMode,
): { senderName: string; messagePreview: string } {
  if (mode === 'hidden') return { senderName: 'H.I.M.', messagePreview: 'New message' };
  if (mode === 'name_only') return { senderName: input.senderName, messagePreview: 'New message' };
  return input;
}
