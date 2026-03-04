import { expect, test, type Page } from '@playwright/test';

function missingOrPlaceholder(value: string | undefined) {
  if (!value) {
    return true;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('your-') || normalized.includes('changeme');
}

function getRequiredEnvValue(name: string) {
  const value = process.env[name];
  return missingOrPlaceholder(value) ? null : value ?? null;
}

const TEST_ENV = {
  supabaseUrl: getRequiredEnvValue('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: getRequiredEnvValue('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  userAScreenname: getRequiredEnvValue('PLAYWRIGHT_USER_A_SCREENNAME'),
  userAPassword: getRequiredEnvValue('PLAYWRIGHT_USER_A_PASSWORD'),
  userBScreenname: getRequiredEnvValue('PLAYWRIGHT_USER_B_SCREENNAME'),
  userBPassword: getRequiredEnvValue('PLAYWRIGHT_USER_B_PASSWORD'),
};

const missingEnv = [
  ['NEXT_PUBLIC_SUPABASE_URL', TEST_ENV.supabaseUrl],
  ['NEXT_PUBLIC_SUPABASE_ANON_KEY', TEST_ENV.supabaseAnonKey],
  ['PLAYWRIGHT_USER_A_SCREENNAME', TEST_ENV.userAScreenname],
  ['PLAYWRIGHT_USER_A_PASSWORD', TEST_ENV.userAPassword],
  ['PLAYWRIGHT_USER_B_SCREENNAME', TEST_ENV.userBScreenname],
  ['PLAYWRIGHT_USER_B_PASSWORD', TEST_ENV.userBPassword],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

async function signOn(page: Page, screenname: string, password: string) {
  await page.goto('/');
  await page.getByPlaceholder('e.g. sk8erboi99').fill(screenname);
  await page.getByPlaceholder('Enter password').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/buddy-list/);
}

function dmRow(page: Page, screenname: string) {
  return page.locator('button[data-testid^="dm-row-"]').filter({ hasText: screenname }).first();
}

async function unreadCountForBuddy(page: Page, screenname: string) {
  const row = dmRow(page, screenname);
  if ((await row.count()) === 0) {
    return 0;
  }

  const unread = await row.getAttribute('data-unread-dm');
  const value = Number(unread ?? '0');
  return Number.isFinite(value) ? value : 0;
}

async function sendDirectMessage(page: Page, recipientScreenname: string, content: string) {
  const row = dmRow(page, recipientScreenname);
  await expect(row).toBeVisible();
  await row.click();
  await page.getByPlaceholder('Type your message...').fill(content);
  await page.locator('form button[type="submit"]').filter({ hasText: 'Send' }).click();
}

test.describe('dm unread invariants', () => {
  test.skip(
    missingEnv.length > 0,
    `Missing required env vars for DM unread e2e: ${missingEnv.join(', ')}`,
  );

  test('dm unread is exact-once and clears after opening chat', async ({ browser }) => {
    const userAScreenname = TEST_ENV.userAScreenname!;
    const userAPassword = TEST_ENV.userAPassword!;
    const userBScreenname = TEST_ENV.userBScreenname!;
    const userBPassword = TEST_ENV.userBPassword!;

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await signOn(pageA, userAScreenname, userAPassword);
      await signOn(pageB, userBScreenname, userBPassword);

      const rowForAOnB = dmRow(pageB, userAScreenname);
      test.skip(
        (await rowForAOnB.count()) === 0,
        'E2E precondition not met: users must be accepted buddies in both lists.',
      );

      await sendDirectMessage(pageB, userAScreenname, `e2e-unread-${Date.now()}-1`);
      await expect.poll(async () => unreadCountForBuddy(pageA, userBScreenname)).toBe(1);

      await sendDirectMessage(pageB, userAScreenname, `e2e-unread-${Date.now()}-2`);
      await expect.poll(async () => unreadCountForBuddy(pageA, userBScreenname)).toBe(2);

      const rowForBOnA = dmRow(pageA, userBScreenname);
      await expect(rowForBOnA).toBeVisible();
      await rowForBOnA.click();
      await expect.poll(async () => unreadCountForBuddy(pageA, userBScreenname)).toBe(0);

      await pageA.reload();
      await expect(pageA).toHaveURL(/\/buddy-list/);
      await expect.poll(async () => unreadCountForBuddy(pageA, userBScreenname)).toBe(0);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
