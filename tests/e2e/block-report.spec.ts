import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readNamedEnv, SEEDED_E2E_ENV } from './support/env';

const BLOCK_REPORT_ENV = {
  ...SEEDED_E2E_ENV,
  supabaseServiceRoleKey: 'SUPABASE_SERVICE_ROLE_KEY',
} as const;

const { values: TEST_ENV, missing: missingEnv } = readNamedEnv(BLOCK_REPORT_ENV);

async function signOn(page: Page, screenname: string, password: string) {
  await page.goto('/');
  await page.getByPlaceholder('e.g. sk8erboi99').fill(screenname);
  await page.getByPlaceholder('Enter password').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/hi-its-me/);
}

function dmRow(page: Page, screenname: string) {
  return page.locator('button[data-testid^="dm-row-"]').filter({ hasText: screenname }).first();
}

async function openDmWith(page: Page, screenname: string) {
  // hi-its-me lists DM rows with the buddy's screenname; click the row to enter
  // the chat thread. The first child button on the row opens the thread.
  const row = page.locator(`[data-testid^="dm-row-"]`).filter({ hasText: screenname }).first();
  await expect(row).toBeVisible();
  // Click the row's chat-opening control. The thread-open control is the
  // dm-row button (second child); fall back to row click for any layout drift.
  const openButton = row.locator('button').first();
  await openButton.click();
}

test.describe('block and report flow', () => {
  test.skip(
    missingEnv.length > 0,
    `Missing required env vars for block-report e2e: ${missingEnv.join(', ')}`,
  );

  test('user can report a message and blocking hides existing messages', async ({ browser }) => {
    const userAScreenname = TEST_ENV.userAScreenname!;
    const userAPassword = TEST_ENV.userAPassword!;
    const userBScreenname = TEST_ENV.userBScreenname!;
    const userBPassword = TEST_ENV.userBPassword!;
    const supabaseUrl = TEST_ENV.supabaseUrl!;
    const serviceRoleKey = TEST_ENV.supabaseServiceRoleKey!;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Look up user IDs once so cleanup is precise.
    const { data: aLookup } = await admin
      .from('users')
      .select('id')
      .eq('screenname', userAScreenname)
      .maybeSingle();
    const { data: bLookup } = await admin
      .from('users')
      .select('id')
      .eq('screenname', userBScreenname)
      .maybeSingle();
    const aId = aLookup?.id as string | undefined;
    const bId = bLookup?.id as string | undefined;
    test.skip(!aId || !bId, 'Seeded test users not found by screenname.');

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();
    const unique = `e2e-block-${Date.now()}`;

    let createdReportIds: string[] = [];

    try {
      await signOn(pageA, userAScreenname, userAPassword);
      await signOn(pageB, userBScreenname, userBPassword);

      // Precondition: A and B are accepted buddies on both sides.
      const rowForAOnB = dmRow(pageB, userAScreenname);
      test.skip(
        (await rowForAOnB.count()) === 0,
        'E2E precondition not met: users must be accepted buddies in both lists.',
      );

      // Step 1 — B sends a unique message to A.
      await rowForAOnB.click();
      await pageB.getByPlaceholder('Type your message...').fill(unique);
      await pageB
        .locator('form button[type="submit"]')
        .filter({ hasText: 'Send' })
        .click();

      // Step 2 — A opens the DM with B and sees the new message.
      await openDmWith(pageA, userBScreenname);
      const incomingBubble = pageA
        .locator('[data-testid="dm-message"][data-message-mine="false"]')
        .filter({ hasText: unique })
        .last();
      await expect(incomingBubble).toBeVisible();

      // Step 3 — Hover the message to reveal the action menu, then Report.
      // `group-hover` reveals the menu on desktop chromium.
      await incomingBubble.hover();
      const reportButton = incomingBubble.getByTestId('dm-message-report');
      await reportButton.waitFor({ state: 'visible' });
      await reportButton.click();

      // Step 4 — Fill the report sheet and submit.
      const sheet = pageA.getByTestId('message-report-sheet');
      await expect(sheet).toBeVisible();
      await sheet.getByTestId('message-report-category').selectOption('harassment');
      await sheet
        .getByTestId('message-report-notes')
        .fill(`e2e report ${unique}`);
      await sheet.getByTestId('message-report-submit').click();
      await expect(sheet).toBeHidden({ timeout: 10_000 });

      // Verify the report row landed in Postgres (via admin client).
      const { data: reports } = await admin
        .from('abuse_reports')
        .select('id')
        .eq('reporter_id', aId!)
        .eq('target_user_id', bId!)
        .ilike('details', `%${unique}%`);
      expect((reports ?? []).length).toBeGreaterThanOrEqual(1);
      createdReportIds = (reports ?? []).map((row) => row.id as string);

      // Step 5 — Open B's profile from the chat header and tap Block.
      await pageA.getByTestId('dm-header-open-profile').click();
      const blockButton = pageA.getByTestId('profile-block');
      await blockButton.waitFor({ state: 'visible' });
      await blockButton.click();

      // Step 6 — After blocking, the active thread closes and we are back
      // at /hi-its-me. The previously-visible incoming message must be gone.
      await expect(pageA).toHaveURL(/\/hi-its-me/, { timeout: 10_000 });
      await expect(
        pageA.locator('[data-testid="dm-message"]').filter({ hasText: unique }),
      ).toHaveCount(0);
    } finally {
      // Cleanup: unblock B from A's side, and remove any reports created here.
      if (aId && bId) {
        await admin
          .from('blocked_users')
          .delete()
          .eq('blocker_id', aId)
          .eq('blocked_id', bId);
      }
      if (createdReportIds.length > 0) {
        await admin.from('abuse_reports').delete().in('id', createdReportIds);
      }
      await contextA.close().catch(() => undefined);
      await contextB.close().catch(() => undefined);
    }
  });
});
