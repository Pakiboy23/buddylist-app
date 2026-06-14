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

  it('only the /account page calls requestAndRegisterPush', () => {
    const files = walkSourceFiles(SRC_DIR);
    const callers = files.filter((file) => {
      if (file === PUSH_DEFINITION_FILE) return false;
      const source = readFileSync(file, 'utf-8');
      return /\brequestAndRegisterPush\s*\(/.test(source);
    });

    expect(callers).toEqual([ACCOUNT_PAGE_FILE]);
  });
});
