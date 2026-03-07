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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const TEST_ENV = {
  supabaseUrl: getRequiredEnvValue('NEXT_PUBLIC_SUPABASE_URL'),
  supabaseAnonKey: getRequiredEnvValue('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  userAScreenname: getRequiredEnvValue('PLAYWRIGHT_USER_A_SCREENNAME'),
  userAPassword: getRequiredEnvValue('PLAYWRIGHT_USER_A_PASSWORD'),
  userBScreenname: getRequiredEnvValue('PLAYWRIGHT_USER_B_SCREENNAME'),
};

const missingEnv = [
  ['NEXT_PUBLIC_SUPABASE_URL', TEST_ENV.supabaseUrl],
  ['NEXT_PUBLIC_SUPABASE_ANON_KEY', TEST_ENV.supabaseAnonKey],
  ['PLAYWRIGHT_USER_A_SCREENNAME', TEST_ENV.userAScreenname],
  ['PLAYWRIGHT_USER_A_PASSWORD', TEST_ENV.userAPassword],
  ['PLAYWRIGHT_USER_B_SCREENNAME', TEST_ENV.userBScreenname],
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

async function attachThenRemovePendingFile(page: Page, fileName: string) {
  await page.locator('input[type="file"]').first().setInputFiles({
    name: fileName,
    mimeType: 'text/plain',
    buffer: Buffer.from(`smoke-${fileName}`),
  });

  await expect(page.getByText(fileName, { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText(fileName, { exact: false })).toHaveCount(0);
}

async function leaveCurrentWindow(page: Page) {
  await page.getByRole('button', { name: 'Back' }).click();
  await expect(page).toHaveURL(/\/buddy-list(?:\?|$)/);
}

async function joinRoom(page: Page, roomName: string) {
  await page.getByRole('button', { name: 'Chat' }).click();
  await page.getByLabel('Room name:').fill(roomName);
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page).toHaveURL(new RegExp(`/buddy-list\\?room=${escapeRegExp(encodeURIComponent(roomName))}`));
}

test.describe('logged-in ui smoke', () => {
  test.skip(
    missingEnv.length > 0,
    `Missing required env vars for UI smoke e2e: ${missingEnv.join(', ')}`,
  );

  test('dm and room refreshed controls remain usable', async ({ page }) => {
    const userAScreenname = TEST_ENV.userAScreenname!;
    const userAPassword = TEST_ENV.userAPassword!;
    const userBScreenname = TEST_ENV.userBScreenname!;
    const roomName = `ui-smoke-${Date.now()}`;

    await signOn(page, userAScreenname, userAPassword);

    const row = dmRow(page, userBScreenname);
    test.skip((await row.count()) === 0, 'E2E precondition not met: the seeded users must be accepted buddies.');

    await row.click();
    await expect(page.getByPlaceholder('Find in this conversation')).toBeVisible();
    await page.getByRole('button', { name: 'Toggle formatting' }).click();
    await expect(page.locator('#rich-font-select')).toBeVisible();
    await attachThenRemovePendingFile(page, 'dm-smoke.txt');

    const dmComposer = page.getByPlaceholder('Type your message...');
    await dmComposer.fill(`dm-smoke-${Date.now()}`);
    await page.locator('form button[type="submit"]').filter({ hasText: 'Send' }).click();
    await expect(dmComposer).toHaveValue('');
    await leaveCurrentWindow(page);

    await joinRoom(page, roomName);
    await expect(page.getByPlaceholder(`Find in #${roomName}`)).toBeVisible();
    await page.getByRole('button', { name: 'Toggle formatting' }).click();
    await expect(page.locator('#rich-font-select')).toBeVisible();
    await attachThenRemovePendingFile(page, 'room-smoke.txt');

    const roomComposer = page.getByPlaceholder(`Message #${roomName}`);
    await roomComposer.fill(`room-smoke-${Date.now()}`);
    await page.getByRole('button', { name: 'Send' }).click();
    await expect(roomComposer).toHaveValue('');
    await leaveCurrentWindow(page);
  });
});
