import { describe, expect, it } from 'vitest';
import {
  applyNotificationPreview,
  DEFAULT_USER_PRIVACY_SETTINGS,
  normalizeDmConversationPreference,
  normalizeUserPrivacySettings,
} from '@/lib/privateChat';

describe('normalizeDmConversationPreference', () => {
  it('fills missing values with safe defaults', () => {
    expect(normalizeDmConversationPreference('buddy-1', null)).toEqual({
      buddyId: 'buddy-1',
      isPinned: false,
      isMuted: false,
      isArchived: false,
      themeKey: null,
      wallpaperKey: null,
      disappearingTimerSeconds: null,
      updatedAt: null,
    });
  });
});

describe('normalizeUserPrivacySettings', () => {
  it('defaults new accounts to sender-only lock-screen previews', () => {
    expect(DEFAULT_USER_PRIVACY_SETTINGS.notificationPreviewMode).toBe('name_only');
  });

  it('falls back to default values for invalid preview modes', () => {
    expect(
      normalizeUserPrivacySettings({
        notificationPreviewMode: 'unexpected' as never,
      }),
    ).toEqual({
      shareReadReceipts: true,
      notificationPreviewMode: 'name_only',
      screenShieldEnabled: false,
    });
  });
});

describe('applyNotificationPreview', () => {
  it('hides sender and body in hidden mode', () => {
    expect(
      applyNotificationPreview(
        {
          senderName: 'Pakiboy24',
          messagePreview: 'Meet me in Cool_kids',
        },
        {
          shareReadReceipts: true,
          notificationPreviewMode: 'hidden',
          screenShieldEnabled: false,
        },
      ),
    ).toEqual({
      senderName: 'H.I.M.',
      messagePreview: 'New message',
    });
  });
});
