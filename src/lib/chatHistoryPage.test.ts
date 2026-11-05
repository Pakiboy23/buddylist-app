import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CHAT_DM_HISTORY_PAGE_SIZE,
  CHAT_ROOM_HISTORY_PAGE_SIZE,
  chronologicalFromNewestPage,
} from '@/lib/chatHistoryPage';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const IM_PAGE = path.join(REPO_ROOT, 'src', 'app', 'hi-its-me', 'page.tsx');
const ROOM_WINDOW = path.join(REPO_ROOT, 'src', 'components', 'GroupChatWindow.tsx');

describe('chronologicalFromNewestPage', () => {
  it('reverses a newest-first page so the last row is the latest message', () => {
    const page = chronologicalFromNewestPage([
      { id: 300, created_at: '2026-11-05T12:00:00.000Z' },
      { id: 299, created_at: '2026-11-05T11:59:00.000Z' },
      { id: 101, created_at: '2026-11-01T09:00:00.000Z' },
    ]);

    expect(page.map((row) => row.id)).toEqual([101, 299, 300]);
    expect(page[page.length - 1]?.id).toBe(300);
  });

  it('returns an empty array for missing or empty pages', () => {
    expect(chronologicalFromNewestPage(null)).toEqual([]);
    expect(chronologicalFromNewestPage(undefined)).toEqual([]);
    expect(chronologicalFromNewestPage([])).toEqual([]);
  });
});

describe('conversation loaders fetch the newest page', () => {
  it('loads the newest 200 DMs, then flips them chronological', () => {
    const page = readFileSync(IM_PAGE, 'utf8');

    expect(page).toContain('chronologicalFromNewestPage');
    expect(page).toContain('CHAT_DM_HISTORY_PAGE_SIZE');
    expect(page).toMatch(/\.order\('created_at', \{ ascending: false \}\)\s*\.limit\(CHAT_DM_HISTORY_PAGE_SIZE\)/);
    expect(page).not.toMatch(/\.order\('created_at', \{ ascending: true \}\)\s*\.limit\(200\)/);
    expect(page).not.toMatch(/\.order\('created_at', \{ ascending: true \}\)\s*\.limit\(CHAT_DM_HISTORY_PAGE_SIZE\)/);
    expect(CHAT_DM_HISTORY_PAGE_SIZE).toBe(200);
  });

  it('loads the newest 300 room messages, then flips them chronological', () => {
    const roomWindow = readFileSync(ROOM_WINDOW, 'utf8');

    expect(roomWindow).toContain('chronologicalFromNewestPage');
    expect(roomWindow).toContain('CHAT_ROOM_HISTORY_PAGE_SIZE');
    expect(roomWindow).toMatch(
      /\.order\('created_at', \{ ascending: false \}\)\s*\.limit\(CHAT_ROOM_HISTORY_PAGE_SIZE\)/,
    );
    expect(roomWindow).not.toMatch(/\.order\('created_at', \{ ascending: true \}\)\s*\.limit\(300\)/);
    expect(roomWindow).not.toMatch(/\.order\('created_at', \{ ascending: true \}\)\s*\.limit\(CHAT_ROOM_HISTORY_PAGE_SIZE\)/);
    expect(CHAT_ROOM_HISTORY_PAGE_SIZE).toBe(300);
  });
});
