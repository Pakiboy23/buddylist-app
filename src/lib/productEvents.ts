import { track } from '@vercel/analytics';

/**
 * Lightweight product events on top of the Vercel Analytics hook already
 * mounted in `App.tsx`. No new analytics platform — just named events we can
 * read as conversion rates (e.g. first-session away-message set).
 *
 * Fire-and-forget: a blocked tracker must never break a product path.
 */
export type ProductEventProps = Record<string, string | number | boolean | null>;

export const PRODUCT_EVENTS = {
  firstSessionAwayNudgeShown: 'him_first_session_away_nudge_shown',
  awayMessageSet: 'him_away_message_set',
  browseAddRateLimited: 'him_browse_add_rate_limited',
} as const;

export function trackProductEvent(name: string, data?: ProductEventProps): void {
  try {
    if (data) {
      track(name, data);
      return;
    }
    track(name);
  } catch (error) {
    console.warn('[product_event]', name, error);
  }
}
