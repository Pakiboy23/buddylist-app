import { expect, test } from '@playwright/test';

test.describe('web porch (#108)', () => {
  test('logged-out / is the porch, not Sign in', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Friends, not dates.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Get the app' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create account' })).toBeVisible();
    await expect(page.getByText('Pakiboy24')).toBeVisible();
    await expect(page.getByText('Sunday Reset')).toBeVisible();
    await expect(page.getByPlaceholder('e.g. sk8erboi99')).toHaveCount(0);
  });

  test('?signin=1 and /signin keep the login form', async ({ page }) => {
    await page.goto('/?signin=1');
    await expect(page.getByPlaceholder('e.g. sk8erboi99')).toBeVisible();

    await page.goto('/signin');
    await expect(page.getByPlaceholder('e.g. sk8erboi99')).toBeVisible();
  });

  test('Create account lands on the signup form', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/signin\?signup=1/);
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible();
  });
});
