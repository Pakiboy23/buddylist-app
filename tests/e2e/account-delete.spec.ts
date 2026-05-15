import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readNamedEnv } from './support/env';

const DELETE_E2E_ENV = {
  supabaseUrl: 'NEXT_PUBLIC_SUPABASE_URL',
  supabaseAnonKey: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  supabaseServiceRoleKey: 'SUPABASE_SERVICE_ROLE_KEY',
} as const;

const { values: ENV, missing: missingEnv } = readNamedEnv(DELETE_E2E_ENV);

async function signOn(page: Page, screenname: string, password: string) {
  await page.goto('/');
  await page.getByPlaceholder('e.g. sk8erboi99').fill(screenname);
  await page.getByPlaceholder('Enter password').fill(password);
  await page.locator('button[type="submit"]').click();
}

async function attemptSignOn(page: Page, screenname: string, password: string) {
  await signOn(page, screenname, password);
  // Wait briefly for either success (redirect) or an error status message.
  await page.waitForTimeout(2500);
  return page.url();
}

test.describe('account deletion', () => {
  test.skip(
    missingEnv.length > 0,
    `Missing required env vars for account-delete e2e: ${missingEnv.join(', ')}`,
  );

  test('user can delete their account and cannot sign back in', async ({ browser }) => {
    const supabaseUrl = ENV.supabaseUrl!;
    const serviceRoleKey = ENV.supabaseServiceRoleKey!;

    const stamp = Date.now();
    const screenname = `e2edel${stamp}`.slice(0, 20);
    const email = `${screenname}@e2e.hiitsme.test`;
    const password = `Pw-${stamp}-aB!`;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Provision a fresh confirmed user via admin API.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { screenname },
    });
    if (createError || !created.user) {
      throw new Error(`Failed to provision test user: ${createError?.message}`);
    }
    const userId = created.user.id;

    // Mirror to public.users so sign-in lookup-by-screenname works.
    const { error: profileError } = await admin.from('users').upsert(
      {
        id: userId,
        email,
        screenname,
        status: 'available',
        is_online: false,
        last_active_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (profileError) {
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
      throw new Error(`Failed to seed profile: ${profileError.message}`);
    }

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      // Sign in as the new user.
      await signOn(page, screenname, password);
      await expect(page).toHaveURL(/\/hi-its-me/);

      // Navigate to /account and then to /account/delete via the CTA.
      await page.goto('/account');
      await page.getByTestId('account-delete-cta').click();
      await expect(page).toHaveURL(/\/account\/delete/);

      // Type the screenname to confirm and submit step 1.
      await page.getByTestId('delete-confirm-input').fill(screenname);
      await page.getByTestId('delete-confirm-submit').click();

      // Step 2: final modal — confirm.
      await page.getByTestId('delete-final-confirm').click();

      // After deletion the app signs out and bounces to '/'.
      await expect(page).toHaveURL(/^[^#?]*\/?$/, { timeout: 30_000 });

      // Verify directly: the auth row is gone.
      const { data: lookup } = await admin.auth.admin.getUserById(userId);
      expect(lookup.user).toBeNull();

      // Try to sign in again — must fail (no redirect off `/`).
      await context.close();
      const verifyContext = await browser.newContext();
      const verifyPage = await verifyContext.newPage();
      try {
        const finalUrl = await attemptSignOn(verifyPage, screenname, password);
        expect(finalUrl).not.toMatch(/\/hi-its-me/);
      } finally {
        await verifyContext.close();
      }
    } catch (err) {
      // Best-effort cleanup if the test failed before deletion completed.
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
      await admin.from('users').delete().eq('id', userId);
      await context.close().catch(() => undefined);
      throw err;
    }
  });
});
