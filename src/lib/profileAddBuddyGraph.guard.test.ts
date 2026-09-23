import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import BuddyProfileSheet from '@/components/BuddyProfileSheet';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SRC_DIR = path.resolve(REPO_ROOT, 'src');
const PROFILE_SHEET = path.join(SRC_DIR, 'components', 'BuddyProfileSheet.tsx');
const IM_PAGE = path.join(SRC_DIR, 'app', 'hi-its-me', 'page.tsx');
const NOTIFICATIONS = path.join(SRC_DIR, 'components', 'GlobalNotificationListener.tsx');
const BANNER = path.join(SRC_DIR, 'components', 'IncomingMessageBanner.tsx');

function profileSheetJsx(pageSource: string) {
  const start = pageSource.indexOf('<BuddyProfileSheet');
  const end = pageSource.indexOf('/>', start);
  return pageSource.slice(start, end);
}

describe('profile Add Buddy writes the buddies graph', () => {
  it('the profile sheet calls the buddies upsert and does not render the connections graph', () => {
    const sheet = readFileSync(PROFILE_SHEET, 'utf-8');
    const page = readFileSync(IM_PAGE, 'utf-8');
    const sheetJsx = profileSheetJsx(page);

    expect(sheet).toContain('onAddBuddy');
    expect(sheet).toContain('Add Buddy');
    expect(sheet).not.toMatch(/user_connections|useConnectionStatus|Follow|Upgrade to Buddy|currentUserId/);
    expect(sheetJsx).toContain('handleAddBuddyById');
    expect(sheetJsx).not.toContain('currentUserId');
    expect(page).toContain(".from('buddies').upsert");
    expect(existsSync(path.join(SRC_DIR, 'hooks', 'useConnectionStatus.ts'))).toBe(false);
  });

  it('drops the user_connections notification channel and keeps the buddies request modal', () => {
    const notifications = readFileSync(NOTIFICATIONS, 'utf-8');
    const banner = readFileSync(BANNER, 'utf-8');
    const page = readFileSync(IM_PAGE, 'utf-8');

    expect(notifications).not.toMatch(/user_connections|accept_buddy_request|decline_buddy_request|global_notifications_connections/);
    expect(banner).not.toMatch(/\bactions\b/);
    expect(page).toContain('New Message Request');
    expect(page).toContain('handleAcceptPendingRequest');
    expect(page).toContain('handleDeclinePendingRequest');
  });

  it('renders Add Buddy on a pending profile and hides the connections actions', () => {
    const html = renderToStaticMarkup(
      createElement(BuddyProfileSheet, {
        buddy: {
          id: 'buddy-1',
          screenname: 'nightowl',
          relationshipStatus: 'pending',
          presenceState: 'available',
          presenceDetail: 'Active now',
          activityVisible: true,
          statusLine: 'reading',
          awayMessage: null,
          bio: 'hi',
          buddyIconPath: null,
        },
        isOpen: true,
        onClose: () => undefined,
        onStartChat: () => undefined,
        onAddBuddy: () => undefined,
      }),
    );

    expect(html).toContain('Add Buddy');
    expect(html).toContain('aria-label="Add nightowl as a buddy"');
    expect(html).not.toContain('Follow');
    expect(html).not.toContain('Upgrade to Buddy');
    expect(html).not.toContain('Join a room with them first');
    expect(html).not.toContain('Remove Buddy');
  });

  it('renders Remove Buddy for an accepted profile', () => {
    const html = renderToStaticMarkup(
      createElement(BuddyProfileSheet, {
        buddy: {
          id: 'buddy-2',
          screenname: 'nightowl',
          relationshipStatus: 'accepted',
          presenceState: 'available',
          presenceDetail: 'Active now',
          activityVisible: true,
          statusLine: null,
          awayMessage: null,
          bio: null,
          buddyIconPath: null,
        },
        isOpen: true,
        onClose: () => undefined,
        onStartChat: () => undefined,
        onAddBuddy: () => undefined,
        onRemoveBuddy: () => undefined,
      }),
    );

    expect(html).toContain('Remove Buddy');
    expect(html).not.toContain('Add Buddy');
  });
});
