import { expect, test } from '@playwright/test';

// GH-108: web porch on logged-out `/`. These specs need no seeded users —
// every surface here is logged out. Native `/` keeps the sign-in card; that
// side is covered by resolveAuthLanding unit tests since Playwright runs web.

const SCREENNAME_PLACEHOLDER = 'e.g. sk8erboi99';

test.describe('web porch (logged out)', () => {
  test('/ shows the porch, not the auth card', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Friends, not dates.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download on the App Store' })).toHaveAttribute(
      'href',
      /apps\.apple\.com/,
    );
    await expect(page.getByPlaceholder(SCREENNAME_PLACEHOLDER)).toHaveCount(0);
  });

  test('the porch keeps its copy honest', async ({ page }) => {
    await page.goto('/');
    const text = (await page.locator('main').innerText()).toLowerCase();
    for (const banned of ['match', 'swipe', 'singles', 'nearby', 'flirt', 'hookup', 'aol', 'aim']) {
      expect(text, `porch copy must not contain "${banned}"`).not.toContain(banned);
    }
  });

  test('?signin=1 keeps the login card', async ({ page }) => {
    await page.goto('/?signin=1');
    await expect(page.getByPlaceholder(SCREENNAME_PLACEHOLDER)).toBeVisible();
  });

  test('/signin keeps the login card', async ({ page }) => {
    await page.goto('/signin');
    await expect(page.getByPlaceholder(SCREENNAME_PLACEHOLDER)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('porch Sign in reaches the auth card', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/signin/);
    await expect(page.getByPlaceholder(SCREENNAME_PLACEHOLDER)).toBeVisible();
  });

  test('porch Create account lands in create mode', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  });

  test('a /signin?create=1 deep link opens create mode on a fresh load', async ({ page }) => {
    await page.goto('/signin?create=1');
    await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  });
});
