import { expect, test, type Page } from '@playwright/test';
import { readNamedEnv, SEEDED_E2E_ENV } from './support/env';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeRoomKey(roomName: string) {
  return roomName.trim().replace(/^#+/, '').toLowerCase();
}

const { values: TEST_ENV, missing: missingEnv } = readNamedEnv(SEEDED_E2E_ENV);

async function signOn(page: Page, screenname: string, password: string) {
  await page.goto('/');
  await page.getByPlaceholder('e.g. sk8erboi99').fill(screenname);
  await page.getByPlaceholder('Enter password').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/hi-its-me/);
}

function roomRow(page: Page, roomName: string) {
  return page.locator(`[data-testid="room-row-${normalizeRoomKey(roomName)}"]`).first();
}

async function unreadCountForRoom(page: Page, roomName: string) {
  const row = roomRow(page, roomName);
  if ((await row.count()) === 0) {
    return 0;
  }

  const unread = await row.getAttribute('data-room-unread');
  const value = Number(unread ?? '0');
  return Number.isFinite(value) ? value : 0;
}

async function joinRoom(page: Page, roomName: string) {
  await page.getByRole('button', { name: 'Chat' }).click();
  await page.getByLabel('Room name:').fill(roomName);
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page).toHaveURL(new RegExp(`/hi-its-me\\?room=${escapeRegExp(encodeURIComponent(roomName))}`));
}

async function leaveRoomView(page: Page) {
  const backButton = page.getByRole('button', { name: 'Back' }).first();
  if ((await backButton.count()) > 0 && (await backButton.isVisible())) {
    await backButton.click();
  }
  await expect(page).toHaveURL(/\/hi-its-me(?:\?|$)/);
}

async function sendRoomMessage(page: Page, roomName: string, message: string) {
  const composer = page.getByPlaceholder(`Message #${roomName}`);
  await expect(composer).toBeVisible();
  await composer.fill(message);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(composer).toHaveValue('');
}

test.describe('room unread invariants', () => {
  test.skip(
    missingEnv.length > 0,
    `Missing required env vars for room unread e2e: ${missingEnv.join(', ')}`,
  );

  test('room unread catches up after reconnect and clears on open', async ({ browser }) => {
    const userAScreenname = TEST_ENV.userAScreenname!;
    const userAPassword = TEST_ENV.userAPassword!;
    const userBScreenname = TEST_ENV.userBScreenname!;
    const userBPassword = TEST_ENV.userBPassword!;
    const roomName = `e2e-room-${Date.now()}`;

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    try {
      await signOn(pageA, userAScreenname, userAPassword);
      await signOn(pageB, userBScreenname, userBPassword);

      await joinRoom(pageA, roomName);
      await leaveRoomView(pageA);
      await joinRoom(pageB, roomName);

      await expect(roomRow(pageA, roomName)).toBeVisible();
      await expect.poll(async () => unreadCountForRoom(pageA, roomName)).toBe(0);

      await contextA.setOffline(true);
      await sendRoomMessage(pageB, roomName, `e2e-room-unread-${Date.now()}-1`);
      await sendRoomMessage(pageB, roomName, `e2e-room-unread-${Date.now()}-2`);
      await expect.poll(async () => unreadCountForRoom(pageA, roomName), { timeout: 4_000 }).toBe(0);

      await contextA.setOffline(false);
      await pageA.reload();
      await expect(pageA).toHaveURL(/\/hi-its-me/);
      await expect.poll(async () => unreadCountForRoom(pageA, roomName)).toBe(2);

      await roomRow(pageA, roomName).click();
      await expect(pageA).toHaveURL(new RegExp(`/hi-its-me\\?room=${escapeRegExp(encodeURIComponent(roomName))}`));
      await leaveRoomView(pageA);
      await expect.poll(async () => unreadCountForRoom(pageA, roomName)).toBe(0);

      await pageA.reload();
      await expect(pageA).toHaveURL(/\/hi-its-me/);
      await expect.poll(async () => unreadCountForRoom(pageA, roomName)).toBe(0);
    } finally {
      await contextA.close();
      await contextB.close();
    }
  });
});
