import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SRC_DIR = path.resolve(REPO_ROOT, 'src');

const COLD_LAUNCH_SURFACE = path.join(
  SRC_DIR,
  'components',
  'GlobalNotificationListener.tsx',
);

const PUSH_DEFINITION_FILE = path.join(SRC_DIR, 'lib', 'nativePush.ts');
const ACCOUNT_PAGE_FILE = path.join(SRC_DIR, 'app', 'account', 'page.tsx');
// The contextual prompt (post-friendship-action) is the second sanctioned
// surface. It is NOT a cold-launch prompt: every caller below runs only after a
// user-initiated action has already succeeded, which is the distinction App
// Review cares about.
const CONTEXTUAL_PROMPT_FILE = path.join(SRC_DIR, 'lib', 'pushPromptMoments.ts');
const SANCTIONED_CONTEXTUAL_CALLERS = [
  path.join(SRC_DIR, 'lib', 'buddyRequest.ts'),
  path.join(SRC_DIR, 'lib', 'messageIdempotency.ts'),
];

function walkSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walkSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.test.ts') && !entry.endsWith('.test.tsx')) {
      out.push(full);
    }
  }
  return out;
}

describe('push permission cold-launch guard', () => {
  it('GlobalNotificationListener never calls PushNotifications.requestPermissions', () => {
    const source = readFileSync(COLD_LAUNCH_SURFACE, 'utf-8');
    expect(source).not.toMatch(/requestPermissions/);
  });

  it('only the /account page and the contextual prompt call requestAndRegisterPush', () => {
    const files = walkSourceFiles(SRC_DIR);
    const callers = files.filter((file) => {
      if (file === PUSH_DEFINITION_FILE) return false;
      const source = readFileSync(file, 'utf-8');
      return /\brequestAndRegisterPush\s*\(/.test(source);
    });

    expect(callers.sort()).toEqual([ACCOUNT_PAGE_FILE, CONTEXTUAL_PROMPT_FILE].sort());
  });

  it('the contextual prompt is only reached from completed friendship actions', () => {
    const files = walkSourceFiles(SRC_DIR);
    const importers = files.filter((file) => {
      if (file === CONTEXTUAL_PROMPT_FILE) return false;
      const source = readFileSync(file, 'utf-8');
      return /maybePromptForPushAfterFriendshipAction/.test(source);
    });

    expect(importers.sort()).toEqual(SANCTIONED_CONTEXTUAL_CALLERS.sort());
  });

  it('the contextual prompt only fires when the system state is still prompt', () => {
    const source = readFileSync(CONTEXTUAL_PROMPT_FILE, 'utf-8');
    // Never re-ask a denial: 'granted' and 'denied' both bail out.
    expect(source).toMatch(/state !== 'prompt'/);
    // Still throttled, so a completed friendship action cannot nag on repeat.
    expect(source).toMatch(/askedWithinCooldown\(\)/);
  });

  it('the contextual prompt asks the OS before consulting stored state', () => {
    // The OS is the only thing that knows whether THIS install was asked; the
    // stored timestamp survives reinstalls and used to veto the prompt forever
    // on installs iOS had never asked. Reversing this order reintroduces that.
    const source = readFileSync(CONTEXTUAL_PROMPT_FILE, 'utf-8');
    // Compare call sites inside the exported function, not the helper's own
    // definition further up the file.
    const bodyStart = source.indexOf('export async function maybePromptForPushAfterFriendshipAction');
    expect(bodyStart).toBeGreaterThan(-1);
    const body = source.slice(bodyStart);

    const osCheck = body.indexOf('await checkPushPermission()');
    const storageCheck = body.indexOf('askedWithinCooldown()');
    expect(osCheck).toBeGreaterThan(-1);
    expect(storageCheck).toBeGreaterThan(-1);
    expect(osCheck).toBeLessThan(storageCheck);
  });

  it('the stored ask is a bounded cooldown, not a permanent veto', () => {
    const source = readFileSync(CONTEXTUAL_PROMPT_FILE, 'utf-8');
    expect(source).toMatch(/REASK_COOLDOWN_MS/);
  });

  it('cold-launch surfaces never import the contextual prompt', () => {
    const source = readFileSync(COLD_LAUNCH_SURFACE, 'utf-8');
    expect(source).not.toMatch(/pushPromptMoments/);
  });
});
