import { getJSON, setJSON } from '@/lib/clientStorage';

export type NotificationPreviewMode = 'full' | 'name_only' | 'hidden';

export interface DmConversationPreference {
  buddyId: string;
  isPinned: boolean;
  isMuted: boolean;
  isArchived: boolean;
  themeKey: string | null;
  wallpaperKey: string | null;
  disappearingTimerSeconds: number | null;
  updatedAt: string | null;
}

export interface UserPrivacySettings {
  shareReadReceipts: boolean;
  notificationPreviewMode: NotificationPreviewMode;
  screenShieldEnabled: boolean;
}

export interface SavedMessageRow {
  id: string;
  user_id: string;
  content: string;
  source_message_id: number | null;
  source_sender_id: string | null;
  source_screenname: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreviewInput {
  senderName: string;
  messagePreview: string;
}

export const DEFAULT_DM_PREFERENCE: Omit<DmConversationPreference, 'buddyId'> = {
  isPinned: false,
  isMuted: false,
  isArchived: false,
  themeKey: null,
  wallpaperKey: null,
  disappearingTimerSeconds: null,
  updatedAt: null,
};

export const DEFAULT_USER_PRIVACY_SETTINGS: UserPrivacySettings = {
  shareReadReceipts: true,
  notificationPreviewMode: 'full',
  screenShieldEnabled: false,
};

const DM_PREFERENCES_STORAGE_PREFIX = 'buddylist:dm-preferences:v1:';
const PRIVACY_SETTINGS_STORAGE_PREFIX = 'buddylist:privacy:v1:';

function toNullableString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function toNullablePositiveInt(value: unknown) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.floor(value);
  return normalized > 0 ? normalized : null;
}

export function getDmPreferencesStorageKey(userId: string) {
  return `${DM_PREFERENCES_STORAGE_PREFIX}${userId}`;
}

export function getPrivacySettingsStorageKey(userId: string) {
  return `${PRIVACY_SETTINGS_STORAGE_PREFIX}${userId}`;
}

export function normalizeNotificationPreviewMode(value: unknown): NotificationPreviewMode {
  if (value === 'hidden' || value === 'name_only' || value === 'full') {
    return value;
  }

  return DEFAULT_USER_PRIVACY_SETTINGS.notificationPreviewMode;
}

export function normalizeDmConversationPreference(
  buddyId: string,
  value: Partial<DmConversationPreference> | null | undefined,
): DmConversationPreference {
  return {
    buddyId,
    isPinned: Boolean(value?.isPinned),
    isMuted: Boolean(value?.isMuted),
    isArchived: Boolean(value?.isArchived),
    themeKey: toNullableString(value?.themeKey),
    wallpaperKey: toNullableString(value?.wallpaperKey),
    disappearingTimerSeconds: toNullablePositiveInt(value?.disappearingTimerSeconds),
    updatedAt: toNullableString(value?.updatedAt),
  };
}

export function normalizeDmPreferencesRows(
  rows: Array<Partial<DmConversationPreference> & { buddy_id?: string | null; buddyId?: string | null }> | null | undefined,
) {
  const entries = new Map<string, DmConversationPreference>();
  for (const row of rows ?? []) {
    const buddyId =
      (typeof row.buddy_id === 'string' && row.buddy_id.trim()) ||
      (typeof row.buddyId === 'string' && row.buddyId.trim()) ||
      '';
    if (!buddyId) {
      continue;
    }

    entries.set(
      buddyId,
      normalizeDmConversationPreference(buddyId, {
        buddyId,
        isPinned: row.isPinned,
        isMuted: row.isMuted,
        isArchived: row.isArchived,
        themeKey: row.themeKey,
        wallpaperKey: row.wallpaperKey,
        disappearingTimerSeconds: row.disappearingTimerSeconds,
        updatedAt: row.updatedAt,
      }),
    );
  }

  return Object.fromEntries(entries);
}

export function normalizeUserPrivacySettings(
  value: Partial<UserPrivacySettings> | null | undefined,
): UserPrivacySettings {
  return {
    shareReadReceipts:
      typeof value?.shareReadReceipts === 'boolean'
        ? value.shareReadReceipts
        : DEFAULT_USER_PRIVACY_SETTINGS.shareReadReceipts,
    notificationPreviewMode: normalizeNotificationPreviewMode(value?.notificationPreviewMode),
    screenShieldEnabled:
      typeof value?.screenShieldEnabled === 'boolean'
        ? value.screenShieldEnabled
        : DEFAULT_USER_PRIVACY_SETTINGS.screenShieldEnabled,
  };
}

export function loadDmPreferencesSnapshot(userId: string) {
  const snapshot = getJSON<Record<string, Partial<DmConversationPreference>>>(getDmPreferencesStorageKey(userId), {
    fallback: {},
  });
  return Object.fromEntries(
    Object.entries(snapshot).map(([buddyId, preference]) => [buddyId, normalizeDmConversationPreference(buddyId, preference)]),
  ) as Record<string, DmConversationPreference>;
}

export function saveDmPreferencesSnapshot(userId: string, preferences: Record<string, DmConversationPreference>) {
  return setJSON(getDmPreferencesStorageKey(userId), preferences);
}

export function loadPrivacySettingsSnapshot(userId: string) {
  return normalizeUserPrivacySettings(
    getJSON<Partial<UserPrivacySettings>>(getPrivacySettingsStorageKey(userId), {
      fallback: DEFAULT_USER_PRIVACY_SETTINGS,
    }),
  );
}

export function savePrivacySettingsSnapshot(userId: string, settings: UserPrivacySettings) {
  return setJSON(getPrivacySettingsStorageKey(userId), normalizeUserPrivacySettings(settings));
}

export function getDmPreference(
  preferences: Record<string, DmConversationPreference>,
  buddyId: string,
) {
  return preferences[buddyId] ?? normalizeDmConversationPreference(buddyId, null);
}

export function applyNotificationPreview(
  input: NotificationPreviewInput,
  settings: UserPrivacySettings,
): NotificationPreviewInput {
  if (settings.notificationPreviewMode === 'hidden') {
    return {
      senderName: 'BuddyList',
      messagePreview: 'New message',
    };
  }

  if (settings.notificationPreviewMode === 'name_only') {
    return {
      senderName: input.senderName,
      messagePreview: 'New message',
    };
  }

  return input;
}

export function isPrivateChatSchemaMissingError(error: { message?: string | null; code?: string | null } | null | undefined) {
  if (!error) {
    return false;
  }

  const combined = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
  return [
    'user_dm_preferences',
    'user_privacy_settings',
    'saved_messages',
    'delivered_at',
    'read_at',
    'reply_to_message_id',
    'forward_source_message_id',
  ].some((token) => combined.includes(token.toLowerCase()));
}
