import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const checkPushPermission = vi.fn();
const requestAndRegisterPush = vi.fn();

vi.mock('@/lib/nativePush', () => ({
  checkPushPermission: () => checkPushPermission(),
  requestAndRegisterPush: () => requestAndRegisterPush(),
}));

import { maybePromptForPushAfterFriendshipAction } from './pushPromptMoments';

const ASKED_STORAGE_KEY = 'him.pushPrompt.askedAt';
const DAY_MS = 24 * 60 * 60 * 1000;

// The suite runs in the node environment (vitest.config.ts) and this is the
// only module under test that touches web storage, so stub the two calls it
// makes rather than pulling in a DOM implementation for the whole suite.
function installStorage(overrides: Partial<Pick<Storage, 'getItem' | 'setItem'>> = {}) {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    ...overrides,
  };
  (globalThis as { window?: unknown }).window = { localStorage: storage };
  return values;
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

describe('maybePromptForPushAfterFriendshipAction', () => {
  let stored: Map<string, string>;

  beforeEach(() => {
    checkPushPermission.mockReset();
    requestAndRegisterPush.mockReset();
    requestAndRegisterPush.mockResolvedValue('granted');
    stored = installStorage();
  });

  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('asks when iOS has never asked and nothing is stored', async () => {
    checkPushPermission.mockResolvedValue('prompt');
    await maybePromptForPushAfterFriendshipAction('buddy_accepted');
    expect(requestAndRegisterPush).toHaveBeenCalledTimes(1);
    expect(stored.get(ASKED_STORAGE_KEY)).toBeTruthy();
  });

  it('records the ask so the very next action does not repeat it', async () => {
    checkPushPermission.mockResolvedValue('prompt');
    await maybePromptForPushAfterFriendshipAction('buddy_accepted');
    await maybePromptForPushAfterFriendshipAction('first_dm_sent');
    expect(requestAndRegisterPush).toHaveBeenCalledTimes(1);
  });

  // The regression this change exists to prevent. localStorage survives a
  // reinstall; the iOS authorization state does not. A flag from a previous
  // install must not veto an install iOS has never asked.
  it('asks despite a stale stored flag when iOS reports never-asked', async () => {
    stored.set(ASKED_STORAGE_KEY, daysAgo(30));
    checkPushPermission.mockResolvedValue('prompt');

    await maybePromptForPushAfterFriendshipAction('buddy_accepted');

    expect(requestAndRegisterPush).toHaveBeenCalledTimes(1);
  });

  it('stays quiet inside the cooldown window', async () => {
    stored.set(ASKED_STORAGE_KEY, daysAgo(2));
    checkPushPermission.mockResolvedValue('prompt');

    await maybePromptForPushAfterFriendshipAction('buddy_accepted');

    expect(requestAndRegisterPush).not.toHaveBeenCalled();
  });

  it('never re-asks a denial, however old the stored flag', async () => {
    stored.set(ASKED_STORAGE_KEY, daysAgo(365));
    checkPushPermission.mockResolvedValue('denied');

    await maybePromptForPushAfterFriendshipAction('buddy_accepted');

    expect(requestAndRegisterPush).not.toHaveBeenCalled();
  });

  it('does nothing when permission is already granted', async () => {
    checkPushPermission.mockResolvedValue('granted');
    await maybePromptForPushAfterFriendshipAction('first_dm_sent');
    expect(requestAndRegisterPush).not.toHaveBeenCalled();
  });

  it('does nothing on web', async () => {
    checkPushPermission.mockResolvedValue('not-native');
    await maybePromptForPushAfterFriendshipAction('first_dm_sent');
    expect(requestAndRegisterPush).not.toHaveBeenCalled();
  });

  it('treats an unparseable stored value as no record rather than a veto', async () => {
    stored.set(ASKED_STORAGE_KEY, 'not-a-date');
    checkPushPermission.mockResolvedValue('prompt');

    await maybePromptForPushAfterFriendshipAction('buddy_accepted');

    expect(requestAndRegisterPush).toHaveBeenCalledTimes(1);
  });

  // Private mode / storage disabled used to be treated as "already asked",
  // which meant those installs were never asked at all.
  it('still asks when storage is unavailable', async () => {
    installStorage({
      getItem: () => {
        throw new Error('storage disabled');
      },
      setItem: () => {
        throw new Error('storage disabled');
      },
    });
    checkPushPermission.mockResolvedValue('prompt');

    await maybePromptForPushAfterFriendshipAction('buddy_accepted');

    expect(requestAndRegisterPush).toHaveBeenCalledTimes(1);
  });

  it('never throws when the permission check fails', async () => {
    checkPushPermission.mockRejectedValue(new Error('bridge unavailable'));
    await expect(
      maybePromptForPushAfterFriendshipAction('buddy_accepted'),
    ).resolves.toBeUndefined();
    expect(requestAndRegisterPush).not.toHaveBeenCalled();
  });
});
