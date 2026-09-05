import { checkPushPermission, requestAndRegisterPush } from '@/lib/nativePush';

/**
 * Contextual push-permission prompt.
 *
 * Push opt-in sat at 0% for every flight cohort because the only place to grant
 * permission was a row buried on /account. This asks at the moment the value is
 * self-evident instead — right after a friendship action just succeeded.
 *
 * Deliberately NOT a cold-launch prompt: `pushColdLaunchGuard.test.ts` still
 * forbids that, and it is what App Review objects to. Every call site here runs
 * only after a completed, user-initiated action.
 *
 * Rules:
 * - native only;
 * - only when the system state is still 'prompt' (never nag a denial — iOS
 *   would not show the sheet anyway);
 * - at most one ask per cooldown window, whether or not the user grants.
 *
 * ── Why the OS is checked before storage ──────────────────────────────────────
 * This guard used to read localStorage first and return early if the flag was
 * set, which permanently suppressed the prompt on installs iOS had never asked.
 *
 * The two states desync because they live in different places: the flag is in
 * WKWebView localStorage, which survives app updates and reinstalls, while the
 * authorization state is per-install and resets whenever the app is replaced —
 * a delete-and-reinstall, or swapping an Xcode debug build for the TestFlight
 * one. After that the flag says "asked" while iOS says "never asked", and the
 * contextual prompt never fires again.
 *
 * Verified 2026-09-03 on the founder's device: H.I.M. was absent from
 * Settings → Notifications (iOS only lists an app once it has requested
 * authorization) while the account held four device tokens from earlier
 * installs, and the app had been used minutes earlier.
 *
 * So the OS is the source of truth for whether *this install* has been asked,
 * and the stored timestamp only throttles repeat attempts. Note the check is
 * deliberately the OS state and not "does this user have a push token": tokens
 * outlive the install that created them, so a token row is no evidence that the
 * current install was ever asked — that is precisely the case above.
 */

export type PushPromptMoment = 'buddy_accepted' | 'first_dm_sent' | 'first_room_message';

const ASKED_STORAGE_KEY = 'him.pushPrompt.askedAt';

/**
 * How long a recorded ask suppresses the next one. Bounded rather than forever:
 * an install iOS has never asked should eventually get its one prompt, even if
 * a stale flag is sitting in storage from a previous install.
 */
const REASK_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function askedWithinCooldown(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const raw = window.localStorage.getItem(ASKED_STORAGE_KEY);
    if (!raw) return false;
    const askedAt = Date.parse(raw);
    // Unparseable value: treat as no record rather than suppressing forever.
    if (Number.isNaN(askedAt)) return false;
    return Date.now() - askedAt < REASK_COOLDOWN_MS;
  } catch {
    // Private mode / storage disabled. Previously this suppressed the prompt
    // outright, which meant those installs were never asked at all. Allowing
    // the ask is safe: the caller below only reaches it when iOS reports
    // 'prompt', and iOS itself shows the sheet only while undetermined.
    return false;
  }
}

function markAsked(): void {
  try {
    window.localStorage.setItem(ASKED_STORAGE_KEY, new Date().toISOString());
  } catch {
    // Non-fatal: worst case the ask is retried at the next friendship action.
  }
}

export async function maybePromptForPushAfterFriendshipAction(
  moment: PushPromptMoment,
): Promise<void> {
  try {
    // The OS first: it is the only thing that knows whether this install has
    // been asked. 'granted' and 'denied' both mean it has, and 'not-native'
    // means there is nothing to ask for.
    const state = await checkPushPermission();
    if (state !== 'prompt') return;

    // iOS has never asked on this install. A flag left behind by a previous
    // one must not veto that outright — only throttle it.
    if (askedWithinCooldown()) return;

    // Mark before asking: an interrupted prompt must not re-ask on every action.
    markAsked();
    await requestAndRegisterPush();
  } catch (error) {
    console.warn(`Push prompt skipped (${moment}):`, error);
  }
}
