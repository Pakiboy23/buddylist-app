import * as fs from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { readNamedEnv, SEEDED_E2E_ENV } from './support/env';

const EXPORT_E2E_ENV = {
  ...SEEDED_E2E_ENV,
  supabaseServiceRoleKey: 'SUPABASE_SERVICE_ROLE_KEY',
} as const;

const { values: ENV, missing: missingEnv } = readNamedEnv(EXPORT_E2E_ENV);

async function signOn(page: Page, screenname: string, password: string) {
  await page.goto('/');
  await page.getByPlaceholder('e.g. sk8erboi99').fill(screenname);
  await page.getByPlaceholder('Enter password').fill(password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/hi-its-me/);
}

test.describe('account data export', () => {
  test.skip(
    missingEnv.length > 0,
    `Missing required env vars for account-export e2e: ${missingEnv.join(', ')}`,
  );

  test('user can download a JSON export of their data', async ({ browser }) => {
    const supabaseUrl = ENV.supabaseUrl!;
    const serviceRoleKey = ENV.supabaseServiceRoleKey!;
    const userAScreenname = ENV.userAScreenname!;
    const userAPassword = ENV.userAPassword!;

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Reset rate-limit so the test always triggers a fresh export.
    const { data: profile, error: lookupErr } = await admin
      .from('users')
      .select('id')
      .eq('screenname', userAScreenname)
      .single();
    if (lookupErr || !profile) {
      throw new Error(`Could not find User A profile: ${lookupErr?.message ?? 'not found'}`);
    }
    await admin.from('users').update({ last_exported_at: null }).eq('id', profile.id);

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      await signOn(page, userAScreenname, userAPassword);
      await page.goto('/account');

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTestId('account-export-btn').click(),
      ]);

      const path = await download.path();
      if (!path) throw new Error('Download path is null — file did not save.');

      const raw = await fs.readFile(path, 'utf8');
      const data = JSON.parse(raw) as {
        profile?: { screenname?: string };
        user_id?: string;
        export_generated_at?: string;
      };

      expect(data.profile?.screenname).toBe(userAScreenname);
      expect(typeof data.user_id).toBe('string');
      expect(typeof data.export_generated_at).toBe('string');
    } finally {
      // Reset rate-limit so subsequent runs aren't blocked.
      await admin.from('users').update({ last_exported_at: null }).eq('id', profile.id);
      await context.close();
    }
  });
});
