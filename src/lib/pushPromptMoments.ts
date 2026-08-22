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
 * - at most once per install, whether or not the user grants.
 */

export type PushPromptMoment = 'buddy_accepted' | 'first_dm_sent';

const ASKED_STORAGE_KEY = 'him.pushPrompt.askedAt';

function hasAlreadyAsked(): boolean {
  try {
    return typeof window !== 'undefined' && !!window.localStorage.getItem(ASKED_STORAGE_KEY);
  } catch {
    // Private mode / storage disabled: treat as asked so we never loop-prompt.
    return true;
  }
}

function markAsked(): void {
  try {
    window.localStorage.setItem(ASKED_STORAGE_KEY, new Date().toISOString());
  } catch {
    // Non-fatal: worst case the prompt is skipped next time by the same guard.
  }
}

export async function maybePromptForPushAfterFriendshipAction(
  moment: PushPromptMoment,
): Promise<void> {
  if (hasAlreadyAsked()) return;

  try {
    const state = await checkPushPermission();
    if (state !== 'prompt') return;

    // Mark before asking: an interrupted prompt must not re-ask on every action.
    markAsked();
    await requestAndRegisterPush();
  } catch (error) {
    console.warn(`Push prompt skipped (${moment}):`, error);
  }
}
