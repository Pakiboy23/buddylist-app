import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as appApi from '@/lib/appApi';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SRC_DIR = path.resolve(REPO_ROOT, 'src');
const IM_PAGE = path.join(SRC_DIR, 'app', 'hi-its-me', 'page.tsx');

const DEAD_CLIENT_MARKERS = [
  'password-reset-ticket',
  'password-reset-audit',
  'Recovery Concierge',
  'isAdminResetOpen',
  'showAddWindow',
  'handleSearch',
  'buildAdminResetHandoff',
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

describe('dead Recovery Concierge + Add Buddy modal cleanup', () => {
  it('src/ has no password-reset ticket/audit client calls or dead admin/add-buddy UI', () => {
    const hits = walkSourceFiles(SRC_DIR).flatMap((file) => {
      const source = readFileSync(file, 'utf-8');
      return DEAD_CLIENT_MARKERS
        .filter((marker) => source.includes(marker))
        .map((marker) => `${path.relative(REPO_ROOT, file)}: ${marker}`);
    });

    expect(hits).toEqual([]);
  });

  it('keeps live Find → Browse add and SearchPanel / BrowsePanel', () => {
    const source = readFileSync(IM_PAGE, 'utf-8');
    expect(source).toMatch(/setFindSubSection\('browse'\)/);
    expect(source).toMatch(/function openAddWindow|const openAddWindow/);
    expect(source).toContain("import BrowsePanel from '@/components/BrowsePanel'");
    expect(source).toContain("import SearchPanel from '@/components/SearchPanel'");
    expect(source).toContain('handleAddBuddyById');
  });

  it('keeps the live admin-me ops probe and does not export unused invite URLs', () => {
    expect(existsSync(path.join(REPO_ROOT, 'api', 'admin', 'me.ts'))).toBe(true);
    expect(existsSync(path.join(REPO_ROOT, 'supabase', 'functions', 'admin-me', 'index.ts'))).toBe(true);
    expect(appApi).not.toHaveProperty('getShareableInviteUrl');
    expect(typeof appApi.getAppApiUrl).toBe('function');
    expect(typeof appApi.getEdgeFunctionUrl).toBe('function');
  });
});
