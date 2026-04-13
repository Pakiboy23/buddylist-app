import { FormEvent, Suspense, lazy, useCallback, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AppIcon from '@/components/AppIcon';
import AppLockSheet from '@/components/AppLockSheet';
import HiItsMeTabIcon from '@/components/HiItsMeTabIcon';
import type { ChatMessage } from '@/components/ChatWindow';
import BuddyProfileSheet from '@/components/BuddyProfileSheet';
import ProfileAvatar from '@/components/ProfileAvatar';
import RenameScreenname from '@/components/RenameScreenname';
import SavedMessagesWindow from '@/components/SavedMessagesWindow';
import {
  AWAY_MOOD_OPTIONS,
  buildRoomFilterOptions,
  DEFAULT_AWAY_MOOD_ID,
  getAwayMoodOption,
  getHimRoomMeta,
  isAwayMoodId,
  type AwayMoodId,
} from '@/lib/himArtDirection';
import { getAccessTokenOrNull, waitForSessionOrNull } from '@/lib/authClient';
import { getAppApiUrl } from '@/lib/appApi';
import { navigateAppPath, replaceAppPathInPlace, useAppRouter } from '@/lib/appNavigation';
import {
  aggregateBuddyRelationships,
  type BuddyRelationshipRecord,
} from '@/lib/buddyRelationships';
import { deleteBuddyIconFile, uploadBuddyIconFile, validateBuddyIconFile } from '@/lib/buddyIcon';
import {
  getRaw,
  getVersionedData,
  removeValue,
  setVersionedData,
  subscribeToStorageKey,
} from '@/lib/clientStorage';
import { uploadChatMediaFile } from '@/lib/chatMedia';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useTheme } from '@/hooks/useTheme';
import {
  DEFAULT_APP_LOCK_SETTINGS,
  loadAppLockSettings,
  saveAppLockSettings,
  hashAppLockPin,
  verifyAppLockPin,
  isValidAppLockPin,
  formatAppLockTimeoutLabel,
  type AppLockSettings,
} from '@/lib/appLock';
import {
  DEFAULT_BIOMETRIC_AVAILABILITY,
  authenticateWithBiometrics,
  checkBiometricAvailability,
  getBiometricErrorCode,
} from '@/lib/biometrics';
import {
  createClientMessageId,
  createOutboxItem,
  getOutboxStorageKey,
  isOutboxItemDue,
  loadOutbox,
  markOutboxSending,
  markOutboxAttemptFailure,
  normalizeOutboxItems,
  type OutboxItem,
  type OutboxItemStatus,
  saveOutbox,
  scheduleOutboxRetryNow,
} from '@/lib/outbox';
import {
  DIRECT_MESSAGE_SELECT_FIELDS,
  LEGACY_DIRECT_MESSAGE_SELECT_FIELDS,
  isDirectMessageMetadataSchemaMissingError,
  sendDirectMessageWithClientMessageId,
  sendRoomMessageWithClientMessageId,
} from '@/lib/messageIdempotency';
import { dispatchBuddyAcceptedPush, dispatchBuddyRequestPush } from '@/lib/pushDispatch';
import {
  EXTENDED_USER_PROFILE_SELECT_FIELDS,
  EXTENDED_USER_PROFILE_WITH_EMAIL_SELECT_FIELDS,
  getProfileSchemaMigrationMessage,
  isProfileSchemaMissingError,
  LEGACY_USER_PROFILE_SELECT_FIELDS,
  LEGACY_USER_PROFILE_WITH_EMAIL_SELECT_FIELDS,
  withProfileSchemaDefaults,
  withProfileSchemaDefaultsList,
} from '@/lib/profileSchema';
import { isChatRoomsRoomKeyMissingError } from '@/lib/roomSchema';
import { hapticLight, hapticWarning, hapticSelection } from '@/lib/haptics';
import { initSoundSystem, playFallbackTone, playUiSound } from '@/lib/sound';
import { supabase } from '@/lib/supabase';
import { normalizeRoomKey, sameRoom } from '@/lib/roomName';
import { htmlToPlainText } from '@/lib/richText';
import {
  DEFAULT_USER_PRIVACY_SETTINGS,
  getDmPreference,
  getDmPreferencesStorageKey,
  getPrivacySettingsStorageKey,
  loadDmPreferencesSnapshot,
  loadPrivacySettingsSnapshot,
  normalizeDmConversationPreference,
  normalizeDmPreferencesRows,
  normalizeUserPrivacySettings,
  saveDmPreferencesSnapshot,
  savePrivacySettingsSnapshot,
  type DmConversationPreference,
  type SavedMessageRow,
  type UserPrivacySettings,
} from '@/lib/privateChat';
import {
  formatPresenceSince,
  getPresenceDetail,
  getPresenceLabel,
  resolvePresenceState,
} from '@/lib/presence';
import { generateClientRecoveryCode, RECOVERY_CODE_MIN_LENGTH } from '@/lib/recoveryCode';
import {
  clearPendingSignupRecoveryDraft,
  readPendingSignupRecoveryDraft,
} from '@/lib/signupRecoveryDraft';
import {
  applyDmStateEvent,
  mapRowsToUnreadDirectMessages,
  type DmStateEventType,
  type UserDmStateRowLite,
} from '@/lib/unread-dm';
import {
  isNativeIosShell,
  publishNativeShellChromeState,
  registerNativeShellBridge,
  subscribeNativeShellCommands,
  type NativeShellAdminAuditItem,
  type NativeShellAdminAuditResult,
  type NativeShellAdminIssueResult,
  type NativeShellCommand,
  type NativeShellPrivacyResult,
  type NativeShellPrivacySettings,
  type NativeShellPrivacyState,
} from '@/lib/nativeShell';
import RetroWindow from '@/components/RetroWindow';
import { useChatContext } from '@/context/ChatContext';
import {
  ABUSE_REPORT_CATEGORY_OPTIONS,
  getMessageExpiresAt,
  isTrustSafetySchemaMissingError,
  normalizeBlockedUserIds,
  type AbuseReportCategory,
} from '@/lib/trustSafety';

const ChatWindow = lazy(() => import('@/components/ChatWindow'));
const GroupChatWindow = lazy(() => import('@/components/GroupChatWindow'));

interface UserProfile {
  id: string;
  email?: string | null;
  screenname: string | null;
  status: string | null;
  away_message: string | null;
  status_msg: string | null;
  profile_bio: string | null;
  buddy_icon_path: string | null;
  idle_since: string | null;
  last_active_at: string | null;
}

interface Buddy {
  id: string;
  screenname: string;
  status: string | null;
  away_message: string | null;
  status_msg: string | null;
  profile_bio: string | null;
  buddy_icon_path: string | null;
  idle_since: string | null;
  last_active_at: string | null;
  relationshipStatus: 'pending' | 'accepted';
}

type BuddySortMode = 'online_then_alpha' | 'alpha' | 'recent_activity';
type ShellSection = 'profile' | 'im' | 'chat' | 'buddy';

interface PendingRequest {
  senderId: string;
  screenname: string;
}

export interface TemporaryChatProfile {
  screenname: string;
  status: string | null;
  away_message: string | null;
  status_msg: string | null;
  profile_bio: string | null;
  buddy_icon_path: string | null;
  idle_since: string | null;
  last_active_at: string | null;
}

interface ChatRoom {
  id: string;
  name: string;
  room_key?: string | null;
  invite_code?: string | null;
}

interface AdminMeResponse {
  isAdmin: boolean;
}

interface AdminTicketResponse {
  ok: boolean;
  ticket: string;
  expiresAt: string;
}

interface AdminAuditEntry {
  id: number;
  eventType: string;
  actorUserId: string | null;
  actorScreenname: string | null;
  targetUserId: string | null;
  targetScreenname: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface AdminAuditResponse {
  entries: AdminAuditEntry[];
}

interface AwayPreset {
  id: string;
  label: string;
  message: string;
  builtIn?: boolean;
}

interface BuddyActivityToast {
  id: string;
  buddyId: string;
  message: string;
  tone: 'online' | 'offline' | 'away' | 'back';
}

type ConversationFilter = 'all' | 'unread' | 'pinned' | 'requests' | 'archived';

type UserSelectQuery = ReturnType<ReturnType<typeof supabase.from>['select']>;

const PROFILE_SCHEMA_NOTICE = getProfileSchemaMigrationMessage('Buddy icons, bios, and idle sync');

function normalizeUserProfile(profile: Partial<UserProfile> | null | undefined): UserProfile | null {
  const normalized = withProfileSchemaDefaults(profile);
  if (!normalized?.id) {
    return null;
  }

  return {
    id: normalized.id,
    email: normalized.email ?? null,
    screenname: normalized.screenname ?? null,
    status: normalized.status ?? null,
    away_message: normalized.away_message ?? null,
    status_msg: normalized.status_msg ?? null,
    profile_bio: normalized.profile_bio,
    buddy_icon_path: normalized.buddy_icon_path,
    idle_since: normalized.idle_since,
    last_active_at: normalized.last_active_at,
  };
}

function normalizeUserProfileList(profiles: Partial<UserProfile>[] | null | undefined) {
  return withProfileSchemaDefaultsList(profiles)
    .map((profile) => normalizeUserProfile(profile))
    .filter((profile): profile is UserProfile => profile !== null);
}

const SELF_SIGN_OFF_SOUND = '/sounds/goodbye.mp3';
const BUDDY_SIGN_ON_SOUND = '/sounds/door_creak.mp3';
const BUDDY_SIGN_OFF_SOUND = '/sounds/door_slam.mp3';
const BUDDY_GOING_AWAY_SOUND = '/sounds/door_slam.mp3';
const INCOMING_MESSAGE_SOUND = '/sounds/im_receive.mp3';
const NEW_MESSAGE_SOUND = '/sounds/aim-instant-message.mp3';
const HI_ITS_ME_PATH = '/hi-its-me';
const SHELL_SECTION_QUERY_KEY = 'tab';
const AVAILABLE_STATUS = 'Available';
const AWAY_STATUS = 'Away';
const KNOWN_STATUSES = ['Available', 'Away', 'Invisible', 'Busy', 'Be Right Back'] as const;
const UI_CACHE_KEY_PREFIX = 'hiitsme:ui:v1:';
const UI_CACHE_VERSION = 1;
const UI_CACHE_MAX_BYTES = 96 * 1024;
const UI_MAX_CUSTOM_PRESETS = 24;
const UI_MAX_COOLDOWN_ENTRIES = 220;
const UI_MAX_DRAFT_ITEMS = 48;
const UI_MAX_DRAFT_LENGTH = 1600;
const UI_COOLDOWN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const AWAY_PRESETS_STORAGE_KEY = 'hiitsme:away-presets';
const AWAY_SETTINGS_STORAGE_KEY = 'hiitsme:away-settings';
const AWAY_COOLDOWN_STORAGE_KEY = 'hiitsme:away-cooldowns';
const BUDDY_SORT_STORAGE_KEY = 'hiitsme:buddy-sort';
const AWAY_AUTO_REPLY_PREFIX = '[Auto-Reply]';
const AWAY_AUTO_REPLY_COOLDOWN_MS = 10 * 60 * 1000;
const TYPING_THROTTLE_MS = 1200;
const TYPING_TTL_MS = 3500;
const AUTO_AWAY_MINUTE_OPTIONS = [5, 10, 15, 30] as const;
const PROFILE_STATUS_MAX_LENGTH = 80;
const PROFILE_BIO_MAX_LENGTH = 240;
const PROFILE_ACTIVITY_TTL_MS = 4200;
const PROFILE_ACTIVITY_DEDUPE_MS = 4000;
const BUDDY_LIST_WAVE_TTL_MS = 1800;
const LAST_ACTIVE_WRITE_INTERVAL_MS = 60 * 1000;
const DEFAULT_AWAY_PRESETS: AwayPreset[] = [
  { id: 'gym-regret', label: 'Gym', message: 'at the gym, probably regretting this decision', builtIn: true },
  { id: 'emotionally-elsewhere', label: 'Elsewhere', message: 'technically available, emotionally somewhere else', builtIn: true },
  { id: 'cooking', label: 'Cooking', message: "cooking. don't talk to me until there is food", builtIn: true },
  { id: 'snacks', label: 'Snacks', message: 'do not disturb unless you are bringing snacks', builtIn: true },
];

function normalizeShellSection(value: string | null | undefined): ShellSection {
  return value === 'im' || value === 'chat' || value === 'buddy' || value === 'profile' ? value : 'profile';
}

function buildHiItsMePath(options: {
  section?: ShellSection;
  roomName?: string | null;
  dmBuddyId?: string | null;
} = {}) {
  const params = new URLSearchParams();
  const section = options.section ?? 'profile';

  if (section !== 'profile') {
    params.set(SHELL_SECTION_QUERY_KEY, section);
  }
  if (options.roomName) {
    params.set('room', options.roomName);
  }
  if (options.dmBuddyId) {
    params.set('dm', options.dmBuddyId);
  }

  const query = params.toString();
  return query ? `${HI_ITS_ME_PATH}?${query}` : HI_ITS_ME_PATH;
}

interface UiDraftState {
  dm: Record<string, string>;
  rooms: Record<string, string>;
}

interface UiCachePayloadV1 {
  buddySortMode: BuddySortMode;
  awayMoodId?: AwayMoodId;
  awaySettings: {
    autoAwayEnabled: boolean;
    autoAwayMinutes: number;
    autoReturnOnActivity: boolean;
  };
  awayPresets: Array<{
    id: string;
    label: string;
    message: string;
  }>;
  awayCooldowns: Record<string, number>;
  drafts: UiDraftState;
}

function getUiCacheKey(userId: string) {
  return `${UI_CACHE_KEY_PREFIX}${userId}`;
}

function isBuddySortMode(value: string): value is BuddySortMode {
  return value === 'online_then_alpha' || value === 'alpha' || value === 'recent_activity';
}

function normalizeUiCachePayload(value: unknown): UiCachePayloadV1 | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<UiCachePayloadV1>;
  const awaySettings = candidate.awaySettings;
  const drafts = candidate.drafts;

  if (
    !candidate.buddySortMode ||
    !isBuddySortMode(candidate.buddySortMode) ||
    !awaySettings ||
    typeof awaySettings !== 'object' ||
    !drafts ||
    typeof drafts !== 'object'
  ) {
    return null;
  }

  const normalizedPresets = Array.isArray(candidate.awayPresets)
    ? candidate.awayPresets
        .filter(
          (preset) =>
            preset &&
            typeof preset === 'object' &&
            typeof (preset as { id?: unknown }).id === 'string' &&
            typeof (preset as { label?: unknown }).label === 'string' &&
            typeof (preset as { message?: unknown }).message === 'string',
        )
        .map((preset) => ({
          id: (preset as { id: string }).id,
          label: (preset as { label: string }).label.trim() || 'Custom',
          message: (preset as { message: string }).message,
        }))
    : [];

  const normalizedCooldowns =
    candidate.awayCooldowns && typeof candidate.awayCooldowns === 'object'
      ? Object.fromEntries(
          Object.entries(candidate.awayCooldowns).filter(
            ([key, timestamp]) =>
              typeof key === 'string' &&
              key.trim().length > 0 &&
              typeof timestamp === 'number' &&
              Number.isFinite(timestamp),
          ),
        )
      : {};

  const normalizedDmDrafts =
    drafts.dm && typeof drafts.dm === 'object'
      ? Object.fromEntries(
          Object.entries(drafts.dm).filter(
            ([key, draft]) => typeof key === 'string' && typeof draft === 'string',
          ),
        )
      : {};

  const normalizedRoomDrafts =
    drafts.rooms && typeof drafts.rooms === 'object'
      ? Object.fromEntries(
          Object.entries(drafts.rooms).filter(
            ([key, draft]) => typeof key === 'string' && typeof draft === 'string',
          ),
        )
      : {};

  const minutesCandidate = Number(awaySettings.autoAwayMinutes);
  const normalizedMinutes = AUTO_AWAY_MINUTE_OPTIONS.includes(
    minutesCandidate as (typeof AUTO_AWAY_MINUTE_OPTIONS)[number],
  )
    ? minutesCandidate
    : 10;

  return {
    buddySortMode: candidate.buddySortMode,
    awayMoodId: isAwayMoodId(candidate.awayMoodId) ? candidate.awayMoodId : DEFAULT_AWAY_MOOD_ID,
    awaySettings: {
      autoAwayEnabled: Boolean(awaySettings.autoAwayEnabled),
      autoAwayMinutes: normalizedMinutes,
      autoReturnOnActivity: Boolean(awaySettings.autoReturnOnActivity),
    },
    awayPresets: normalizedPresets,
    awayCooldowns: normalizedCooldowns,
    drafts: {
      dm: normalizedDmDrafts,
      rooms: normalizedRoomDrafts,
    },
  };
}

function normalizeCustomPresets(presets: AwayPreset[]) {
  const custom = presets.filter((preset) => !preset.builtIn);
  const byId = new Map<string, { id: string; label: string; message: string }>();

  for (const preset of custom) {
    const id = preset.id.trim();
    if (!id) {
      continue;
    }
    byId.set(id, {
      id,
      label: preset.label.trim() || 'Custom',
      message: preset.message,
    });
  }

  return Array.from(byId.values()).slice(0, UI_MAX_CUSTOM_PRESETS);
}

function normalizeCooldowns(input: Record<string, number>) {
  const now = Date.now();
  const rows = Object.entries(input)
    .filter(([, timestamp]) => now - timestamp <= UI_COOLDOWN_RETENTION_MS)
    .sort((left, right) => right[1] - left[1])
    .slice(0, UI_MAX_COOLDOWN_ENTRIES);
  return Object.fromEntries(rows);
}

function normalizeDraftMap(input: Record<string, string>) {
  const trimmed = Object.entries(input)
    .filter(([key, value]) => key.trim().length > 0 && typeof value === 'string' && value.length > 0)
    .map(([key, value]) => [key, value.slice(0, UI_MAX_DRAFT_LENGTH)] as const)
    .slice(0, UI_MAX_DRAFT_ITEMS);
  return Object.fromEntries(trimmed);
}

function compactUiCachePayload(payload: UiCachePayloadV1) {
  const compacted: UiCachePayloadV1 = {
    ...payload,
    awayPresets: payload.awayPresets.slice(0, UI_MAX_CUSTOM_PRESETS),
    awayCooldowns: normalizeCooldowns(payload.awayCooldowns),
    drafts: {
      dm: normalizeDraftMap(payload.drafts.dm),
      rooms: normalizeDraftMap(payload.drafts.rooms),
    },
  };

  const orderedDraftEntries = [
    ...Object.entries(compacted.drafts.dm).map(([key, value]) => ({ type: 'dm' as const, key, value })),
    ...Object.entries(compacted.drafts.rooms).map(([key, value]) => ({ type: 'room' as const, key, value })),
  ].sort((left, right) => right.value.length - left.value.length);

  while (
    new TextEncoder().encode(JSON.stringify(compacted)).length > UI_CACHE_MAX_BYTES &&
    orderedDraftEntries.length > 0
  ) {
    const largest = orderedDraftEntries.shift();
    if (!largest) {
      break;
    }

    if (largest.type === 'dm') {
      delete compacted.drafts.dm[largest.key];
    } else {
      delete compacted.drafts.rooms[largest.key];
    }
  }

  return compacted;
}

function normalizeStatusLabel(input: string | null | undefined): string {
  const value = (input ?? '').trim();
  if (!value) {
    return AVAILABLE_STATUS;
  }

  const match = KNOWN_STATUSES.find((status) => status.toLowerCase() === value.toLowerCase());
  return match ?? value;
}

function parseLegacyStatusMessage(rawStatus: string | null | undefined): {
  status: string;
  awayMessage: string;
} {
  const raw = (rawStatus ?? '').trim();
  if (!raw) {
    return { status: AVAILABLE_STATUS, awayMessage: '' };
  }

  for (const option of KNOWN_STATUSES) {
    const pattern = new RegExp(`^${option}\\s*(?:-|:)\\s*`, 'i');
    const match = raw.match(pattern);
    if (match) {
      const trailing = raw.slice(match[0].length).trim();
      return {
        status: option,
        awayMessage: option === AWAY_STATUS ? trailing : '',
      };
    }

    if (raw.toLowerCase() === option.toLowerCase()) {
      return { status: option, awayMessage: '' };
    }
  }

  return { status: AVAILABLE_STATUS, awayMessage: '' };
}

function composeStatusMessage(status: string): string {
  const normalizedStatus = normalizeStatusLabel(status);
  return normalizedStatus;
}

function looksLikeLegacyStatusMessage(input: string, resolvedStatus: string) {
  const trimmed = input.trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.toLowerCase() === resolvedStatus.toLowerCase()) {
    return true;
  }

  return KNOWN_STATUSES.some((status) => {
    const pattern = new RegExp(`^${status}\\s*(?:-|:)\\s*`, 'i');
    return pattern.test(trimmed);
  });
}

function resolveAwayTemplate(template: string, selfName: string, buddyName?: string): string {
  const now = new Date();
  const resolvedBuddyName = (buddyName ?? 'Buddy').trim() || 'Buddy';
  const resolvedSelfName = selfName.trim() || 'User';
  return template
    .replace(/%n/gi, resolvedBuddyName)
    .replace(/%d/gi, now.toLocaleDateString())
    .replace(/%t/gi, now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    .replace(/%s/gi, resolvedSelfName);
}

function resolveStatusFields({
  status,
  awayMessage,
  statusMessage,
}: {
  status: string | null | undefined;
  awayMessage: string | null | undefined;
  statusMessage: string | null | undefined;
}) {
  const legacy = parseLegacyStatusMessage(statusMessage);
  const resolvedStatus = normalizeStatusLabel(status || legacy.status);
  const resolvedAwayMessage =
    (awayMessage ?? '').trim() || (resolvedStatus === AWAY_STATUS ? legacy.awayMessage : '');
  const trimmedStatusMessage = (statusMessage ?? '').trim();
  const resolvedStatusMessage =
    trimmedStatusMessage && !looksLikeLegacyStatusMessage(trimmedStatusMessage, resolvedStatus)
      ? trimmedStatusMessage
      : composeStatusMessage(resolvedStatus);

  return {
    status: resolvedStatus,
    awayMessage: resolvedAwayMessage,
    statusMessage: resolvedStatusMessage,
  };
}

function useSoundPlayer() {
  useEffect(() => {
    initSoundSystem();
  }, []);

  return useCallback((src: string) => {
    void playUiSound(src);
  }, []);
}

function normalizeTimestampMs(value: string | null | undefined) {
  if (!value) {
    return 0;
  }
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function getDmTypingChannelKey(leftUserId: string, rightUserId: string) {
  return [leftUserId, rightUserId].sort().join(':');
}

function formatAdminAuditEvent(eventType: string) {
  return eventType
    .split('_')
    .filter(Boolean)
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function formatAuditUserLabel(screenname: string | null, userId: string | null) {
  if (screenname) {
    return screenname;
  }

  if (userId) {
    return `User ${userId.slice(0, 8)}`;
  }

  return 'System';
}

function buildAdminResetHandoff(screenname: string, ticket: string, expiresAt: string) {
  return [
    `H.I.M. secure reset for ${screenname}`,
    `Ticket: ${ticket}`,
    `Expires: ${new Date(expiresAt).toLocaleString()}`,
    'Open H.I.M., choose "Use reset ticket", then create a new password and recovery code.',
  ].join('\n');
}

function HiItsMeContent() {
  const [userId, setUserId] = useState<string | null>(null);
  const [screenname, setScreenname] = useState('Loading...');
  const [statusMsg, setStatusMsg] = useState(AVAILABLE_STATUS);
  const [userStatus, setUserStatus] = useState(AVAILABLE_STATUS);
  const [awayMessage, setAwayMessage] = useState('');
  const [profileBio, setProfileBio] = useState('');
  const [buddyIconPath, setBuddyIconPath] = useState<string | null>(null);
  const [idleSinceAt, setIdleSinceAt] = useState<string | null>(null);
  const [lastActiveAt, setLastActiveAt] = useState<string | null>(null);
  const [showAwayModal, setShowAwayModal] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [awayPresets, setAwayPresets] = useState<AwayPreset[]>(DEFAULT_AWAY_PRESETS);
  const [selectedAwayPresetId, setSelectedAwayPresetId] = useState<string>(DEFAULT_AWAY_PRESETS[0].id);
  const [awayMoodId, setAwayMoodId] = useState<AwayMoodId>(DEFAULT_AWAY_MOOD_ID);
  const [awayLabelDraft, setAwayLabelDraft] = useState('');
  const [awayText, setAwayText] = useState('');
  const [profileStatusDraft, setProfileStatusDraft] = useState(AVAILABLE_STATUS);
  const [profileBioDraft, setProfileBioDraft] = useState('');
  const [pendingBuddyIconFile, setPendingBuddyIconFile] = useState<File | null>(null);
  const [buddyIconPreviewUrl, setBuddyIconPreviewUrl] = useState<string | null>(null);
  const [removeBuddyIconOnSave, setRemoveBuddyIconOnSave] = useState(false);
  const [saveAwayPreset, setSaveAwayPreset] = useState(false);
  const [isAutoAwayEnabled, setIsAutoAwayEnabled] = useState(true);
  const [autoAwayMinutes, setAutoAwayMinutes] = useState<number>(10);
  const [autoReturnOnActivity, setAutoReturnOnActivity] = useState(true);
  const [awaySinceAt, setAwaySinceAt] = useState<string | null>(null);
  const [awayModalError, setAwayModalError] = useState<string | null>(null);
  const [isProfileSchemaUnavailable, setIsProfileSchemaUnavailable] = useState(false);
  const [isSavingAwayMessage, setIsSavingAwayMessage] = useState(false);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const [buddyRows, setBuddyRows] = useState<Buddy[]>([]);
  const [isLoadingBuddies, setIsLoadingBuddies] = useState(false);
  const [selectedBuddyId, setSelectedBuddyId] = useState<string | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [buddySortMode, setBuddySortMode] = useState<BuddySortMode>('online_then_alpha');
  const [buddyLastMessageAt, setBuddyLastMessageAt] = useState<Record<string, string>>({});
  const [buddyLastMessagePreview, setBuddyLastMessagePreview] = useState<Record<string, string>>({});
  const [isUiCacheHydrated, setIsUiCacheHydrated] = useState(false);
  const [awayReplyCooldowns, setAwayReplyCooldowns] = useState<Record<string, number>>({});
  const [draftCache, setDraftCache] = useState<UiDraftState>({ dm: {}, rooms: {} });
  const [buddyListWaveTone, setBuddyListWaveTone] = useState<'online' | 'offline' | null>(null);
  const [conversationFilter, setConversationFilter] = useState<ConversationFilter>('all');
  const [dmPreferencesByBuddyId, setDmPreferencesByBuddyId] = useState<Record<string, DmConversationPreference>>({});
  const [privacySettings, setPrivacySettings] = useState<UserPrivacySettings>(DEFAULT_USER_PRIVACY_SETTINGS);
  const [appLockSettings, setAppLockSettings] = useState<AppLockSettings>(DEFAULT_APP_LOCK_SETTINGS);
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [showAppLockSheet, setShowAppLockSheet] = useState(false);
  const [appLockMode, setAppLockMode] = useState<'setup' | 'unlock'>('setup');
  const [appLockPinDraft, setAppLockPinDraft] = useState('');
  const [appLockConfirmDraft, setAppLockConfirmDraft] = useState('');
  const [appLockError, setAppLockError] = useState<string | null>(null);
  const [biometricAvailability, setBiometricAvailability] = useState(DEFAULT_BIOMETRIC_AVAILABILITY);
  const [isBiometricAuthenticating, setIsBiometricAuthenticating] = useState(false);
  const [showPrivacySheet, setShowPrivacySheet] = useState(false);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [blockedProfiles, setBlockedProfiles] = useState<UserProfile[]>([]);
  const [trustSafetyError, setTrustSafetyError] = useState<string | null>(null);
  const [savedMessages, setSavedMessages] = useState<SavedMessageRow[]>([]);
  const [showSavedMessagesWindow, setShowSavedMessagesWindow] = useState(false);
  const [savedMessageDraft, setSavedMessageDraft] = useState('');
  const [savedMessageError, setSavedMessageError] = useState<string | null>(null);
  const [isSavingSavedMessage, setIsSavingSavedMessage] = useState(false);
  const [deletingSavedMessageId, setDeletingSavedMessageId] = useState<string | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<ChatMessage | null>(null);
  const [forwardError, setForwardError] = useState<string | null>(null);
  const [isForwardingToId, setIsForwardingToId] = useState<string | null>(null);

  const [isRecoverySetupOpen, setIsRecoverySetupOpen] = useState(false);
  const [recoveryCodeDraft, setRecoveryCodeDraft] = useState('');
  const [recoveryCodeConfirmDraft, setRecoveryCodeConfirmDraft] = useState('');
  const [recoverySetupError, setRecoverySetupError] = useState<string | null>(null);
  const [recoverySetupFeedback, setRecoverySetupFeedback] = useState<string | null>(null);
  const [isSavingRecoveryCode, setIsSavingRecoveryCode] = useState(false);

  const [showAddWindow, setShowAddWindow] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddingBuddyId, setIsAddingBuddyId] = useState<string | null>(null);
  const [isRemovingBuddyId, setIsRemovingBuddyId] = useState<string | null>(null);
  const [isBlockingBuddyId, setIsBlockingBuddyId] = useState<string | null>(null);
  const [isReportingBuddyId, setIsReportingBuddyId] = useState<string | null>(null);
  const [bodyShellSection, setBodyShellSection] = useState<ShellSection>('profile');
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [profileSheetBuddyId, setProfileSheetBuddyId] = useState<string | null>(null);
  const [profileSheetError, setProfileSheetError] = useState<string | null>(null);
  const [profileSheetFeedback, setProfileSheetFeedback] = useState<string | null>(null);
  const [showSystemStatusSheet, setShowSystemStatusSheet] = useState(false);
  const [buddyActivityToasts, setBuddyActivityToasts] = useState<BuddyActivityToast[]>([]);

  const [showRoomsWindow, setShowRoomsWindow] = useState(false);
  const [roomNameDraft, setRoomNameDraft] = useState('');
  const [roomFilterTag, setRoomFilterTag] = useState('all');
  const [roomJoinError, setRoomJoinError] = useState<string | null>(null);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isAdminResetOpen, setIsAdminResetOpen] = useState(false);
  const [adminResetScreenname, setAdminResetScreenname] = useState('');
  const [adminResetError, setAdminResetError] = useState<string | null>(null);
  const [adminResetFeedback, setAdminResetFeedback] = useState<string | null>(null);
  const [isIssuingAdminReset, setIsIssuingAdminReset] = useState(false);
  const [issuedAdminTicket, setIssuedAdminTicket] = useState<{ ticket: string; expiresAt: string } | null>(null);
  const [confirmAdminResetAction, setConfirmAdminResetAction] = useState(false);
  const [adminAuditEntries, setAdminAuditEntries] = useState<AdminAuditEntry[]>([]);
  const [isLoadingAdminAudit, setIsLoadingAdminAudit] = useState(false);
  const [adminAuditError, setAdminAuditError] = useState<string | null>(null);

  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);
  const [pendingRequestError, setPendingRequestError] = useState<string | null>(null);
  const [isProcessingRequestId, setIsProcessingRequestId] = useState<string | null>(null);
  const [temporaryChatAllowedIds, setTemporaryChatAllowedIds] = useState<string[]>([]);
  const [temporaryChatProfiles, setTemporaryChatProfiles] = useState<Record<string, TemporaryChatProfile>>({});

  const [activeChatBuddyId, setActiveChatBuddyId] = useState<string | null>(null);
  const [unreadDirectMessages, setUnreadDirectMessages] = useState<Record<string, number>>({});
  const [initialUnreadForActiveChat, setInitialUnreadForActiveChat] = useState(0);
  const [activeDmTypingText, setActiveDmTypingText] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [initialUnreadForActiveRoom, setInitialUnreadForActiveRoom] = useState(0);
  const [activeRoomReloadToken, setActiveRoomReloadToken] = useState(0);
  const [outboxItems, setOutboxItems] = useState<OutboxItem[]>([]);
  const [awayModalMode, setAwayModalMode] = useState<'profile' | 'away'>('profile');

  const hasPresenceSyncedRef = useRef(false);
  const isSigningOffRef = useRef(false);
  const activeChatBuddyIdRef = useRef<string | null>(null);
  const acceptedBuddyIdsRef = useRef<Set<string>>(new Set());
  const blockedUserIdsRef = useRef<Set<string>>(new Set());
  const buddyRowsRef = useRef<Buddy[]>([]);
  const pendingRequestsRef = useRef<PendingRequest[]>([]);
  const temporaryChatAllowedIdsRef = useRef<Set<string>>(new Set());
  const temporaryChatProfilesRef = useRef<Record<string, TemporaryChatProfile>>({});
  const mainShellScrollRef = useRef<HTMLDivElement | null>(null);
  const userStatusRef = useRef(userStatus);
  const statusMsgRef = useRef(statusMsg);
  const awayMessageRef = useRef(awayMessage);
  const screennameRef = useRef(screenname);
  const profileBioRef = useRef(profileBio);
  const buddyIconPathRef = useRef<string | null>(buddyIconPath);
  const idleSinceRef = useRef<string | null>(idleSinceAt);
  const lastActivityAtRef = useRef<number>(Date.now());
  const lastPresenceWriteAtRef = useRef(0);
  const activityTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastBuddyActivityAtRef = useRef<Record<string, number>>({});
  const autoAwayTriggeredRef = useRef(false);
  const awayReplyCooldownRef = useRef<Record<string, number>>({});
  const activeDmTypingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const presenceChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastDmTypingSentAtRef = useRef(0);
  const dmTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outboxItemsRef = useRef<OutboxItem[]>([]);
  const isFlushingOutboxRef = useRef(false);
  const appHiddenAtRef = useRef<number | null>(null);
  const attemptedBiometricUnlockRef = useRef(false);
  const quickPhotoInputRef = useRef<HTMLInputElement | null>(null);
  const awayMessageFieldRef = useRef<HTMLTextAreaElement | null>(null);
  const recoveryCodeInputRef = useRef<HTMLInputElement | null>(null);
  const adminResetInputRef = useRef<HTMLInputElement | null>(null);
  const playSound = useSoundPlayer();
  const { isDark, toggleDark } = useTheme();
  const router = useAppRouter();
  const [searchParams] = useSearchParams();
  const nativeShellActive = isNativeIosShell();
  const roomKeySchemaUnavailableRef = useRef(false);
  const {
    activeRooms,
    unreadMessages,
    joinRoom,
    leaveRoom,
    clearUnreads,
    resetChatState,
    syncFromServer,
    syncState,
    lastSyncedAt,
    lastSyncError,
  } = useChatContext();

  useEffect(() => {
    activeChatBuddyIdRef.current = activeChatBuddyId;
  }, [activeChatBuddyId]);

  useEffect(() => {
    buddyRowsRef.current = buddyRows;
  }, [buddyRows]);

  useEffect(() => {
    pendingRequestsRef.current = pendingRequests;
  }, [pendingRequests]);

  useEffect(() => {
    blockedUserIdsRef.current = new Set(blockedUserIds);
  }, [blockedUserIds]);

  useEffect(() => {
    if (!showAwayModal || awayModalMode !== 'away' || typeof window === 'undefined') {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const field = awayMessageFieldRef.current;
      if (!field) {
        return;
      }

      field.scrollIntoView({ block: 'center' });
      field.focus();
      const selectionStart = field.value.length;
      field.setSelectionRange(selectionStart, selectionStart);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [awayModalMode, showAwayModal]);

  useEffect(() => {
    if (!isRecoverySetupOpen || typeof window === 'undefined') {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const field = recoveryCodeInputRef.current;
      if (!field) {
        return;
      }

      field.scrollIntoView({ block: 'center' });
      field.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isRecoverySetupOpen]);

  useEffect(() => {
    if (!isAdminResetOpen || typeof window === 'undefined') {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const field = adminResetInputRef.current;
      if (!field) {
        return;
      }

      field.scrollIntoView({ block: 'center' });
      field.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [isAdminResetOpen]);

  useEffect(() => {
    temporaryChatAllowedIdsRef.current = new Set(temporaryChatAllowedIds);
  }, [temporaryChatAllowedIds]);

  useEffect(() => {
    temporaryChatProfilesRef.current = temporaryChatProfiles;
  }, [temporaryChatProfiles]);

  useEffect(() => {
    userStatusRef.current = userStatus;
  }, [userStatus]);

  useEffect(() => {
    statusMsgRef.current = statusMsg;
  }, [statusMsg]);

  useEffect(() => {
    awayMessageRef.current = awayMessage;
  }, [awayMessage]);

  useEffect(() => {
    screennameRef.current = screenname;
  }, [screenname]);

  useEffect(() => {
    profileBioRef.current = profileBio;
  }, [profileBio]);

  useEffect(() => {
    buddyIconPathRef.current = buddyIconPath;
  }, [buddyIconPath]);

  useEffect(() => {
    idleSinceRef.current = idleSinceAt;
  }, [idleSinceAt]);

  useEffect(() => {
    awayReplyCooldownRef.current = awayReplyCooldowns;
  }, [awayReplyCooldowns]);

  useEffect(() => {
    outboxItemsRef.current = outboxItems;
  }, [outboxItems]);

  useEffect(() => {
    return () => {
      Object.values(activityTimeoutsRef.current).forEach((timeoutId) => clearTimeout(timeoutId));
      activityTimeoutsRef.current = {};
    };
  }, []);

  useEffect(() => {
    return () => {
      if (buddyIconPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(buddyIconPreviewUrl);
      }
    };
  }, [buddyIconPreviewUrl]);

  const applyUiCachePayload = useCallback((payload: UiCachePayloadV1) => {
    const normalized = compactUiCachePayload(payload);
    setAwayPresets([...DEFAULT_AWAY_PRESETS, ...normalized.awayPresets]);
    setAwayMoodId(normalized.awayMoodId ?? DEFAULT_AWAY_MOOD_ID);
    setIsAutoAwayEnabled(normalized.awaySettings.autoAwayEnabled);
    setAutoAwayMinutes(normalized.awaySettings.autoAwayMinutes);
    setAutoReturnOnActivity(normalized.awaySettings.autoReturnOnActivity);
    setBuddySortMode(normalized.buddySortMode);
    setAwayReplyCooldowns(normalized.awayCooldowns);
    setDraftCache(normalized.drafts);
  }, []);

  useEffect(() => {
    if (!userId) {
      setIsUiCacheHydrated(false);
      return;
    }

    const defaultPayload: UiCachePayloadV1 = {
      buddySortMode: 'online_then_alpha',
      awayMoodId: DEFAULT_AWAY_MOOD_ID,
      awaySettings: {
        autoAwayEnabled: true,
        autoAwayMinutes: 10,
        autoReturnOnActivity: true,
      },
      awayPresets: [],
      awayCooldowns: {},
      drafts: {
        dm: {},
        rooms: {},
      },
    };

    const cacheKey = getUiCacheKey(userId);
    const hasV1Cache = Boolean(getRaw(cacheKey));
    let payload = getVersionedData<UiCachePayloadV1>(cacheKey, {
      version: UI_CACHE_VERSION,
      fallback: defaultPayload,
      guard: (value): value is UiCachePayloadV1 => Boolean(normalizeUiCachePayload(value)),
      migrate: (legacy) => normalizeUiCachePayload(legacy),
    });

    if (!hasV1Cache) {
      const legacyPayload = { ...defaultPayload };

      const presetsRaw = getRaw(`${AWAY_PRESETS_STORAGE_KEY}:${userId}`);
      if (presetsRaw) {
        try {
          const parsed = JSON.parse(presetsRaw) as Array<{ id?: string; label?: string; message?: string }>;
          legacyPayload.awayPresets = parsed
            .filter(
              (preset) =>
                typeof preset?.id === 'string' &&
                typeof preset?.label === 'string' &&
                typeof preset?.message === 'string',
            )
            .map((preset) => ({
              id: preset.id!,
              label: preset.label!.trim() || 'Custom',
              message: preset.message!,
            }));
        } catch {
          legacyPayload.awayPresets = [];
        }
      }

      const settingsRaw = getRaw(`${AWAY_SETTINGS_STORAGE_KEY}:${userId}`);
      if (settingsRaw) {
        try {
          const parsed = JSON.parse(settingsRaw) as {
            autoAwayEnabled?: boolean;
            autoAwayMinutes?: number;
            autoReturnOnActivity?: boolean;
          };
          if (typeof parsed.autoAwayEnabled === 'boolean') {
            legacyPayload.awaySettings.autoAwayEnabled = parsed.autoAwayEnabled;
          }
          if (
            typeof parsed.autoAwayMinutes === 'number' &&
            AUTO_AWAY_MINUTE_OPTIONS.includes(parsed.autoAwayMinutes as (typeof AUTO_AWAY_MINUTE_OPTIONS)[number])
          ) {
            legacyPayload.awaySettings.autoAwayMinutes = parsed.autoAwayMinutes;
          }
          if (typeof parsed.autoReturnOnActivity === 'boolean') {
            legacyPayload.awaySettings.autoReturnOnActivity = parsed.autoReturnOnActivity;
          }
        } catch {
          // Ignore legacy parse failures.
        }
      }

      const sortRaw = getRaw(`${BUDDY_SORT_STORAGE_KEY}:${userId}`);
      if (typeof sortRaw === 'string' && isBuddySortMode(sortRaw)) {
        legacyPayload.buddySortMode = sortRaw;
      }

      const cooldownRaw = getRaw(`${AWAY_COOLDOWN_STORAGE_KEY}:${userId}`);
      if (cooldownRaw) {
        try {
          const parsed = JSON.parse(cooldownRaw) as Record<string, number>;
          legacyPayload.awayCooldowns = Object.fromEntries(
            Object.entries(parsed).filter(([, value]) => typeof value === 'number' && Number.isFinite(value)),
          );
        } catch {
          legacyPayload.awayCooldowns = {};
        }
      }

      payload = legacyPayload;

      removeValue(`${AWAY_PRESETS_STORAGE_KEY}:${userId}`);
      removeValue(`${AWAY_SETTINGS_STORAGE_KEY}:${userId}`);
      removeValue(`${BUDDY_SORT_STORAGE_KEY}:${userId}`);
      removeValue(`${AWAY_COOLDOWN_STORAGE_KEY}:${userId}`);
    }

    const normalized = compactUiCachePayload(payload);
    applyUiCachePayload(normalized);
    setIsUiCacheHydrated(true);
    void setVersionedData(cacheKey, UI_CACHE_VERSION, normalized, {
      maxBytes: UI_CACHE_MAX_BYTES,
      compact: (envelope) => ({
        ...envelope,
        data: compactUiCachePayload(envelope.data),
      }),
    });
  }, [applyUiCachePayload, userId]);

  useEffect(() => {
    if (!userId || !isUiCacheHydrated) {
      return;
    }

    const payload: UiCachePayloadV1 = compactUiCachePayload({
      buddySortMode,
      awayMoodId,
      awaySettings: {
        autoAwayEnabled: isAutoAwayEnabled,
        autoAwayMinutes,
        autoReturnOnActivity,
      },
      awayPresets: normalizeCustomPresets(awayPresets),
      awayCooldowns: awayReplyCooldowns,
      drafts: draftCache,
    });

    void setVersionedData(getUiCacheKey(userId), UI_CACHE_VERSION, payload, {
      maxBytes: UI_CACHE_MAX_BYTES,
      compact: (envelope) => ({
        ...envelope,
        data: compactUiCachePayload(envelope.data),
      }),
    });
  }, [
    autoAwayMinutes,
    autoReturnOnActivity,
    awayMoodId,
    awayPresets,
    awayReplyCooldowns,
    buddySortMode,
    draftCache,
    isUiCacheHydrated,
    isAutoAwayEnabled,
    userId,
  ]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const unsubscribe = subscribeToStorageKey(getUiCacheKey(userId), (rawValue) => {
      if (!rawValue) {
        return;
      }

      try {
        const parsed = JSON.parse(rawValue) as { data?: unknown };
        const normalized = normalizeUiCachePayload(parsed?.data);
        if (!normalized) {
          return;
        }
        applyUiCachePayload(normalized);
      } catch {
        // Ignore malformed storage events.
      }
    });

    return () => {
      unsubscribe();
    };
  }, [applyUiCachePayload, userId]);

  useEffect(() => {
    if (!userId) {
      setDmPreferencesByBuddyId({});
      setPrivacySettings(DEFAULT_USER_PRIVACY_SETTINGS);
      setBlockedUserIds([]);
      setAppLockSettings(DEFAULT_APP_LOCK_SETTINGS);
      setBiometricAvailability(DEFAULT_BIOMETRIC_AVAILABILITY);
      setIsBiometricAuthenticating(false);
      attemptedBiometricUnlockRef.current = false;
      setIsAppLocked(false);
      return;
    }

    setDmPreferencesByBuddyId(loadDmPreferencesSnapshot(userId));
    setPrivacySettings(loadPrivacySettingsSnapshot(userId));
    setAppLockSettings(loadAppLockSettings(userId));
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    let cancelled = false;

    const refreshBiometricAvailability = async () => {
      const nextAvailability = await checkBiometricAvailability();
      if (!cancelled) {
        setBiometricAvailability(nextAvailability);
      }
    };

    void refreshBiometricAvailability();

    if (typeof document === 'undefined') {
      return () => {
        cancelled = true;
      };
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void refreshBiometricAvailability();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setSavedMessages([]);
      return;
    }

    let isCancelled = false;

    const loadPrivateChatData = async () => {
      const [preferencesResponse, privacyResponse, savedMessagesResponse, blockedUsersResponse] = await Promise.all([
        supabase
          .from('user_dm_preferences')
          .select(
            'buddyId:buddy_id,isPinned:is_pinned,isMuted:is_muted,isArchived:is_archived,themeKey:theme_key,wallpaperKey:wallpaper_key,disappearingTimerSeconds:disappearing_timer_seconds,updatedAt:updated_at',
          )
          .eq('user_id', userId),
        supabase
          .from('user_privacy_settings')
          .select(
            'shareReadReceipts:share_read_receipts,notificationPreviewMode:notification_preview_mode,screenShieldEnabled:screen_shield_enabled',
          )
          .eq('user_id', userId)
          .maybeSingle(),
        supabase
          .from('saved_messages')
          .select('id,user_id,content,source_message_id,source_sender_id,source_screenname,created_at,updated_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('blocked_users')
          .select('blockedId:blocked_id')
          .eq('blocker_id', userId),
      ]);

      if (isCancelled) {
        return;
      }

      if (!preferencesResponse.error) {
        const normalizedPreferences = normalizeDmPreferencesRows(
          (preferencesResponse.data ?? []) as Array<Partial<DmConversationPreference> & { buddyId?: string | null }>,
        );
        setDmPreferencesByBuddyId(normalizedPreferences);
        saveDmPreferencesSnapshot(userId, normalizedPreferences);
      } else {
        console.warn('Private-chat preferences unavailable:', preferencesResponse.error.message);
      }

      if (!privacyResponse.error) {
        const normalizedPrivacy = normalizeUserPrivacySettings(
          (privacyResponse.data as Partial<UserPrivacySettings> | null | undefined) ?? DEFAULT_USER_PRIVACY_SETTINGS,
        );
        setPrivacySettings(normalizedPrivacy);
        savePrivacySettingsSnapshot(userId, normalizedPrivacy);
        if (!privacyResponse.data) {
          void supabase.from('user_privacy_settings').upsert({
            user_id: userId,
            share_read_receipts: normalizedPrivacy.shareReadReceipts,
            notification_preview_mode: normalizedPrivacy.notificationPreviewMode,
            screen_shield_enabled: normalizedPrivacy.screenShieldEnabled,
          });
        }
      } else {
        console.warn('Privacy settings unavailable:', privacyResponse.error.message);
      }

      if (!savedMessagesResponse.error) {
        setSavedMessages((savedMessagesResponse.data ?? []) as SavedMessageRow[]);
      } else {
        console.warn('Saved messages unavailable:', savedMessagesResponse.error.message);
      }

      if (!blockedUsersResponse.error) {
        setBlockedUserIds(normalizeBlockedUserIds((blockedUsersResponse.data ?? []) as Array<{ blockedId?: string | null }>));
      } else if (!isTrustSafetySchemaMissingError(blockedUsersResponse.error)) {
        console.warn('Blocked users unavailable:', blockedUsersResponse.error.message);
      }
    };

    void loadPrivateChatData();

    const unsubscribePreferences = subscribeToStorageKey(getDmPreferencesStorageKey(userId), () => {
      setDmPreferencesByBuddyId(loadDmPreferencesSnapshot(userId));
    });
    const unsubscribePrivacy = subscribeToStorageKey(getPrivacySettingsStorageKey(userId), () => {
      setPrivacySettings(loadPrivacySettingsSnapshot(userId));
    });

    return () => {
      isCancelled = true;
      unsubscribePreferences();
      unsubscribePrivacy();
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    saveDmPreferencesSnapshot(userId, dmPreferencesByBuddyId);
  }, [dmPreferencesByBuddyId, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    savePrivacySettingsSnapshot(userId, privacySettings);
  }, [privacySettings, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    saveAppLockSettings(userId, appLockSettings);
  }, [appLockSettings, userId]);

  useEffect(() => {
    if (!appLockSettings.enabled || typeof document === 'undefined') {
      return;
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        appHiddenAtRef.current = Date.now();
        return;
      }

      if (document.visibilityState !== 'visible') {
        return;
      }

      const hiddenAt = appHiddenAtRef.current;
      appHiddenAtRef.current = null;
      if (hiddenAt === null) {
        return;
      }

      const elapsedSeconds = (Date.now() - hiddenAt) / 1000;
      if (appLockSettings.autoLockSeconds === 0 || elapsedSeconds >= appLockSettings.autoLockSeconds) {
        setAppLockMode('unlock');
        setAppLockPinDraft('');
        setAppLockConfirmDraft('');
        setAppLockError(null);
        attemptedBiometricUnlockRef.current = false;
        setIsBiometricAuthenticating(false);
        setShowAppLockSheet(true);
        setIsAppLocked(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [appLockSettings.autoLockSeconds, appLockSettings.enabled]);

  useEffect(() => {
    if (selectedAwayPresetId === '__custom__') {
      return;
    }

    if (awayPresets.some((preset) => preset.id === selectedAwayPresetId)) {
      return;
    }

    setSelectedAwayPresetId(awayPresets[0]?.id ?? DEFAULT_AWAY_PRESETS[0].id);
  }, [awayPresets, selectedAwayPresetId]);

  const playIncomingAlert = useCallback(() => {
    void playUiSound(INCOMING_MESSAGE_SOUND, { fallbackSrc: NEW_MESSAGE_SOUND }).then((played) => {
      if (!played) {
        playFallbackTone();
      }
    });
  }, []);

  const getAccessToken = useCallback(async () => {
    return getAccessTokenOrNull();
  }, []);

  const readApiError = useCallback(async (response: Response) => {
    try {
      const payload = (await response.json()) as { error?: string };
      return payload.error ?? 'Request failed.';
    } catch {
      return 'Request failed.';
    }
  }, []);

  const pushBuddyActivity = useCallback(
    (buddyId: string, tone: BuddyActivityToast['tone'], message: string) => {
      if (!buddyId || buddyId === userId) {
        return;
      }

      const activityKey = `${buddyId}:${tone}`;
      const now = Date.now();
      const previousAt = lastBuddyActivityAtRef.current[activityKey] ?? 0;
      if (now - previousAt < PROFILE_ACTIVITY_DEDUPE_MS) {
        return;
      }

      lastBuddyActivityAtRef.current[activityKey] = now;
      const id = `${activityKey}:${now}`;
      setBuddyActivityToasts((previous) => [...previous, { id, buddyId, message, tone }].slice(-4));
      if (tone === 'online' || tone === 'offline') {
        setBuddyListWaveTone(tone);
        window.setTimeout(() => {
          setBuddyListWaveTone((current) => (current === tone ? null : current));
        }, BUDDY_LIST_WAVE_TTL_MS);
      }

      const existingTimeout = activityTimeoutsRef.current[id];
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      activityTimeoutsRef.current[id] = setTimeout(() => {
        setBuddyActivityToasts((previous) => previous.filter((item) => item.id !== id));
        delete activityTimeoutsRef.current[id];
      }, PROFILE_ACTIVITY_TTL_MS);
    },
    [userId],
  );

  const resolveScreennameForUserId = useCallback(
    (targetUserId: string) => {
      if (!targetUserId) {
        return 'Buddy';
      }

      if (targetUserId === userId) {
        return screennameRef.current || 'You';
      }

      return (
        buddyRowsRef.current.find((buddy) => buddy.id === targetUserId)?.screenname ||
        temporaryChatProfilesRef.current[targetUserId]?.screenname ||
        pendingRequestsRef.current.find((request) => request.senderId === targetUserId)?.screenname ||
        'Buddy'
      );
    },
    [userId],
  );

  const parseRoomTags = useCallback((roomName: string) => {
    const tokens = roomName
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean);
    const allowed = ['30s', 'city', 'single', 'divorced', 'late-night', 'music', 'parents', 'local'];
    return allowed.filter((tag) => tokens.includes(tag.replace('-', '')) || roomName.toLowerCase().includes(tag)).slice(0, 3);
  }, []);

  const upsertConversationPreference = useCallback(
    async (
      buddyId: string,
      updater:
        | Partial<Omit<DmConversationPreference, 'buddyId'>>
        | ((current: DmConversationPreference) => Partial<Omit<DmConversationPreference, 'buddyId'>>),
    ) => {
      if (!buddyId) {
        return null;
      }

      const current = getDmPreference(dmPreferencesByBuddyId, buddyId);
      const patch = typeof updater === 'function' ? updater(current) : updater;
      const nextPreference = normalizeDmConversationPreference(buddyId, {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      });

      setDmPreferencesByBuddyId((previous) => ({
        ...previous,
        [buddyId]: nextPreference,
      }));

      if (!userId) {
        return nextPreference;
      }

      const { error } = await supabase.from('user_dm_preferences').upsert(
        {
          user_id: userId,
          buddy_id: buddyId,
          is_pinned: nextPreference.isPinned,
          is_muted: nextPreference.isMuted,
          is_archived: nextPreference.isArchived,
          theme_key: nextPreference.themeKey,
          wallpaper_key: nextPreference.wallpaperKey,
          disappearing_timer_seconds: nextPreference.disappearingTimerSeconds,
        },
        {
          onConflict: 'user_id,buddy_id',
        },
      );

      if (error) {
        console.error('Failed saving conversation preference:', error.message);
      }

      return nextPreference;
    },
    [dmPreferencesByBuddyId, userId],
  );

  const updatePrivacyPreferences = useCallback(
    async (updater: Partial<UserPrivacySettings> | ((current: UserPrivacySettings) => Partial<UserPrivacySettings>)) => {
      const patch = typeof updater === 'function' ? updater(privacySettings) : updater;
      const nextSettings = normalizeUserPrivacySettings({
        ...privacySettings,
        ...patch,
      });

      setPrivacySettings(nextSettings);
      if (!userId) {
        return {
          ok: true as const,
          settings: nextSettings,
          error: null,
        };
      }

      const { error } = await supabase.from('user_privacy_settings').upsert(
        {
          user_id: userId,
          share_read_receipts: nextSettings.shareReadReceipts,
          notification_preview_mode: nextSettings.notificationPreviewMode,
          screen_shield_enabled: nextSettings.screenShieldEnabled,
        },
        {
          onConflict: 'user_id',
        },
      );

      if (error) {
        console.error('Failed saving privacy settings:', error.message);
        return {
          ok: false as const,
          settings: nextSettings,
          error: 'Updated on this device, but the cloud copy could not be saved.',
        };
      }

      return {
        ok: true as const,
        settings: nextSettings,
        error: null,
      };
    },
    [privacySettings, userId],
  );

  const openAppLockSetup = useCallback(() => {
    setAppLockMode('setup');
    setAppLockPinDraft('');
    setAppLockConfirmDraft('');
    setAppLockError(null);
    attemptedBiometricUnlockRef.current = false;
    setIsBiometricAuthenticating(false);
    setShowAppLockSheet(true);
  }, []);

  const handleDisableAppLock = useCallback(() => {
    setAppLockSettings({
      enabled: false,
      pinHash: null,
      autoLockSeconds: appLockSettings.autoLockSeconds,
      biometricsEnabled: false,
    });
    setIsAppLocked(false);
    setAppLockPinDraft('');
    setAppLockConfirmDraft('');
    setAppLockError(null);
    setIsBiometricAuthenticating(false);
    attemptedBiometricUnlockRef.current = false;
    setShowAppLockSheet(false);
  }, [appLockSettings.autoLockSeconds]);

  const handleLockAppNow = useCallback(() => {
    if (!appLockSettings.enabled || !appLockSettings.pinHash) {
      return;
    }

    setAppLockMode('unlock');
    setAppLockPinDraft('');
    setAppLockConfirmDraft('');
    setAppLockError(null);
    attemptedBiometricUnlockRef.current = false;
    setIsBiometricAuthenticating(false);
    setIsAppLocked(true);
    setShowAppLockSheet(true);
  }, [appLockSettings.enabled, appLockSettings.pinHash]);

  const completeAppUnlock = useCallback(() => {
    setAppLockPinDraft('');
    setAppLockConfirmDraft('');
    setAppLockError(null);
    setShowAppLockSheet(false);
    setIsAppLocked(false);
    setIsBiometricAuthenticating(false);
    attemptedBiometricUnlockRef.current = false;
  }, []);

  const handleUseBiometrics = useCallback(async () => {
    if (!appLockSettings.enabled || !appLockSettings.biometricsEnabled || !biometricAvailability.isAvailable) {
      return;
    }

    setAppLockError(null);
    setIsBiometricAuthenticating(true);

    try {
      await authenticateWithBiometrics('Unlock H.I.M.');
      completeAppUnlock();
    } catch (error) {
      const errorCode = getBiometricErrorCode(error);
      if (errorCode === 'userCancel' || errorCode === 'userFallback' || errorCode === 'systemCancel') {
        setIsBiometricAuthenticating(false);
        return;
      }

      console.error('Biometric authentication failed:', error);
      setIsBiometricAuthenticating(false);
      setAppLockError(`${biometricAvailability.label} wasn't available. Use your PIN instead.`);
      void checkBiometricAvailability().then((nextAvailability) => {
        setBiometricAvailability(nextAvailability);
      });
    }
  }, [
    appLockSettings.biometricsEnabled,
    appLockSettings.enabled,
    biometricAvailability.isAvailable,
    biometricAvailability.label,
    completeAppUnlock,
  ]);

  const handleSubmitAppLock = useCallback(async () => {
    if (appLockMode === 'setup') {
      if (!isValidAppLockPin(appLockPinDraft)) {
        setAppLockError('Choose a 4 to 6 digit PIN.');
        return;
      }

      if (appLockPinDraft !== appLockConfirmDraft) {
        setAppLockError('Those PINs do not match.');
        return;
      }

      const pinHash = await hashAppLockPin(appLockPinDraft);
      setAppLockSettings({
        enabled: true,
        pinHash,
        autoLockSeconds: appLockSettings.autoLockSeconds,
        biometricsEnabled: biometricAvailability.isAvailable,
      });
      setAppLockPinDraft('');
      setAppLockConfirmDraft('');
      setAppLockError(null);
      setIsBiometricAuthenticating(false);
      attemptedBiometricUnlockRef.current = false;
      setShowAppLockSheet(false);
      setIsAppLocked(false);
      return;
    }

    if (!(await verifyAppLockPin(appLockPinDraft, appLockSettings.pinHash))) {
      setAppLockError('That PIN does not match this device lock.');
      return;
    }

    completeAppUnlock();
  }, [
    appLockConfirmDraft,
    appLockMode,
    appLockPinDraft,
    appLockSettings.autoLockSeconds,
    appLockSettings.pinHash,
    biometricAvailability.isAvailable,
    completeAppUnlock,
  ]);

  useEffect(() => {
    if (!showAppLockSheet || appLockMode !== 'unlock') {
      attemptedBiometricUnlockRef.current = false;
      setIsBiometricAuthenticating(false);
      return;
    }

    if (
      !appLockSettings.enabled ||
      !appLockSettings.biometricsEnabled ||
      !biometricAvailability.isAvailable ||
      attemptedBiometricUnlockRef.current
    ) {
      return;
    }

    attemptedBiometricUnlockRef.current = true;
    void handleUseBiometrics();
  }, [
    appLockMode,
    appLockSettings.biometricsEnabled,
    appLockSettings.enabled,
    biometricAvailability.isAvailable,
    handleUseBiometrics,
    showAppLockSheet,
  ]);

  const handleBlockBuddyById = useCallback(
    async (buddyId: string) => {
      if (!userId || !buddyId) {
        return false;
      }

      setTrustSafetyError(null);
      setProfileSheetError(null);
      setProfileSheetFeedback(null);
      setIsBlockingBuddyId(buddyId);

      const { error: blockError } = await supabase.from('blocked_users').upsert(
        {
          blocker_id: userId,
          blocked_id: buddyId,
        },
        { onConflict: 'blocker_id,blocked_id' },
      );

      if (blockError) {
        setIsBlockingBuddyId(null);
        const message = isTrustSafetySchemaMissingError(blockError)
          ? 'Run trust_safety_slice.sql to enable blocking and reporting.'
          : blockError.message;
        setTrustSafetyError(message);
        setProfileSheetError(message);
        return false;
      }

      const { error: cleanupError } = await supabase
        .from('buddies')
        .delete()
        .or(`and(user_id.eq.${userId},buddy_id.eq.${buddyId}),and(user_id.eq.${buddyId},buddy_id.eq.${userId})`);

      if (cleanupError) {
        console.warn('Blocked buddy relationship cleanup failed:', cleanupError.message);
      }

      setBlockedUserIds((previous) => (previous.includes(buddyId) ? previous : [...previous, buddyId]));
      setPendingRequests((previous) => previous.filter((request) => request.senderId !== buddyId));
      setTemporaryChatAllowedIds((previous) => previous.filter((id) => id !== buddyId));
      setTemporaryChatProfiles((previous) => {
        const next = { ...previous };
        delete next[buddyId];
        return next;
      });
      setSearchResults((previous) => previous.filter((profile) => profile.id !== buddyId));

      if (activeChatBuddyIdRef.current === buddyId) {
        setActiveChatBuddyId(null);
        activeChatBuddyIdRef.current = null;
        setInitialUnreadForActiveChat(0);
        setActiveDmTypingText(null);
        setChatMessages([]);
        setChatError(null);
        replaceAppPathInPlace(HI_ITS_ME_PATH);
      }

      setProfileSheetFeedback('Buddy blocked. They can no longer send you new messages or requests.');
      setIsBlockingBuddyId(null);
      return true;
    },
    [userId],
  );

  const handleUnblockBuddyById = useCallback(
    async (buddyId: string) => {
      if (!userId || !buddyId) {
        return false;
      }

      setTrustSafetyError(null);
      setProfileSheetError(null);
      setProfileSheetFeedback(null);
      setIsBlockingBuddyId(buddyId);
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('blocker_id', userId)
        .eq('blocked_id', buddyId);

      setIsBlockingBuddyId(null);

      if (error) {
        const message = isTrustSafetySchemaMissingError(error)
          ? 'Run trust_safety_slice.sql to enable blocking and reporting.'
          : error.message;
        setTrustSafetyError(message);
        setProfileSheetError(message);
        return false;
      }

      setBlockedUserIds((previous) => previous.filter((id) => id !== buddyId));
      setProfileSheetFeedback('Buddy unblocked.');
      return true;
    },
    [userId],
  );

  const handleReportBuddy = useCallback(
    async (buddyId: string, payload: { category: AbuseReportCategory; details: string }) => {
      if (!userId || !buddyId) {
        return false;
      }

      setTrustSafetyError(null);
      setProfileSheetError(null);
      setProfileSheetFeedback(null);
      setIsReportingBuddyId(buddyId);

      const { error } = await supabase.from('abuse_reports').insert({
        reporter_id: userId,
        target_user_id: buddyId,
        category: payload.category,
        details: payload.details || null,
      });

      setIsReportingBuddyId(null);

      if (error) {
        const message = isTrustSafetySchemaMissingError(error)
          ? 'Run trust_safety_slice.sql to enable blocking and reporting.'
          : error.message;
        setTrustSafetyError(message);
        setProfileSheetError(message);
        return false;
      }

      const categoryLabel =
        ABUSE_REPORT_CATEGORY_OPTIONS.find((option) => option.value === payload.category)?.label ?? 'Report';
      setProfileSheetFeedback(`${categoryLabel} report sent. Thanks for flagging it.`);
      return true;
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) {
      setOutboxItems([]);
      return;
    }
    setOutboxItems(loadOutbox(userId));
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }
    saveOutbox(userId, outboxItems);
  }, [outboxItems, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const unsubscribe = subscribeToStorageKey(getOutboxStorageKey(userId), () => {
      setOutboxItems(loadOutbox(userId));
    });
    return () => {
      unsubscribe();
    };
  }, [userId]);

  const upsertOutboxItem = useCallback((item: OutboxItem) => {
    setOutboxItems((previous) => normalizeOutboxItems([...previous.filter((candidate) => candidate.id !== item.id), item]));
  }, []);

  const removeOutboxItem = useCallback((itemId: string) => {
    setOutboxItems((previous) => previous.filter((candidate) => candidate.id !== itemId));
  }, []);

  const flushOutbox = useCallback(async () => {
    if (!userId || isFlushingOutboxRef.current) {
      return;
    }

    const snapshot = outboxItemsRef.current;
    if (snapshot.length === 0) {
      return;
    }

    isFlushingOutboxRef.current = true;
    try {
      let nextItems = [...snapshot];
      const nowMs = Date.now();

      for (const item of snapshot) {
        if (item.status === 'sending') {
          continue;
        }

        if (!isOutboxItemDue(item, nowMs)) {
          continue;
        }

        nextItems = nextItems.map((candidate) =>
          candidate.id === item.id ? markOutboxSending(candidate) : candidate,
        );
        setOutboxItems(normalizeOutboxItems(nextItems));

        if (item.type === 'dm') {
          const { data, error } = await sendDirectMessageWithClientMessageId({
            senderId: userId,
            receiverId: item.targetId,
            content: item.content,
            clientMessageId: item.id,
            expiresAt: item.expiresAt,
            replyToMessageId: item.replyToMessageId,
            forwardSourceMessageId: item.forwardSourceMessageId,
            forwardSourceSenderId: item.forwardSourceSenderId,
            previewType: item.previewType,
          });

          if (error) {
            nextItems = nextItems.map((candidate) =>
              candidate.id === item.id ? markOutboxAttemptFailure(candidate, error.message) : candidate,
            );
            setOutboxItems(normalizeOutboxItems(nextItems));
            continue;
          }

          const insertedMessage = data as ChatMessage;
          setBuddyLastMessageAt((previous) => ({
            ...previous,
            [item.targetId]: insertedMessage.created_at,
          }));
          if (activeChatBuddyIdRef.current === item.targetId) {
            setChatMessages((previous) =>
              previous.some((message) => message.id === insertedMessage.id)
                ? previous
                : [...previous, insertedMessage],
            );
          }
          nextItems = nextItems.filter((candidate) => candidate.id !== item.id);
          setOutboxItems(normalizeOutboxItems(nextItems));
          continue;
        }

        const { data, error } = await sendRoomMessageWithClientMessageId({
          roomId: item.targetId,
          senderId: userId,
          content: item.content,
          clientMessageId: item.id,
        });
        if (error) {
          nextItems = nextItems.map((candidate) =>
            candidate.id === item.id ? markOutboxAttemptFailure(candidate, error.message) : candidate,
          );
          setOutboxItems(normalizeOutboxItems(nextItems));
          continue;
        }
        if (activeRoom?.id === item.targetId && data) {
          setActiveRoomReloadToken((previous) => previous + 1);
        }
        nextItems = nextItems.filter((candidate) => candidate.id !== item.id);
        setOutboxItems(normalizeOutboxItems(nextItems));
      }

      setOutboxItems(normalizeOutboxItems(nextItems));
    } finally {
      isFlushingOutboxRef.current = false;
    }
  }, [activeRoom?.id, userId]);

  useEffect(() => {
    if (!userId || typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const handleOnline = () => {
      void flushOutbox();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void flushOutbox();
      }
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void flushOutbox();
      }
    }, 8000);

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    void flushOutbox();

    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.clearInterval(intervalId);
    };
  }, [flushOutbox, userId]);

  useEffect(() => {
    if (!userId || outboxItems.length === 0 || typeof navigator === 'undefined' || !navigator.onLine) {
      return;
    }

    void flushOutbox();
  }, [flushOutbox, outboxItems.length, userId]);

  const queueOutboxMessage = useCallback(
    (item: {
      type: 'dm' | 'room';
      targetId: string;
      content: string;
      clientMessageId?: string;
      status?: OutboxItemStatus;
      expiresAt?: string | null;
      replyToMessageId?: number | null;
      forwardSourceMessageId?: number | null;
      forwardSourceSenderId?: string | null;
      previewType?: 'text' | 'attachment' | 'forwarded' | 'voice_note' | 'buzz';
    }) => {
      if (!userId) {
        return null;
      }

      const trimmedContent = item.content.trim();
      if (!trimmedContent) {
        return null;
      }

      const entry = createOutboxItem({
        type: item.type,
        targetId: item.targetId,
        content: trimmedContent,
        clientMessageId: item.clientMessageId,
        status: item.status,
        expiresAt: item.expiresAt,
        replyToMessageId: item.replyToMessageId,
        forwardSourceMessageId: item.forwardSourceMessageId,
        forwardSourceSenderId: item.forwardSourceSenderId,
        previewType: item.previewType,
      });
      upsertOutboxItem(entry);
      return entry;
    },
    [upsertOutboxItem, userId],
  );

  const retryOutboxMessage = useCallback(
    (itemId: string) => {
      let didScheduleRetry = false;
      setOutboxItems((previous) =>
        normalizeOutboxItems(
          previous.map((item) => {
            if (item.id !== itemId) {
              return item;
            }
            didScheduleRetry = true;
            return scheduleOutboxRetryNow(item);
          }),
        ),
      );

      if (didScheduleRetry && (typeof navigator === 'undefined' || navigator.onLine)) {
        void flushOutbox();
      }
    },
    [flushOutbox],
  );

  const saveMessageToSavedMessages = useCallback(
    async ({
      content,
      sourceMessage,
    }: {
      content: string;
      sourceMessage?: ChatMessage | null;
    }) => {
      if (!userId) {
        return null;
      }

      const trimmedContent = content.trim();
      if (!trimmedContent) {
        return null;
      }

      setSavedMessageError(null);
      const payload = {
        user_id: userId,
        content: trimmedContent,
        source_message_id: sourceMessage?.id ?? null,
        source_sender_id: sourceMessage?.sender_id ?? null,
        source_screenname: sourceMessage ? resolveScreennameForUserId(sourceMessage.sender_id) : null,
      };

      const { data, error } = await supabase
        .from('saved_messages')
        .insert(payload)
        .select('id,user_id,content,source_message_id,source_sender_id,source_screenname,created_at,updated_at')
        .single();

      if (error) {
        setSavedMessageError(error.message);
        return null;
      }

      const nextEntry = data as SavedMessageRow;
      setSavedMessages((previous) => [nextEntry, ...previous.filter((entry) => entry.id !== nextEntry.id)].slice(0, 200));
      return nextEntry;
    },
    [resolveScreennameForUserId, userId],
  );

  const handleSaveSavedMessageDraft = useCallback(async () => {
    setIsSavingSavedMessage(true);
    try {
      const saved = await saveMessageToSavedMessages({
        content: savedMessageDraft,
      });
      if (saved) {
        setSavedMessageDraft('');
      }
    } finally {
      setIsSavingSavedMessage(false);
    }
  }, [saveMessageToSavedMessages, savedMessageDraft]);

  const handleDeleteSavedMessage = useCallback(
    async (entryId: string) => {
      if (!entryId) {
        return;
      }

      setDeletingSavedMessageId(entryId);
      const { error } = await supabase
        .from('saved_messages')
        .delete()
        .eq('id', entryId)
        .eq('user_id', userId);
      setDeletingSavedMessageId(null);

      if (error) {
        setSavedMessageError(error.message);
        return;
      }

      setSavedMessages((previous) => previous.filter((entry) => entry.id !== entryId));
    },
    [userId],
  );

  const handleSaveDirectMessage = useCallback(
    async (message: ChatMessage) => {
      const saved = await saveMessageToSavedMessages({ content: message.content, sourceMessage: message });
      if (saved) {
        setShowSavedMessagesWindow(true);
      }
    },
    [saveMessageToSavedMessages],
  );

  const handleForwardMessageToTarget = useCallback(
    async (message: ChatMessage, targetBuddyId: string | 'saved') => {
      if (!userId) {
        return;
      }

      setForwardError(null);

      if (targetBuddyId === 'saved') {
        setIsForwardingToId('saved');
        const saved = await saveMessageToSavedMessages({ content: message.content, sourceMessage: message });
        setIsForwardingToId(null);
        if (saved) {
          setForwardingMessage(null);
          setShowSavedMessagesWindow(true);
        }
        return;
      }

      setIsForwardingToId(targetBuddyId);
      const clientMessageId = createClientMessageId();
      const expiresAt = getMessageExpiresAt(
        getDmPreference(dmPreferencesByBuddyId, targetBuddyId).disappearingTimerSeconds,
      );
      const trackedOutboxItem = queueOutboxMessage({
        type: 'dm',
        targetId: targetBuddyId,
        content: message.content,
        clientMessageId,
        status: 'sending',
        expiresAt,
        forwardSourceMessageId: message.id,
        forwardSourceSenderId: message.sender_id,
        previewType: 'forwarded',
      });

      const { data, error } = await sendDirectMessageWithClientMessageId({
        senderId: userId,
        receiverId: targetBuddyId,
        content: message.content,
        clientMessageId,
        expiresAt,
        forwardSourceMessageId: message.id,
        forwardSourceSenderId: message.sender_id,
        previewType: 'forwarded',
      });

      setIsForwardingToId(null);

      if (error) {
        const isLikelyNetworkIssue =
          (typeof navigator !== 'undefined' && !navigator.onLine) ||
          /network|fetch|offline|timeout/i.test(error.message);
        if (trackedOutboxItem) {
          if (isLikelyNetworkIssue) {
            setOutboxItems((previous) =>
              normalizeOutboxItems(
                previous.map((item) =>
                  item.id === trackedOutboxItem.id ? markOutboxAttemptFailure(item, error.message) : item,
                ),
              ),
            );
            setForwardError('Offline: forward queued and will retry automatically.');
            return;
          }

          removeOutboxItem(trackedOutboxItem.id);
        }

        setForwardError(error.message);
        return;
      }

      const insertedMessage = data as ChatMessage;
      setBuddyLastMessageAt((previous) => ({
        ...previous,
        [targetBuddyId]: insertedMessage.created_at,
      }));
      if (activeChatBuddyIdRef.current === targetBuddyId) {
        setChatMessages((previous) =>
          previous.some((candidate) => candidate.id === insertedMessage.id)
            ? previous
            : [...previous, insertedMessage],
        );
      }
      if (trackedOutboxItem) {
        removeOutboxItem(trackedOutboxItem.id);
      }
      setForwardingMessage(null);
    },
    [dmPreferencesByBuddyId, queueOutboxMessage, removeOutboxItem, saveMessageToSavedMessages, userId],
  );

  const updateDmDraft = useCallback((buddyId: string, draft: string) => {
    if (!buddyId) {
      return;
    }

    setDraftCache((previous) => {
      const nextDm = { ...previous.dm };
      const trimmedDraft = draft.slice(0, UI_MAX_DRAFT_LENGTH);
      if (trimmedDraft.trim().length === 0) {
        delete nextDm[buddyId];
      } else {
        nextDm[buddyId] = trimmedDraft;
      }
      return {
        ...previous,
        dm: nextDm,
      };
    });
  }, []);

  const updateRoomDraft = useCallback((roomName: string, draft: string) => {
    const roomKey = normalizeRoomKey(roomName);
    if (!roomKey) {
      return;
    }

    setDraftCache((previous) => {
      const nextRoomDrafts = { ...previous.rooms };
      const trimmedDraft = draft.slice(0, UI_MAX_DRAFT_LENGTH);
      if (trimmedDraft.trim().length === 0) {
        delete nextRoomDrafts[roomKey];
      } else {
        nextRoomDrafts[roomKey] = trimmedDraft;
      }
      return {
        ...previous,
        rooms: nextRoomDrafts,
      };
    });
  }, []);

  const markProfileSchemaUnavailable = useCallback((error?: { message?: string | null } | null) => {
    if (error?.message) {
      console.warn('Presence/profile migration missing:', error.message);
    }
    setIsProfileSchemaUnavailable(true);
  }, []);

  const loadManyUserProfiles = useCallback(
    async ({
      includeEmail = false,
      applyFilters,
    }: {
      includeEmail?: boolean;
      applyFilters: (query: UserSelectQuery) => UserSelectQuery;
    }) => {
      const runQuery = async (fields: string) => {
        const { data, error } = await applyFilters(supabase.from('users').select(fields));
        return {
          data: normalizeUserProfileList((data ?? []) as Partial<UserProfile>[]),
          error,
        };
      };

      let result = await runQuery(
        includeEmail ? EXTENDED_USER_PROFILE_WITH_EMAIL_SELECT_FIELDS : EXTENDED_USER_PROFILE_SELECT_FIELDS,
      );

      if (isProfileSchemaMissingError(result.error)) {
        markProfileSchemaUnavailable(result.error);
        result = await runQuery(
          includeEmail ? LEGACY_USER_PROFILE_WITH_EMAIL_SELECT_FIELDS : LEGACY_USER_PROFILE_SELECT_FIELDS,
        );
      }

      return result;
    },
    [markProfileSchemaUnavailable],
  );

  const loadSingleUserProfile = useCallback(
    async ({
      includeEmail = false,
      applyFilters,
    }: {
      includeEmail?: boolean;
      applyFilters: (query: UserSelectQuery) => UserSelectQuery;
    }) => {
      const runQuery = async (fields: string) => {
        const { data, error } = await applyFilters(supabase.from('users').select(fields)).maybeSingle();
        return {
          data: normalizeUserProfile((data as Partial<UserProfile> | null) ?? null),
          error,
        };
      };

      let result = await runQuery(
        includeEmail ? EXTENDED_USER_PROFILE_WITH_EMAIL_SELECT_FIELDS : EXTENDED_USER_PROFILE_SELECT_FIELDS,
      );

      if (isProfileSchemaMissingError(result.error)) {
        markProfileSchemaUnavailable(result.error);
        result = await runQuery(
          includeEmail ? LEGACY_USER_PROFILE_WITH_EMAIL_SELECT_FIELDS : LEGACY_USER_PROFILE_SELECT_FIELDS,
        );
      }

      return result;
    },
    [markProfileSchemaUnavailable],
  );

  useEffect(() => {
    if (!userId || blockedUserIds.length === 0) {
      setBlockedProfiles([]);
      return;
    }

    let isCancelled = false;

    const loadBlockedProfiles = async () => {
      const { data, error } = await loadManyUserProfiles({
        applyFilters: (query) => query.in('id', blockedUserIds),
      });

      if (isCancelled) {
        return;
      }

      if (error) {
        console.warn('Blocked profile lookup unavailable:', error.message);
        return;
      }

      setBlockedProfiles(data);
    };

    void loadBlockedProfiles();

    return () => {
      isCancelled = true;
    };
  }, [blockedUserIds, loadManyUserProfiles, userId]);

  const loadBuddies = useCallback(async (targetUserId: string) => {
    setIsLoadingBuddies(true);

    const { data: relationships, error: relationshipsError } = await supabase
      .from('buddies')
      .select('user_id,buddy_id,status')
      .or(`user_id.eq.${targetUserId},buddy_id.eq.${targetUserId}`)
      .in('status', ['accepted', 'pending']);

    if (relationshipsError) {
      console.error('Failed to load buddies:', relationshipsError.message);
      setIsLoadingBuddies(false);
      return;
    }

    const relationshipRows = (relationships ?? []) as BuddyRelationshipRecord[];
    const aggregatedRelationships = aggregateBuddyRelationships(targetUserId, relationshipRows);
    const counterpartIds = Array.from(
      new Set([
        ...aggregatedRelationships.acceptedBuddyIds,
        ...aggregatedRelationships.incomingPendingBuddyIds,
        ...aggregatedRelationships.outgoingPendingBuddyIds,
      ]),
    );

    const { data: profiles, error: profilesError } =
      counterpartIds.length > 0
        ? await loadManyUserProfiles({
            applyFilters: (query) => query.in('id', counterpartIds),
          })
        : { data: [], error: null };

    if (profilesError) {
      console.error('Failed to load buddy profiles:', profilesError.message);
    }

    const profileMap = new Map(
      profiles.map((profile) => [
        profile.id,
        profile,
      ]),
    );

    const mergedRows = aggregatedRelationships.rows.map((relationship) => {
      const profile = profileMap.get(relationship.buddyId);
      return {
        id: relationship.buddyId,
        screenname: profile?.screenname?.trim() || 'Unknown Buddy',
        status: profile?.status ?? null,
        away_message: profile?.away_message ?? null,
        status_msg: profile?.status_msg ?? null,
        profile_bio: profile?.profile_bio ?? null,
        buddy_icon_path: profile?.buddy_icon_path ?? null,
        idle_since: profile?.idle_since ?? null,
        last_active_at: profile?.last_active_at ?? null,
        relationshipStatus: relationship.relationshipStatus,
      } as Buddy;
    });

    const dedupedRows = Array.from(new Map(mergedRows.map((row) => [row.id, row])).values()).sort(
      (left, right) => left.screenname.localeCompare(right.screenname, undefined, { sensitivity: 'base' }),
    );

    const persistentIncomingRequests = aggregatedRelationships.incomingPendingBuddyIds
      .map((buddyId) => {
        const profile = profileMap.get(buddyId);
        return {
          senderId: buddyId,
          screenname: profile?.screenname?.trim() || 'Unknown User',
        } as PendingRequest;
      })
      .sort((left, right) => left.screenname.localeCompare(right.screenname, undefined, { sensitivity: 'base' }));

    setBuddyRows(dedupedRows);
    setPendingRequests((previous) => {
      const relationshipIds = new Set(counterpartIds);
      const merged = new Map<string, PendingRequest>();

      for (const request of previous) {
        if (relationshipIds.has(request.senderId)) {
          continue;
        }
        merged.set(request.senderId, request);
      }

      for (const request of persistentIncomingRequests) {
        merged.set(request.senderId, request);
      }

      return Array.from(merged.values()).sort((left, right) =>
        left.screenname.localeCompare(right.screenname, undefined, { sensitivity: 'base' }),
      );
    });
    setSelectedBuddyId((previous) =>
      previous && dedupedRows.some((buddy) => buddy.id === previous)
        ? previous
        : (dedupedRows[0]?.id ?? null),
    );
    setIsLoadingBuddies(false);
  }, [loadManyUserProfiles]);

  const pullToRefresh = usePullToRefresh({
    onRefresh: async () => {
      if (!userId) return;
      await Promise.all([loadBuddies(userId), syncFromServer()]);
    },
  });

  const syncUnreadDirectFromServer = useCallback(async (targetUserId: string) => {
    const { data, error } = await supabase
      .from('user_dm_state')
      .select('user_id,buddy_id,unread_count,updated_at')
      .eq('user_id', targetUserId);

    if (error) {
      console.error('Failed to sync DM unread state:', error.message);
      return;
    }

    const rows = (data ?? []) as UserDmStateRowLite[];
    setUnreadDirectMessages(mapRowsToUnreadDirectMessages(rows));
  }, []);

  useEffect(() => {
    const bootstrapUser = async () => {
      const session = await waitForSessionOrNull();
      if (!session) {
        navigateAppPath(router, '/', { replace: true });
        return;
      }

      const metaScreenname =
        typeof session.user.user_metadata?.screenname === 'string'
          ? session.user.user_metadata.screenname.trim()
          : '';
      const emailFallback = session.user.email?.split('@')[0] ?? 'Unknown User';
      const fallbackName = metaScreenname || emailFallback;

      const { data: userProfile, error: profileError } = await loadSingleUserProfile({
        includeEmail: true,
        applyFilters: (query) => query.eq('id', session.user.id),
      });

      if (profileError) {
        console.error('Failed to fetch profile:', profileError.message);
      }

      const existingProfile = userProfile;
      const resolvedScreenname = existingProfile?.screenname?.trim() || fallbackName;
      const resolvedStatusState = resolveStatusFields({
        status: existingProfile?.status,
        awayMessage: existingProfile?.away_message,
        statusMessage: existingProfile?.status_msg,
      });
      const userEmail = session.user.email ?? existingProfile?.email ?? null;
      const metadataScreenname =
        typeof session.user.user_metadata?.screenname === 'string'
          ? session.user.user_metadata.screenname.trim()
          : '';

      if (!userEmail) {
        console.error('Failed to sync profile: authenticated user has no email.');
        await supabase.auth.signOut();
        navigateAppPath(router, '/', { replace: true });
        return;
      }

      const bootstrapProfilePayload = {
        id: session.user.id,
        email: userEmail,
        screenname: metadataScreenname || resolvedScreenname,
        status: resolvedStatusState.status,
        away_message: resolvedStatusState.awayMessage || null,
        status_msg: resolvedStatusState.statusMessage,
        profile_bio: existingProfile?.profile_bio?.trim() || null,
        buddy_icon_path: existingProfile?.buddy_icon_path ?? null,
        idle_since: null,
        last_active_at: new Date().toISOString(),
        is_online: true,
      };

      let { error: upsertError } = await supabase.from('users').upsert(bootstrapProfilePayload, {
        onConflict: 'id',
      });

      if (isProfileSchemaMissingError(upsertError)) {
        markProfileSchemaUnavailable(upsertError);
        ({ error: upsertError } = await supabase.from('users').upsert(
          {
            id: session.user.id,
            email: userEmail,
            screenname: metadataScreenname || resolvedScreenname,
            status: resolvedStatusState.status,
            away_message: resolvedStatusState.awayMessage || null,
            status_msg: resolvedStatusState.statusMessage,
            is_online: true,
          },
          { onConflict: 'id' },
        ));
      }

      if (upsertError) {
        console.error('Failed to sync profile:', upsertError.message);
      }

      setUserId(session.user.id);
      setScreenname(resolvedScreenname);
      setStatusMsg(resolvedStatusState.statusMessage);
      setUserStatus(resolvedStatusState.status);
      setAwayMessage(resolvedStatusState.awayMessage);
      setProfileBio(existingProfile?.profile_bio?.trim() || '');
      setBuddyIconPath(existingProfile?.buddy_icon_path ?? null);
      setIdleSinceAt(null);
      setLastActiveAt(existingProfile?.last_active_at ?? new Date().toISOString());
      lastActivityAtRef.current = Date.now();
      lastPresenceWriteAtRef.current = Date.now();
      setAwaySinceAt(resolvedStatusState.status === AWAY_STATUS ? new Date().toISOString() : null);
      let hasRecoveryCode = true;
      const { data: recoveryData, error: recoveryError } = await supabase
        .from('account_recovery_codes')
        .select('user_id')
        .eq('user_id', session.user.id)
        .maybeSingle();

      if (recoveryError) {
        console.error('Failed to check recovery code status:', recoveryError.message);
      } else {
        hasRecoveryCode = Boolean(recoveryData);
      }

      if (!hasRecoveryCode && session.access_token) {
        const pendingRecoveryCode = readPendingSignupRecoveryDraft(resolvedScreenname);
        if (pendingRecoveryCode) {
          try {
            const recoveryResponse = await fetch(getAppApiUrl('/api/auth/recovery/setup'), {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ recoveryCode: pendingRecoveryCode }),
            });

            if (recoveryResponse.ok) {
              hasRecoveryCode = true;
              clearPendingSignupRecoveryDraft(resolvedScreenname);
            } else {
              const recoveryMessage = await readApiError(recoveryResponse);
              setRecoverySetupError(recoveryMessage);
            }
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Could not finish recovery setup.';
            setRecoverySetupError(message);
          }
        }
      }

      setIsRecoverySetupOpen(!hasRecoveryCode);

      let adminFlag = false;
      if (session.access_token) {
        try {
          const adminResponse = await fetch(getAppApiUrl('/api/admin/me'), {
            method: 'GET',
            cache: 'no-store',
            headers: {
              authorization: `Bearer ${session.access_token}`,
            },
          });

          if (adminResponse.ok) {
            const adminPayload = (await adminResponse.json()) as AdminMeResponse;
            adminFlag = Boolean(adminPayload.isAdmin);
          } else {
            const adminError = await readApiError(adminResponse);
            console.error(`Admin check via /api/admin/me failed (${adminResponse.status}):`, adminError);
          }
        } catch (error) {
          console.error('Admin check via app API failed:', error);
        }
      } else {
        console.warn('Admin check skipped because the access token was missing.');
      }

      if (!adminFlag) {
        const { data: adminFallbackData, error: adminFallbackError } = await supabase
          .from('admin_users')
          .select('user_id')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (adminFallbackError) {
          console.error('Fallback admin_users check failed:', adminFallbackError.message);
        } else {
          adminFlag = Boolean(adminFallbackData);
        }
      }

      setIsAdminUser(adminFlag);
      setIsBootstrapping(false);
      void loadBuddies(session.user.id);
      void syncUnreadDirectFromServer(session.user.id);
    };

    void bootstrapUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!nextSession) {
        navigateAppPath(router, '/', { replace: true });
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadBuddies, loadSingleUserProfile, markProfileSchemaUnavailable, readApiError, router, syncUnreadDirectFromServer]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const outgoingBuddiesChannel = supabase
      .channel(`buddies:outgoing:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'buddies', filter: `user_id=eq.${userId}` },
        () => {
          void loadBuddies(userId);
        },
      )
      .subscribe();

    const incomingBuddiesChannel = supabase
      .channel(`buddies:incoming:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'buddies', filter: `buddy_id=eq.${userId}` },
        () => {
          void loadBuddies(userId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(outgoingBuddiesChannel);
      void supabase.removeChannel(incomingBuddiesChannel);
    };
  }, [loadBuddies, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const blockedUsersChannel = supabase
      .channel(`blocked_users:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'blocked_users', filter: `blocker_id=eq.${userId}` },
        async () => {
          const { data, error } = await supabase
            .from('blocked_users')
            .select('blockedId:blocked_id')
            .eq('blocker_id', userId);

          if (error) {
            if (!isTrustSafetySchemaMissingError(error)) {
              console.error('Failed to sync blocked users:', error.message);
            }
            return;
          }

          setBlockedUserIds(normalizeBlockedUserIds((data ?? []) as Array<{ blockedId?: string | null }>));
          void loadBuddies(userId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(blockedUsersChannel);
    };
  }, [loadBuddies, userId]);

  useEffect(() => {
    if (!userId) {
      setUnreadDirectMessages({});
      return;
    }

    void syncUnreadDirectFromServer(userId);

    const dmStateChannel = supabase
      .channel(`dm_state:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_dm_state', filter: `user_id=eq.${userId}` },
        (payload) => {
          const eventType = payload.eventType as DmStateEventType;
          const row =
            payload.eventType === 'DELETE'
              ? (payload.old as Partial<UserDmStateRowLite>)
              : (payload.new as UserDmStateRowLite);

          setUnreadDirectMessages((previous) => applyDmStateEvent(previous, eventType, row));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(dmStateChannel);
    };
  }, [syncUnreadDirectFromServer, userId]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const usersChannel = supabase
      .channel(`users:${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' }, (payload) => {
        const updated = payload.new as Partial<UserProfile> & { id?: string };
        if (!updated.id) {
          return;
        }

        let buddyWentAway = false;
        let buddyCameBack = false;
        let updatedBuddyScreenname = '';
        setBuddyRows((previous) => {
          if (!previous.some((buddy) => buddy.id === updated.id)) {
            return previous;
          }
          return previous.map((buddy) => {
            if (buddy.id !== updated.id) {
              return buddy;
            }

            const nextStatus =
              typeof updated.status === 'string'
                ? updated.status
                : updated.status === null
                  ? null
                  : buddy.status;
            const wasAway = normalizeStatusLabel(buddy.status) === AWAY_STATUS;
            const isAway = normalizeStatusLabel(nextStatus) === AWAY_STATUS;
            if (!wasAway && isAway) {
              buddyWentAway = true;
            } else if (wasAway && !isAway) {
              buddyCameBack = true;
            }

            updatedBuddyScreenname =
              typeof updated.screenname === 'string' && updated.screenname.trim()
                ? updated.screenname
                : buddy.screenname;

            return {
              ...buddy,
              screenname: updatedBuddyScreenname,
              status: nextStatus,
              away_message:
                typeof updated.away_message === 'string'
                  ? updated.away_message
                  : updated.away_message === null
                    ? null
                    : buddy.away_message,
              status_msg:
                typeof updated.status_msg === 'string'
                  ? updated.status_msg
                  : updated.status_msg === null
                    ? null
                    : buddy.status_msg,
              profile_bio:
                typeof updated.profile_bio === 'string'
                  ? updated.profile_bio
                  : updated.profile_bio === null
                    ? null
                    : buddy.profile_bio,
              buddy_icon_path:
                typeof updated.buddy_icon_path === 'string'
                  ? updated.buddy_icon_path
                  : updated.buddy_icon_path === null
                    ? null
                    : buddy.buddy_icon_path,
              idle_since:
                typeof updated.idle_since === 'string'
                  ? updated.idle_since
                  : updated.idle_since === null
                    ? null
                    : buddy.idle_since,
              last_active_at:
                typeof updated.last_active_at === 'string'
                  ? updated.last_active_at
                  : updated.last_active_at === null
                    ? null
                    : buddy.last_active_at,
            };
          });
        });

        if (updated.id !== userId && acceptedBuddyIdsRef.current.has(updated.id)) {
          if (buddyWentAway) {
            playSound(BUDDY_GOING_AWAY_SOUND);
            pushBuddyActivity(updated.id, 'away', `${updatedBuddyScreenname || 'Buddy'} went away`);
          } else if (buddyCameBack) {
            playSound(BUDDY_SIGN_ON_SOUND);
            pushBuddyActivity(updated.id, 'back', `${updatedBuddyScreenname || 'Buddy'} came back`);
          }
        }

        if (updated.id === userId) {
          if (typeof updated.screenname === 'string' && updated.screenname.trim()) {
            setScreenname(updated.screenname);
          }
          if (typeof updated.profile_bio === 'string' || updated.profile_bio === null) {
            setProfileBio(updated.profile_bio?.trim() || '');
          }
          if (typeof updated.buddy_icon_path === 'string' || updated.buddy_icon_path === null) {
            setBuddyIconPath(updated.buddy_icon_path ?? null);
          }
          if (typeof updated.idle_since === 'string' || updated.idle_since === null) {
            setIdleSinceAt(updated.idle_since ?? null);
          }
          if (typeof updated.last_active_at === 'string' || updated.last_active_at === null) {
            setLastActiveAt(updated.last_active_at ?? null);
          }
          if (
            typeof updated.status === 'string' ||
            typeof updated.away_message === 'string' ||
            typeof updated.status_msg === 'string' ||
            updated.status === null ||
            updated.away_message === null ||
            updated.status_msg === null
          ) {
            const resolvedStatusState = resolveStatusFields({
              status: updated.status ?? userStatus,
              awayMessage: updated.away_message ?? awayMessage,
              statusMessage: updated.status_msg ?? statusMsg,
            });
            setStatusMsg(resolvedStatusState.statusMessage);
            setUserStatus(resolvedStatusState.status);
            setAwayMessage(resolvedStatusState.awayMessage);
            setAwaySinceAt((previous) =>
              resolvedStatusState.status === AWAY_STATUS ? previous ?? new Date().toISOString() : null,
            );
          }
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(usersChannel);
    };
  }, [awayMessage, playSound, pushBuddyActivity, statusMsg, userId, userStatus]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    hasPresenceSyncedRef.current = false;
    isSigningOffRef.current = false;

    const presenceChannel = supabase.channel('hiitsme-presence', {
      config: {
        presence: {
          key: userId,
        },
      },
    });
    presenceChannelRef.current = presenceChannel;

    presenceChannel.on('presence', { event: 'join' }, (payload) => {
      if (!hasPresenceSyncedRef.current || isSigningOffRef.current) {
        return;
      }

      const joinedUserId = typeof payload.key === 'string' ? payload.key : '';
      if (!joinedUserId || joinedUserId === userId || !acceptedBuddyIdsRef.current.has(joinedUserId)) {
        return;
      }

      playSound(BUDDY_SIGN_ON_SOUND);
      const joinedBuddyName =
        buddyRowsRef.current.find((buddy) => buddy.id === joinedUserId)?.screenname ||
        temporaryChatProfilesRef.current[joinedUserId]?.screenname ||
        'Buddy';
      pushBuddyActivity(joinedUserId, 'online', `${joinedBuddyName} signed on`);
    });

    presenceChannel.on('presence', { event: 'leave' }, (payload) => {
      if (!hasPresenceSyncedRef.current || isSigningOffRef.current) {
        return;
      }

      const leftUserId = typeof payload.key === 'string' ? payload.key : '';
      if (!leftUserId || leftUserId === userId || !acceptedBuddyIdsRef.current.has(leftUserId)) {
        return;
      }

      playSound(BUDDY_SIGN_OFF_SOUND);
      const leftBuddyName =
        buddyRowsRef.current.find((buddy) => buddy.id === leftUserId)?.screenname ||
        temporaryChatProfilesRef.current[leftUserId]?.screenname ||
        'Buddy';
      pushBuddyActivity(leftUserId, 'offline', `${leftBuddyName} signed off`);
    });

    presenceChannel.on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      const nextIds = new Set(Object.keys(state));
      // Only update state when the ID set actually changed — prevents reference
      // churn that causes the entire buddy list to re-render on every join/leave.
      setOnlineUserIds((prev) => {
        if (prev.size === nextIds.size && [...nextIds].every((id) => prev.has(id))) {
          return prev;
        }
        return nextIds;
      });
      hasPresenceSyncedRef.current = true;
    });

    presenceChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void presenceChannel.track({
          user_id: userId,
          online_at: new Date().toISOString(),
        });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        // Reset sync flag so reconnect join floods don't trigger toasts/sounds.
        // Join events after a reconnect are not real sign-ons.
        hasPresenceSyncedRef.current = false;
      }
    });

    return () => {
      if (presenceChannelRef.current === presenceChannel) {
        presenceChannelRef.current = null;
      }
      void presenceChannel.untrack();
      void supabase.removeChannel(presenceChannel);
    };
  }, [playSound, pushBuddyActivity, userId]);

  const buddies = useMemo(
    () =>
      buddyRows.map((buddy) => ({
        ...buddy,
        isOnline: onlineUserIds.has(buddy.id),
      })),
    [buddyRows, onlineUserIds],
  );

  const acceptedBuddies = useMemo(
    () => buddies.filter((buddy) => buddy.relationshipStatus === 'accepted'),
    [buddies],
  );
  const pendingBuddies = useMemo(
    () => buddies.filter((buddy) => buddy.relationshipStatus === 'pending'),
    [buddies],
  );
  const alphabeticallySortedAcceptedBuddies = useMemo(
    () =>
      [...acceptedBuddies].sort((left, right) => {
        const leftPinned = getDmPreference(dmPreferencesByBuddyId, left.id).isPinned;
        const rightPinned = getDmPreference(dmPreferencesByBuddyId, right.id).isPinned;
        if (leftPinned !== rightPinned) {
          return leftPinned ? -1 : 1;
        }
        return left.screenname.localeCompare(right.screenname, undefined, { sensitivity: 'base' });
      }),
    [acceptedBuddies, dmPreferencesByBuddyId],
  );
  const recentActivitySortedAcceptedBuddies = useMemo(
    () =>
      [...acceptedBuddies].sort((left, right) => {
        const leftPinned = getDmPreference(dmPreferencesByBuddyId, left.id).isPinned;
        const rightPinned = getDmPreference(dmPreferencesByBuddyId, right.id).isPinned;
        if (leftPinned !== rightPinned) {
          return leftPinned ? -1 : 1;
        }
        const rightTime = normalizeTimestampMs(buddyLastMessageAt[right.id]);
        const leftTime = normalizeTimestampMs(buddyLastMessageAt[left.id]);
        if (leftTime !== rightTime) {
          return rightTime - leftTime;
        }
        return left.screenname.localeCompare(right.screenname, undefined, { sensitivity: 'base' });
      }),
    [acceptedBuddies, buddyLastMessageAt, dmPreferencesByBuddyId],
  );
  const sortedDirectMessageBuddies = useMemo(() => {
    if (buddySortMode === 'alpha') {
      return alphabeticallySortedAcceptedBuddies;
    }
    if (buddySortMode === 'recent_activity') {
      return recentActivitySortedAcceptedBuddies;
    }
    const online = alphabeticallySortedAcceptedBuddies.filter((buddy) => buddy.isOnline);
    const offline = alphabeticallySortedAcceptedBuddies.filter((buddy) => !buddy.isOnline);
    return [...online, ...offline];
  }, [alphabeticallySortedAcceptedBuddies, buddySortMode, recentActivitySortedAcceptedBuddies]);
  const unarchivedDirectMessageBuddies = useMemo(
    () => sortedDirectMessageBuddies.filter((buddy) => !getDmPreference(dmPreferencesByBuddyId, buddy.id).isArchived),
    [dmPreferencesByBuddyId, sortedDirectMessageBuddies],
  );
  const archivedDirectMessageBuddies = useMemo(
    () => sortedDirectMessageBuddies.filter((buddy) => getDmPreference(dmPreferencesByBuddyId, buddy.id).isArchived),
    [dmPreferencesByBuddyId, sortedDirectMessageBuddies],
  );
  const filteredDirectMessageBuddies = useMemo(() => {
    if (conversationFilter === 'archived') {
      return archivedDirectMessageBuddies;
    }

    const baseList = unarchivedDirectMessageBuddies;
    if (conversationFilter === 'pinned') {
      return baseList.filter((buddy) => getDmPreference(dmPreferencesByBuddyId, buddy.id).isPinned);
    }
    if (conversationFilter === 'unread') {
      return baseList.filter((buddy) => (unreadDirectMessages[buddy.id] ?? 0) > 0);
    }
    return baseList;
  }, [
    archivedDirectMessageBuddies,
    conversationFilter,
    dmPreferencesByBuddyId,
    unreadDirectMessages,
    unarchivedDirectMessageBuddies,
  ]);
  const onlineBuddies = useMemo(
    () => acceptedBuddies.filter((buddy) => buddy.isOnline),
    [acceptedBuddies],
  );
  const visibleOnlineDirectMessageBuddies = useMemo(
    () => filteredDirectMessageBuddies.filter((buddy) => buddy.isOnline),
    [filteredDirectMessageBuddies],
  );
  const visibleOfflineDirectMessageBuddies = useMemo(
    () => filteredDirectMessageBuddies.filter((buddy) => !buddy.isOnline),
    [filteredDirectMessageBuddies],
  );

  const activeChatBuddy = useMemo(() => {
    if (!activeChatBuddyId) {
      return null;
    }

    const knownBuddy = buddies.find((buddy) => buddy.id === activeChatBuddyId);
    if (knownBuddy) {
      return knownBuddy;
    }

    const temporaryProfile = temporaryChatProfiles[activeChatBuddyId];
    if (temporaryProfile) {
      return {
        id: activeChatBuddyId,
        relationshipStatus: 'pending' as const,
        screenname: temporaryProfile.screenname,
        status: temporaryProfile.status,
        away_message: temporaryProfile.away_message,
        status_msg: temporaryProfile.status_msg,
        profile_bio: temporaryProfile.profile_bio,
        buddy_icon_path: temporaryProfile.buddy_icon_path,
        idle_since: temporaryProfile.idle_since,
        last_active_at: temporaryProfile.last_active_at,
        isOnline: true,
      };
    }

    const pendingRequest = pendingRequests.find((request) => request.senderId === activeChatBuddyId);
    if (!pendingRequest) {
      return null;
    }

    return {
      id: activeChatBuddyId,
      relationshipStatus: 'pending' as const,
      screenname: pendingRequest.screenname,
      status: null,
      away_message: null,
      status_msg: null,
      profile_bio: null,
      buddy_icon_path: null,
      idle_since: null,
      last_active_at: null,
      isOnline: true,
    };
  }, [activeChatBuddyId, buddies, pendingRequests, temporaryChatProfiles]);

  const getBuddyPresenceSummary = useCallback(
    (buddy: {
      isOnline: boolean;
      status: string | null;
      away_message: string | null;
      status_msg: string | null;
      idle_since: string | null;
      last_active_at: string | null;
      screenname: string;
    }) => {
      const resolvedStatus = resolveStatusFields({
        status: buddy.status,
        awayMessage: buddy.away_message,
        statusMessage: buddy.status_msg,
      });
      const awayLine = resolvedStatus.awayMessage
        ? resolveAwayTemplate(resolvedStatus.awayMessage, buddy.screenname, screenname)
        : '';
      const presenceState = resolvePresenceState({
        isOnline: buddy.isOnline,
        status: resolvedStatus.status,
        idleSince: buddy.idle_since,
      });

      return {
        resolvedStatus,
        awayLine,
        presenceState,
        presenceLabel: getPresenceLabel(presenceState),
        presenceDetail: getPresenceDetail({
          state: presenceState,
          awayMessage: awayLine,
          statusMessage: resolvedStatus.statusMessage,
          idleSince: buddy.idle_since,
          lastActiveAt: buddy.last_active_at,
        }),
      };
    },
    [screenname],
  );

  const currentUserPresenceState = useMemo(
    () =>
      resolvePresenceState({
        isOnline: true,
        status: userStatus,
        idleSince: idleSinceAt,
      }),
    [idleSinceAt, userStatus],
  );

  const currentUserPresenceDetail = useMemo(
    () =>
      getPresenceDetail({
        state: currentUserPresenceState,
        awayMessage: awayMessage
          ? resolveAwayTemplate(awayMessage, screenname, screenname)
          : null,
        statusMessage: statusMsg,
        idleSince: idleSinceAt,
        lastActiveAt,
      }),
    [awayMessage, currentUserPresenceState, idleSinceAt, lastActiveAt, screenname, statusMsg],
  );

  const selectedProfileBuddy = useMemo(() => {
    if (!profileSheetBuddyId) {
      return null;
    }

    return (
      buddies.find((buddy) => buddy.id === profileSheetBuddyId) ??
      (activeChatBuddy?.id === profileSheetBuddyId ? activeChatBuddy : null)
    );
  }, [activeChatBuddy, buddies, profileSheetBuddyId]);

  const selectedProfileSummary = useMemo(() => {
    if (!selectedProfileBuddy) {
      return null;
    }

    const summary = getBuddyPresenceSummary(selectedProfileBuddy);
    return {
      id: selectedProfileBuddy.id,
      screenname: selectedProfileBuddy.screenname,
      relationshipStatus: selectedProfileBuddy.relationshipStatus,
      presenceState: summary.presenceState,
      presenceDetail: summary.presenceDetail,
      statusLine: summary.resolvedStatus.statusMessage,
      awayMessage: summary.presenceState === 'away' ? summary.awayLine : null,
      bio: selectedProfileBuddy.profile_bio,
      buddyIconPath: selectedProfileBuddy.buddy_icon_path,
    };
  }, [getBuddyPresenceSummary, selectedProfileBuddy]);

  useEffect(() => {
    if (!activeChatBuddyId || !blockedUserIds.includes(activeChatBuddyId)) {
      return;
    }

    setActiveChatBuddyId(null);
    activeChatBuddyIdRef.current = null;
    setInitialUnreadForActiveChat(0);
    setActiveDmTypingText(null);
    setChatMessages([]);
    setChatError(null);
    replaceAppPathInPlace(HI_ITS_ME_PATH);
  }, [activeChatBuddyId, blockedUserIds]);

  useEffect(() => {
    acceptedBuddyIdsRef.current = new Set(acceptedBuddies.map((buddy) => buddy.id));
  }, [acceptedBuddies]);

  const loadConversation = useCallback(
    async (buddyId: string) => {
      if (!userId) {
        return;
      }

      setIsChatLoading(true);
      setChatError(null);

      const chatFilter = `and(sender_id.eq.${userId},receiver_id.eq.${buddyId}),and(sender_id.eq.${buddyId},receiver_id.eq.${userId})`;
      let data: unknown = null;
      let error: { message: string } | null = null;

      {
        const response = await supabase
          .from('messages')
          .select(DIRECT_MESSAGE_SELECT_FIELDS)
          .or(chatFilter)
          .order('created_at', { ascending: true })
          .limit(200);
        data = response.data;
        error = response.error;
      }

      if (isDirectMessageMetadataSchemaMissingError(error)) {
        const legacyResponse = await supabase
          .from('messages')
          .select(LEGACY_DIRECT_MESSAGE_SELECT_FIELDS)
          .or(chatFilter)
          .order('created_at', { ascending: true })
          .limit(200);
        data = legacyResponse.data;
        error = legacyResponse.error;
      }

      if (activeChatBuddyIdRef.current !== buddyId) {
        return;
      }

      if (error) {
        setChatMessages([]);
        setChatError(error.message);
        setIsChatLoading(false);
        return;
      }

      const loadedMessages = (data ?? []) as ChatMessage[];
      setChatMessages(loadedMessages);
      const latestMessage = loadedMessages[loadedMessages.length - 1];
      if (latestMessage?.created_at) {
        setBuddyLastMessageAt((previous) => ({
          ...previous,
          [buddyId]: latestMessage.created_at,
        }));
        const previewText =
          latestMessage.preview_type === 'attachment' ? '📎 Attachment'
            : latestMessage.preview_type === 'voice_note' ? '🎤 Voice note'
            : latestMessage.preview_type === 'buzz' ? '⚡ Buzz!'
            : htmlToPlainText(latestMessage.content).trim().slice(0, 80) || '';
        if (previewText) {
          setBuddyLastMessagePreview((previous) => ({
            ...previous,
            [buddyId]: previewText,
          }));
        }
      }
      setIsChatLoading(false);
    },
    [userId],
  );

  const clearUnreadDirectMessages = useCallback((buddyId: string) => {
    if (!buddyId) {
      return;
    }

    setUnreadDirectMessages((previous) => {
      if (!(buddyId in previous)) {
        return previous;
      }

      const next = { ...previous };
      delete next[buddyId];
      return next;
    });

    if (!userId) {
      return;
    }

    void supabase
      .rpc('clear_dm_unread', { p_buddy_id: buddyId })
      .then(({ error }) => {
        if (error) {
          console.error('Failed to clear DM unread state:', error.message);
          void syncUnreadDirectFromServer(userId);
        }
      });
  }, [syncUnreadDirectFromServer, userId]);

  const openChatWindowForId = useCallback(
    (buddyId: string) => {
      const hadUnread = (unreadDirectMessages[buddyId] ?? 0) > 0;
      setInitialUnreadForActiveChat(unreadDirectMessages[buddyId] ?? 0);
      setActiveDmTypingText(null);
      setBodyShellSection('im');
      setSelectedBuddyId(buddyId);
      setActiveChatBuddyId(buddyId);
      activeChatBuddyIdRef.current = buddyId;
      clearUnreadDirectMessages(buddyId);
      if (hadUnread) void hapticLight();
      replaceAppPathInPlace(buildHiItsMePath({ section: 'im', dmBuddyId: buddyId }));
      void loadConversation(buddyId);
    },
    [clearUnreadDirectMessages, loadConversation, unreadDirectMessages],
  );

  useEffect(() => {
    lastDmTypingSentAtRef.current = 0;
  }, [activeChatBuddyId]);

  useEffect(() => {
    if (!userId || !activeChatBuddyId) {
      setActiveDmTypingText(null);
      return;
    }

    const channelKey = getDmTypingChannelKey(userId, activeChatBuddyId);
    const typingChannel = supabase.channel(`dm_typing:${channelKey}`);
    activeDmTypingChannelRef.current = typingChannel;

    typingChannel.on('broadcast', { event: 'typing' }, (event) => {
      const payload = event.payload as { senderId?: string; screenname?: string };
      const senderId = typeof payload.senderId === 'string' ? payload.senderId : '';
      if (!senderId || senderId === userId || senderId !== activeChatBuddyIdRef.current) {
        return;
      }

      const senderName =
        (typeof payload.screenname === 'string' && payload.screenname.trim()) ||
        buddyRows.find((buddy) => buddy.id === senderId)?.screenname ||
        temporaryChatProfiles[senderId]?.screenname ||
        'Buddy';
      setActiveDmTypingText(`${senderName} is typing...`);

      if (dmTypingTimeoutRef.current) {
        clearTimeout(dmTypingTimeoutRef.current);
      }
      dmTypingTimeoutRef.current = setTimeout(() => {
        setActiveDmTypingText(null);
      }, TYPING_TTL_MS);
    });

    typingChannel.subscribe();

    return () => {
      activeDmTypingChannelRef.current = null;
      setActiveDmTypingText(null);
      if (dmTypingTimeoutRef.current) {
        clearTimeout(dmTypingTimeoutRef.current);
        dmTypingTimeoutRef.current = null;
      }
      void supabase.removeChannel(typingChannel);
    };
  }, [activeChatBuddyId, buddyRows, temporaryChatProfiles, userId]);

  const sendDmTypingPulse = useCallback(() => {
    if (!userId || !activeChatBuddyId) {
      return;
    }

    const now = Date.now();
    if (now - lastDmTypingSentAtRef.current < TYPING_THROTTLE_MS) {
      return;
    }
    lastDmTypingSentAtRef.current = now;

    const typingChannel = activeDmTypingChannelRef.current;
    if (!typingChannel) {
      return;
    }

    void typingChannel.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        senderId: userId,
        screenname: screennameRef.current,
      },
    });
  }, [activeChatBuddyId, userId]);

  const sendAutoAwayReply = useCallback(
    async (senderId: string, incomingContent: string) => {
      if (!userId) {
        return;
      }

      if (userStatusRef.current !== AWAY_STATUS) {
        return;
      }

      if (incomingContent.trim().toLowerCase().startsWith(AWAY_AUTO_REPLY_PREFIX.toLowerCase())) {
        return;
      }

      const now = Date.now();
      const lastReplyAt = awayReplyCooldownRef.current[senderId] ?? 0;
      if (now - lastReplyAt < AWAY_AUTO_REPLY_COOLDOWN_MS) {
        return;
      }

      const senderNameFromBuddy =
        buddyRows.find((buddy) => buddy.id === senderId)?.screenname ||
        temporaryChatProfiles[senderId]?.screenname ||
        pendingRequestsRef.current.find((request) => request.senderId === senderId)?.screenname ||
        'Buddy';
      const template = awayMessageRef.current.trim() || "I'm away right now. Leave me a message.";
      const resolvedTemplate = resolveAwayTemplate(template, screennameRef.current, senderNameFromBuddy);
      const autoReplyText = `${AWAY_AUTO_REPLY_PREFIX} ${resolvedTemplate}`;

      const { error } = await supabase.from('messages').insert({
        sender_id: userId,
        receiver_id: senderId,
        content: autoReplyText,
      });

      if (error) {
        return;
      }

      awayReplyCooldownRef.current = {
        ...awayReplyCooldownRef.current,
        [senderId]: now,
      };
      setAwayReplyCooldowns(awayReplyCooldownRef.current);
    },
    [buddyRows, temporaryChatProfiles, userId],
  );

  useEffect(() => {
    if (!userId) {
      return;
    }

    const globalMessagesChannel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
        const incomingMessage = payload.new as ChatMessage;
        if (!incomingMessage?.id || incomingMessage.receiver_id !== userId) {
          return;
        }

        const senderId = incomingMessage.sender_id;
        const incomingContent = typeof incomingMessage.content === 'string' ? incomingMessage.content : '';
        if (blockedUserIdsRef.current.has(senderId)) {
          return;
        }
        setBuddyLastMessageAt((previous) => {
          const current = normalizeTimestampMs(previous[senderId]);
          const incoming = normalizeTimestampMs(incomingMessage.created_at);
          if (incoming <= current) {
            return previous;
          }
          return {
            ...previous,
            [senderId]: incomingMessage.created_at,
          };
        });
        void sendAutoAwayReply(senderId, incomingContent);
        const isBuddy = acceptedBuddyIdsRef.current.has(senderId);
        const isTemporarilyAllowed = temporaryChatAllowedIdsRef.current.has(senderId);

        if (!isBuddy && !isTemporarilyAllowed) {
          const alreadyPending = pendingRequestsRef.current.some((request) => request.senderId === senderId);
          if (alreadyPending) {
            playIncomingAlert();
            return;
          }

          void (async () => {
            const { data: senderProfile } = await loadSingleUserProfile({
              applyFilters: (query) => query.eq('id', senderId),
            });

            const profile = senderProfile;
            const senderScreenname =
              profile?.screenname?.trim() || profile?.email?.split('@')[0] || 'Unknown User';
            const resolvedSenderStatus = resolveStatusFields({
              status: profile?.status,
              awayMessage: profile?.away_message,
              statusMessage: profile?.status_msg,
            });

            setTemporaryChatProfiles((previous) => ({
              ...previous,
              [senderId]: {
                screenname: senderScreenname,
                status: resolvedSenderStatus.status,
                away_message: resolvedSenderStatus.awayMessage || null,
                status_msg: resolvedSenderStatus.statusMessage,
                profile_bio: profile?.profile_bio ?? null,
                buddy_icon_path: profile?.buddy_icon_path ?? null,
                idle_since: profile?.idle_since ?? null,
                last_active_at: profile?.last_active_at ?? null,
              },
            }));
            setPendingRequestError(null);
            setPendingRequests((previous) =>
              previous.some((request) => request.senderId === senderId)
                ? previous
                : [...previous, { senderId, screenname: senderScreenname }],
            );
            playIncomingAlert();
          })();
          return;
        }

        if (activeChatBuddyIdRef.current === senderId) {
          clearUnreadDirectMessages(senderId);
          setInitialUnreadForActiveChat(0);
          setChatMessages((previous) =>
            previous.some((message) => message.id === incomingMessage.id)
              ? previous
              : [...previous, incomingMessage],
          );

          if (incomingMessage.preview_type === 'buzz') {
            document.body.classList.add('buzz-flash');
            setTimeout(() => document.body.classList.remove('buzz-flash'), 600);
            void hapticWarning();
            void playUiSound('/sounds/aim.mp3', { volume: 0.6 });
          } else {
            void hapticLight();
            playFallbackTone();
          }
          return;
        }

        // `user_dm_state` is the source of truth for unread DM counts.
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
        const updatedMessage = payload.new as ChatMessage;
        if (!updatedMessage?.id || !userId) {
          return;
        }

        const isRelevantToUser =
          updatedMessage.sender_id === userId || updatedMessage.receiver_id === userId;
        if (!isRelevantToUser) {
          return;
        }

        const isRelevantToActiveChat =
          (updatedMessage.sender_id === userId && updatedMessage.receiver_id === activeChatBuddyIdRef.current) ||
          (updatedMessage.receiver_id === userId && updatedMessage.sender_id === activeChatBuddyIdRef.current);
        if (!isRelevantToActiveChat) {
          return;
        }

        setChatMessages((previous) =>
          previous.map((message) => (message.id === updatedMessage.id ? { ...message, ...updatedMessage } : message)),
        );
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(globalMessagesChannel);
    };
  }, [clearUnreadDirectMessages, loadSingleUserProfile, playIncomingAlert, sendAutoAwayReply, userId]);

  const handleSignOff = async () => {
    isSigningOffRef.current = true;
    playSound(SELF_SIGN_OFF_SOUND);
    setIsHeaderMenuOpen(false);
    setUnreadDirectMessages({});
    setInitialUnreadForActiveChat(0);
    setInitialUnreadForActiveRoom(0);
    setActiveDmTypingText(null);
    setIsUiCacheHydrated(false);
    setDraftCache({ dm: {}, rooms: {} });
    setAwayReplyCooldowns({});
    setAwaySinceAt(null);
    setIdleSinceAt(null);
    setLastActiveAt(null);
    setShowAwayModal(false);
    setShowSystemStatusSheet(false);
    setShowAppLockSheet(false);
    setIsAppLocked(false);
    setAppLockPinDraft('');
    setAppLockConfirmDraft('');
    setAppLockError(null);
    setBiometricAvailability(DEFAULT_BIOMETRIC_AVAILABILITY);
    setIsBiometricAuthenticating(false);
    attemptedBiometricUnlockRef.current = false;
    setProfileSheetBuddyId(null);
    setProfileSheetError(null);
    setProfileSheetFeedback(null);
    setBuddyActivityToasts([]);
    setBlockedUserIds([]);
    setBlockedProfiles([]);
    autoAwayTriggeredRef.current = false;
    let didCompleteSignOut = false;
    try {
      const activePresenceChannel = presenceChannelRef.current;
      if (activePresenceChannel) {
        await activePresenceChannel.untrack();
        await supabase.removeChannel(activePresenceChannel);
        presenceChannelRef.current = null;
      }
      await resetChatState();
      await supabase.auth.signOut();
      didCompleteSignOut = true;
      navigateAppPath(router, '/', { replace: true });
    } finally {
      if (!didCompleteSignOut) {
        isSigningOffRef.current = false;
      }
    }
  };

  const updateStatus = useCallback(
    async (
      newStatus: string,
      message: string | null,
      options?: {
        statusLine?: string | null;
        bio?: string | null;
        buddyIconPath?: string | null;
      },
    ) => {
      if (!userId) {
        return false;
      }

      const normalizedStatus = normalizeStatusLabel(newStatus);
      const wasAway = normalizeStatusLabel(userStatusRef.current) === AWAY_STATUS;
      const normalizedAwayMessage = (message ?? '').trim();
      const nextAwayMessage = normalizedStatus === AWAY_STATUS ? normalizedAwayMessage : '';
      const trimmedStatusLine = (options?.statusLine ?? statusMsgRef.current).trim();
      const nextStatusMessage = trimmedStatusLine || composeStatusMessage(normalizedStatus);
      const nextBio = (options?.bio ?? profileBioRef.current).trim();
      const nextBuddyIconPath = options?.buddyIconPath ?? buddyIconPathRef.current;
      const nowIso = new Date().toISOString();
      const hasProfileFieldChanges =
        nextBio !== profileBioRef.current.trim() ||
        (nextBuddyIconPath ?? null) !== (buddyIconPathRef.current ?? null);

      let { error } = await supabase
        .from('users')
        .update({
          status: normalizedStatus,
          away_message: nextAwayMessage || null,
          status_msg: nextStatusMessage,
          profile_bio: nextBio || null,
          buddy_icon_path: nextBuddyIconPath,
          idle_since: null,
          last_active_at: nowIso,
        })
        .eq('id', userId);

      if (isProfileSchemaMissingError(error)) {
        markProfileSchemaUnavailable(error);
        ({ error } = await supabase
          .from('users')
          .update({
            status: normalizedStatus,
            away_message: nextAwayMessage || null,
            status_msg: nextStatusMessage,
          })
          .eq('id', userId));

        if (error) {
          console.error('Failed to update status:', error.message);
          setAwayModalError(error.message);
          return false;
        }

        setUserStatus(normalizedStatus);
        setAwayMessage(nextAwayMessage);
        setStatusMsg(nextStatusMessage);
        setIdleSinceAt(null);
        setLastActiveAt(nowIso);
        lastPresenceWriteAtRef.current = Date.now();
        setAwaySinceAt((previous) =>
          normalizedStatus === AWAY_STATUS ? previous ?? new Date().toISOString() : null,
        );
        if (!wasAway && normalizedStatus === AWAY_STATUS) {
          playSound(BUDDY_GOING_AWAY_SOUND);
        } else if (wasAway && normalizedStatus !== AWAY_STATUS) {
          playSound(BUDDY_SIGN_ON_SOUND);
        }

        if (hasProfileFieldChanges) {
          setAwayModalError(`Status updated. ${PROFILE_SCHEMA_NOTICE}`);
          return false;
        }

        return true;
      }

      if (error) {
        console.error('Failed to update status:', error.message);
        setAwayModalError(error.message);
        return false;
      }

      setUserStatus(normalizedStatus);
      setAwayMessage(nextAwayMessage);
      setStatusMsg(nextStatusMessage);
      setProfileBio(nextBio);
      setBuddyIconPath(nextBuddyIconPath ?? null);
      setIdleSinceAt(null);
      setLastActiveAt(nowIso);
      lastPresenceWriteAtRef.current = Date.now();
      setAwaySinceAt((previous) =>
        normalizedStatus === AWAY_STATUS ? previous ?? new Date().toISOString() : null,
      );
      if (!wasAway && normalizedStatus === AWAY_STATUS) {
        playSound(BUDDY_GOING_AWAY_SOUND);
      } else if (wasAway && normalizedStatus !== AWAY_STATUS) {
        playSound(BUDDY_SIGN_ON_SOUND);
      }
      return true;
    },
    [markProfileSchemaUnavailable, playSound, userId],
  );

  const persistIdleState = useCallback(
    async ({
      nextIdleSince,
      nextLastActiveAt,
    }: {
      nextIdleSince: string | null;
      nextLastActiveAt: string | null;
    }) => {
      if (!userId) {
        return;
      }

      const { error } = await supabase
        .from('users')
        .update({
          idle_since: nextIdleSince,
          last_active_at: nextLastActiveAt,
        })
        .eq('id', userId);

      if (isProfileSchemaMissingError(error)) {
        markProfileSchemaUnavailable(error);
        return;
      }

      if (error) {
        console.error('Failed to update idle state:', error.message);
        return;
      }

      setIdleSinceAt(nextIdleSince);
      setLastActiveAt(nextLastActiveAt);
      lastPresenceWriteAtRef.current = Date.now();
    },
    [markProfileSchemaUnavailable, userId],
  );

  const openAwayModal = useCallback((
    mode: 'profile' | 'away' = 'profile',
    options?: { preservePhotoDraft?: boolean },
  ) => {
    setIsHeaderMenuOpen(false);
    setAwayModalMode(mode);
    const matchingPreset = awayPresets.find((preset) => preset.message === awayMessage);
    if (matchingPreset) {
      setSelectedAwayPresetId(matchingPreset.id);
      setAwayLabelDraft(matchingPreset.label);
      setAwayText(matchingPreset.message);
    } else {
      setSelectedAwayPresetId('__custom__');
      setAwayLabelDraft('');
      setAwayText(awayMessage || DEFAULT_AWAY_PRESETS[0].message);
    }
    setSaveAwayPreset(false);
    setProfileStatusDraft(statusMsg);
    setProfileBioDraft(profileBio);

    if (!options?.preservePhotoDraft) {
      if (buddyIconPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(buddyIconPreviewUrl);
      }
      setPendingBuddyIconFile(null);
      setRemoveBuddyIconOnSave(false);
      setBuddyIconPreviewUrl(null);
    }

    setAwayModalError(null);
    setShowAwayModal(true);
  }, [awayMessage, awayPresets, buddyIconPreviewUrl, profileBio, statusMsg]);

  const handleSelectBuddyIcon = useCallback((fileList: FileList | null) => {
    const nextFile = fileList?.[0] ?? null;
    if (!nextFile) {
      return false;
    }

    if (isProfileSchemaUnavailable) {
      setAwayModalError(PROFILE_SCHEMA_NOTICE);
      return false;
    }

    const validationError = validateBuddyIconFile(nextFile);
    if (validationError) {
      setAwayModalError(validationError);
      return false;
    }

    if (buddyIconPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(buddyIconPreviewUrl);
    }

    setAwayModalError(null);
    setPendingBuddyIconFile(nextFile);
    setRemoveBuddyIconOnSave(false);
    setBuddyIconPreviewUrl(URL.createObjectURL(nextFile));
    return true;
  }, [buddyIconPreviewUrl, isProfileSchemaUnavailable]);

  const handleQuickPhotoPickerOpen = useCallback(() => {
    setIsHeaderMenuOpen(false);

    if (isProfileSchemaUnavailable) {
      openAwayModal('profile');
      setAwayModalError(PROFILE_SCHEMA_NOTICE);
      return;
    }

    quickPhotoInputRef.current?.click();
  }, [isProfileSchemaUnavailable, openAwayModal]);

  const handleQuickPhotoSelection = useCallback((fileList: FileList | null) => {
    const didQueuePhoto = handleSelectBuddyIcon(fileList);
    if (!didQueuePhoto) {
      return;
    }

    openAwayModal('profile', { preservePhotoDraft: true });
  }, [handleSelectBuddyIcon, openAwayModal]);

  const saveProfileSettings = useCallback(
    async ({ goAway }: { goAway: boolean }) => {
      if (!userId) {
        return;
      }

      setAwayModalError(null);
      setIsSavingAwayMessage(true);

      const trimmedMessage = awayText.trim();
      const trimmedLabel = awayLabelDraft.trim();
      const trimmedStatusLine = profileStatusDraft.trim().slice(0, PROFILE_STATUS_MAX_LENGTH);
      const trimmedBio = profileBioDraft.trim().slice(0, PROFILE_BIO_MAX_LENGTH);

      if (!trimmedStatusLine) {
        setAwayModalError('Enter a status line before saving.');
        setIsSavingAwayMessage(false);
        return;
      }

      if (goAway && !trimmedMessage) {
        setAwayModalError('Enter an away message before saving.');
        setIsSavingAwayMessage(false);
        return;
      }

      if (goAway && saveAwayPreset && !trimmedLabel) {
        setAwayModalError('Enter a label to save this away message.');
        setIsSavingAwayMessage(false);
        return;
      }

      if (goAway && saveAwayPreset && trimmedLabel) {
        const presetId = `custom-${trimmedLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'away'}`;
        setAwayPresets((previous) => {
          const withoutExistingLabel = previous.filter(
            (preset) => !(preset.label.toLowerCase() === trimmedLabel.toLowerCase() && !preset.builtIn),
          );
          return [
            ...withoutExistingLabel,
            {
              id: presetId,
              label: trimmedLabel,
              message: trimmedMessage,
              builtIn: false,
            },
          ];
        });
        setSelectedAwayPresetId(presetId);
      }

      const previousBuddyIconPath = buddyIconPathRef.current;
      let nextBuddyIconPath = removeBuddyIconOnSave ? null : previousBuddyIconPath;
      let uploadedBuddyIconPath: string | null = null;

      if (pendingBuddyIconFile) {
        try {
          const uploaded = await uploadBuddyIconFile({
            userId,
            file: pendingBuddyIconFile,
          });
          uploadedBuddyIconPath = uploaded.storagePath;
          nextBuddyIconPath = uploaded.storagePath;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Buddy icon upload failed.';
          setAwayModalError(message);
          setIsSavingAwayMessage(false);
          return;
        }
      }

      const statusToPersist = goAway ? AWAY_STATUS : userStatusRef.current;
      const messageToPersist =
        statusToPersist === AWAY_STATUS
          ? goAway
            ? trimmedMessage
            : awayMessageRef.current
          : null;

      const success = await updateStatus(statusToPersist, messageToPersist, {
        statusLine: trimmedStatusLine,
        bio: trimmedBio,
        buddyIconPath: nextBuddyIconPath,
      });
      setIsSavingAwayMessage(false);

      if (!success) {
        if (uploadedBuddyIconPath) {
          try {
            await deleteBuddyIconFile(uploadedBuddyIconPath);
          } catch {
            // Best-effort cleanup.
          }
        }
        return;
      }

      if (previousBuddyIconPath && previousBuddyIconPath !== nextBuddyIconPath) {
        try {
          await deleteBuddyIconFile(previousBuddyIconPath);
        } catch (error) {
          console.error('Failed removing previous buddy icon:', error);
        }
      }

      autoAwayTriggeredRef.current = false;
      setPendingBuddyIconFile(null);
      setRemoveBuddyIconOnSave(false);
      if (buddyIconPreviewUrl?.startsWith('blob:')) {
        URL.revokeObjectURL(buddyIconPreviewUrl);
      }
      setBuddyIconPreviewUrl(null);
      setShowAwayModal(false);
    },
    [
      awayLabelDraft,
      awayText,
      buddyIconPreviewUrl,
      pendingBuddyIconFile,
      profileBioDraft,
      profileStatusDraft,
      removeBuddyIconOnSave,
      saveAwayPreset,
      updateStatus,
      userId,
    ],
  );

  const handleImBack = useCallback(() => {
    autoAwayTriggeredRef.current = false;
    setAwaySinceAt(null);
    void updateStatus(AVAILABLE_STATUS, null);
  }, [updateStatus]);

  const handleClearIdle = useCallback(() => {
    autoAwayTriggeredRef.current = false;
    idleSinceRef.current = null;
    lastActivityAtRef.current = Date.now();
    void persistIdleState({
      nextIdleSince: null,
      nextLastActiveAt: new Date().toISOString(),
    });
  }, [persistIdleState]);

  useEffect(() => {
    if (!userId || typeof window === 'undefined') {
      return;
    }

    const markActivity = () => {
      lastActivityAtRef.current = Date.now();
      const nowIso = new Date().toISOString();

      if (autoReturnOnActivity && idleSinceRef.current && userStatusRef.current !== AWAY_STATUS) {
        autoAwayTriggeredRef.current = false;
        idleSinceRef.current = null;
        void persistIdleState({
          nextIdleSince: null,
          nextLastActiveAt: nowIso,
        });
        return;
      }

      if (Date.now() - lastPresenceWriteAtRef.current >= LAST_ACTIVE_WRITE_INTERVAL_MS) {
        void persistIdleState({
          nextIdleSince: idleSinceRef.current,
          nextLastActiveAt: nowIso,
        });
      }
    };

    const activityEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart', 'mousemove'];
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, markActivity, { passive: true });
    });

    const intervalId = window.setInterval(() => {
      if (!isAutoAwayEnabled || userStatusRef.current === AWAY_STATUS || idleSinceRef.current) {
        return;
      }

      const elapsed = Date.now() - lastActivityAtRef.current;
      if (elapsed < autoAwayMinutes * 60 * 1000) {
        return;
      }

      autoAwayTriggeredRef.current = true;
      const nowIso = new Date().toISOString();
      idleSinceRef.current = nowIso;
      void persistIdleState({
        nextIdleSince: nowIso,
        nextLastActiveAt: nowIso,
      });
    }, 15000);

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, markActivity);
      });
      window.clearInterval(intervalId);
    };
  }, [autoAwayMinutes, autoReturnOnActivity, isAutoAwayEnabled, persistIdleState, userId]);

  const handleSaveRecoveryCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = recoveryCodeDraft.trim();
    const confirm = recoveryCodeConfirmDraft.trim();

    if (!trimmed || !confirm) {
      setRecoverySetupError('Enter and confirm your recovery code.');
      setRecoverySetupFeedback(null);
      return;
    }

    if (trimmed !== confirm) {
      setRecoverySetupError('Recovery code entries do not match.');
      setRecoverySetupFeedback(null);
      return;
    }

    if (trimmed.length < RECOVERY_CODE_MIN_LENGTH) {
      setRecoverySetupError(`Recovery code must be at least ${RECOVERY_CODE_MIN_LENGTH} characters.`);
      setRecoverySetupFeedback(null);
      return;
    }

    setIsSavingRecoveryCode(true);
    setRecoverySetupError(null);
    setRecoverySetupFeedback(null);

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setRecoverySetupError('Session expired. Please sign on again.');
      setIsSavingRecoveryCode(false);
      return;
    }

    let response: Response;
    try {
      response = await fetch(getAppApiUrl('/api/auth/recovery/setup'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ recoveryCode: trimmed }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Load failed';
      setRecoverySetupError(message);
      setIsSavingRecoveryCode(false);
      return;
    }

    if (!response.ok) {
      const errorMessage = await readApiError(response);
      setRecoverySetupError(errorMessage);
      setIsSavingRecoveryCode(false);
      return;
    }

    setRecoveryCodeDraft('');
    setRecoveryCodeConfirmDraft('');
    setIsRecoverySetupOpen(false);
    setIsSavingRecoveryCode(false);
    clearPendingSignupRecoveryDraft(screennameRef.current);
  };

  const handleGenerateRecoveryCodeDraft = async () => {
    const generated = generateClientRecoveryCode();
    setRecoveryCodeDraft(generated);
    setRecoveryCodeConfirmDraft(generated);
    setRecoverySetupError(null);

    try {
      await navigator.clipboard.writeText(generated);
      setRecoverySetupFeedback('Generated a secure recovery code and copied it to your clipboard.');
    } catch {
      setRecoverySetupFeedback('Generated a secure recovery code. Save it somewhere safe before you continue.');
    }
  };

  const loadAdminResetAuditData = useCallback(async (limit = 12) => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return {
        ok: false as const,
        error: 'Session expired. Please sign on again.',
      };
    }

    let response: Response;
    try {
      response = await fetch(getAppApiUrl(`/api/admin/password-reset-audit?limit=${limit}`), {
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Load failed';
      return {
        ok: false as const,
        error: message,
      };
    }

    if (!response.ok) {
      const errorMessage = await readApiError(response);
      return {
        ok: false as const,
        error: errorMessage,
      };
    }

    const payload = (await response.json()) as AdminAuditResponse;
    return {
      ok: true as const,
      entries: Array.isArray(payload.entries) ? payload.entries : [],
    };
  }, [getAccessToken, readApiError]);

  const fetchAdminAuditEntries = useCallback(async () => {
    setIsLoadingAdminAudit(true);
    setAdminAuditError(null);

    const result = await loadAdminResetAuditData(12);
    if (!result.ok) {
      setAdminAuditError(result.error);
      setIsLoadingAdminAudit(false);
      return;
    }

    setAdminAuditEntries(result.entries);
    setIsLoadingAdminAudit(false);
  }, [loadAdminResetAuditData]);

  const openAdminResetWindow = () => {
    setAdminResetScreenname('');
    setAdminResetError(null);
    setAdminResetFeedback(null);
    setIssuedAdminTicket(null);
    setConfirmAdminResetAction(false);
    setAdminAuditEntries([]);
    setAdminAuditError(null);
    setIsAdminResetOpen(true);
    void fetchAdminAuditEntries();
  };

  const openPrivacyControls = useCallback(() => {
    setIsHeaderMenuOpen(false);
    setShowPrivacySheet(true);
  }, []);

  const buildNativePrivacyState = useCallback(
    (settings: UserPrivacySettings = privacySettings): NativeShellPrivacyState => ({
      settings: {
        shareReadReceipts: settings.shareReadReceipts,
        notificationPreviewMode: settings.notificationPreviewMode,
        screenShieldEnabled: settings.screenShieldEnabled,
      },
      appLockEnabled: appLockSettings.enabled,
      appLockTimeoutLabel: formatAppLockTimeoutLabel(appLockSettings.autoLockSeconds),
      biometricsEnabled:
        appLockSettings.enabled && appLockSettings.biometricsEnabled && biometricAvailability.isAvailable,
      biometricLabel: biometricAvailability.isAvailable ? biometricAvailability.label : null,
      blockedBuddyCount: blockedUserIds.length,
    }),
    [
      appLockSettings.autoLockSeconds,
      appLockSettings.biometricsEnabled,
      appLockSettings.enabled,
      biometricAvailability.isAvailable,
      biometricAvailability.label,
      blockedUserIds.length,
      privacySettings,
    ],
  );

  const loadNativePrivacyState = useCallback(async (): Promise<NativeShellPrivacyResult> => {
    return {
      ok: true,
      state: buildNativePrivacyState(),
    };
  }, [buildNativePrivacyState]);

  const updateNativePrivacySettings = useCallback(
    async (patch: Partial<NativeShellPrivacySettings>): Promise<NativeShellPrivacyResult> => {
      const nextPatch: Partial<UserPrivacySettings> = {};

      if (typeof patch.shareReadReceipts === 'boolean') {
        nextPatch.shareReadReceipts = patch.shareReadReceipts;
      }

      if (
        patch.notificationPreviewMode === 'full' ||
        patch.notificationPreviewMode === 'name_only' ||
        patch.notificationPreviewMode === 'hidden'
      ) {
        nextPatch.notificationPreviewMode = patch.notificationPreviewMode;
      }

      if (typeof patch.screenShieldEnabled === 'boolean') {
        nextPatch.screenShieldEnabled = patch.screenShieldEnabled;
      }

      if (Object.keys(nextPatch).length === 0) {
        return {
          ok: false,
          error: 'No privacy changes were provided.',
        };
      }

      const result = await updatePrivacyPreferences(nextPatch);
      return {
        ok: true,
        state: buildNativePrivacyState(result.settings),
        warning: result.ok ? null : result.error,
      };
    },
    [buildNativePrivacyState, updatePrivacyPreferences],
  );

  const issueAdminResetTicketData = useCallback(async (target: string) => {
    const accessToken = await getAccessToken();
    if (!accessToken) {
      return {
        ok: false as const,
        error: 'Session expired. Please sign on again.',
      };
    }

    let response: Response;
    try {
      response = await fetch(getAppApiUrl('/api/admin/password-reset-ticket'), {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ screenname: target }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Load failed';
      return {
        ok: false as const,
        error: message,
      };
    }

    if (!response.ok) {
      const errorMessage = await readApiError(response);
      return {
        ok: false as const,
        error: errorMessage,
      };
    }

    const payload = (await response.json()) as AdminTicketResponse;
    return {
      ok: true as const,
      ticket: payload.ticket,
      expiresAt: payload.expiresAt,
    };
  }, [getAccessToken, readApiError]);

  const handleIssueAdminResetTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!confirmAdminResetAction) {
      setAdminResetError('Confirm this admin action before issuing a reset ticket.');
      setAdminResetFeedback(null);
      return;
    }
    const target = adminResetScreenname.trim();
    if (!target) {
      setAdminResetError('Enter a screen name.');
      setAdminResetFeedback(null);
      return;
    }

    setIsIssuingAdminReset(true);
    setAdminResetError(null);
    setAdminResetFeedback(null);
    setIssuedAdminTicket(null);

    const result = await issueAdminResetTicketData(target);
    if (!result.ok) {
      setAdminResetError(result.error);
      setIsIssuingAdminReset(false);
      return;
    }

    setIssuedAdminTicket({
      ticket: result.ticket,
      expiresAt: result.expiresAt,
    });
    setAdminResetFeedback(`Secure handoff ready for ${target}.`);
    setIsIssuingAdminReset(false);
    void fetchAdminAuditEntries();
  };

  const loadNativeAdminResetAudit = useCallback(async (limit = 12): Promise<NativeShellAdminAuditResult> => {
    const result = await loadAdminResetAuditData(limit);
    if (!result.ok) {
      return result;
    }

    const entries: NativeShellAdminAuditItem[] = result.entries.map((entry) => {
      const actorLabel = formatAuditUserLabel(entry.actorScreenname, entry.actorUserId);
      const targetLabel = formatAuditUserLabel(entry.targetScreenname, entry.targetUserId);
      const reason =
        typeof entry.metadata.reason === 'string' && entry.metadata.reason.trim()
          ? entry.metadata.reason.trim()
          : null;

      return {
        id: entry.id,
        title: formatAdminAuditEvent(entry.eventType),
        timestamp: new Date(entry.createdAt).toLocaleString(),
        actorLabel,
        targetLabel,
        reason,
      };
    });

    return {
      ok: true,
      entries,
    };
  }, [loadAdminResetAuditData]);

  const issueNativeAdminResetTicket = useCallback(async (screennameToReset: string): Promise<NativeShellAdminIssueResult> => {
    const target = screennameToReset.trim();
    if (!target) {
      return {
        ok: false,
        error: 'Enter a screen name.',
      };
    }

    const result = await issueAdminResetTicketData(target);
    if (!result.ok) {
      return result;
    }

    return {
      ok: true,
      screenname: target,
      ticket: result.ticket,
      expiresAt: result.expiresAt,
      handoff: buildAdminResetHandoff(target, result.ticket, result.expiresAt),
      feedback: `Secure handoff ready for ${target}.`,
    };
  }, [issueAdminResetTicketData]);

  useEffect(() => {
    registerNativeShellBridge({
      loadPrivacyState: loadNativePrivacyState,
      updatePrivacySettings: updateNativePrivacySettings,
      loadAdminResetAudit: loadNativeAdminResetAudit,
      issueAdminResetTicket: issueNativeAdminResetTicket,
    });

    return () => {
      registerNativeShellBridge(null);
    };
  }, [issueNativeAdminResetTicket, loadAdminResetAuditData, loadNativeAdminResetAudit, loadNativePrivacyState, updateNativePrivacySettings]);

  const handleCopyAdminResetValue = async (mode: 'ticket' | 'handoff') => {
    if (!issuedAdminTicket) {
      return;
    }

    const target = adminResetScreenname.trim() || 'this member';
    const value =
      mode === 'ticket'
        ? issuedAdminTicket.ticket
        : buildAdminResetHandoff(target, issuedAdminTicket.ticket, issuedAdminTicket.expiresAt);

    try {
      await navigator.clipboard.writeText(value);
      setAdminResetError(null);
      setAdminResetFeedback(mode === 'ticket' ? 'Reset ticket copied.' : 'Secure handoff instructions copied.');
    } catch {
      setAdminResetFeedback(null);
      setAdminResetError('Could not copy automatically. Please copy it manually.');
    }
  };

  const handleSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) {
      return;
    }

    const query = searchTerm.trim();
    if (!query) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    const { data, error } = await loadManyUserProfiles({
      applyFilters: (queryBuilder) =>
        queryBuilder
          .ilike('screenname', `%${query}%`)
          .neq('id', userId)
          .order('screenname', { ascending: true })
          .limit(15),
    });

    setIsSearching(false);

    if (error) {
      setSearchError(error.message);
      return;
    }

    setSearchResults(data.filter((profile) => !blockedUserIdsRef.current.has(profile.id)));
  };

  const getBuddyRelationshipSnapshot = useCallback(
    async (buddyId: string) => {
      if (!userId) {
        return {
          outgoingStatus: null as Buddy['relationshipStatus'] | null,
          incomingStatus: null as Buddy['relationshipStatus'] | null,
        };
      }

      const { data, error } = await supabase
        .from('buddies')
        .select('user_id,buddy_id,status')
        .or(`and(user_id.eq.${userId},buddy_id.eq.${buddyId}),and(user_id.eq.${buddyId},buddy_id.eq.${userId})`)
        .in('status', ['accepted', 'pending']);

      if (error) {
        throw new Error(error.message);
      }

      let outgoingStatus: Buddy['relationshipStatus'] | null = null;
      let incomingStatus: Buddy['relationshipStatus'] | null = null;
      for (const row of (data ?? []) as BuddyRelationshipRecord[]) {
        if (row.user_id === userId && row.buddy_id === buddyId) {
          outgoingStatus = row.status;
        }
        if (row.user_id === buddyId && row.buddy_id === userId) {
          incomingStatus = row.status;
        }
      }

      return { outgoingStatus, incomingStatus };
    },
    [userId],
  );

  const acceptBuddyById = useCallback(
    async (buddyId: string, options?: { notifyBuddy?: boolean }) => {
      if (!userId) {
        return false;
      }

      const [outgoingResponse, incomingResponse] = await Promise.all([
        supabase.from('buddies').upsert(
          {
            user_id: userId,
            buddy_id: buddyId,
            status: 'accepted',
          },
          { onConflict: 'user_id,buddy_id' },
        ),
        supabase.from('buddies').upsert(
          {
            user_id: buddyId,
            buddy_id: userId,
            status: 'accepted',
          },
          { onConflict: 'user_id,buddy_id' },
        ),
      ]);

      const relationshipError = outgoingResponse.error ?? incomingResponse.error;
      if (relationshipError) {
        setSearchError(relationshipError.message);
        setProfileSheetError(relationshipError.message);
        setPendingRequestError(relationshipError.message);
        return false;
      }

      await loadBuddies(userId);
      if (options?.notifyBuddy) {
        dispatchBuddyAcceptedPush(buddyId);
      }
      setPendingRequestError(null);
      setProfileSheetError(null);
      return true;
    },
    [loadBuddies, userId],
  );

  const handleAddBuddyById = useCallback(async (buddyId: string) => {
    if (!userId) {
      return false;
    }

    setIsAddingBuddyId(buddyId);
    setSearchError(null);
    setProfileSheetError(null);

    try {
      const { outgoingStatus, incomingStatus } = await getBuddyRelationshipSnapshot(buddyId);

      if (outgoingStatus === 'accepted' || incomingStatus === 'accepted') {
        setProfileSheetFeedback('Already in your H.I.M. contacts.');
        setIsAddingBuddyId(null);
        return true;
      }

      if (incomingStatus === 'pending') {
        const accepted = await acceptBuddyById(buddyId, { notifyBuddy: true });
        setIsAddingBuddyId(null);
        return accepted;
      }

      if (outgoingStatus === 'pending') {
        setProfileSheetFeedback('Buddy request already sent.');
        setIsAddingBuddyId(null);
        return true;
      }

      const { error } = await supabase.from('buddies').upsert(
        {
          user_id: userId,
          buddy_id: buddyId,
          status: 'pending',
        },
        { onConflict: 'user_id,buddy_id' },
      );

      setIsAddingBuddyId(null);

      if (error) {
        setSearchError(error.message);
        setProfileSheetError(error.message);
        return false;
      }

      await loadBuddies(userId);
      dispatchBuddyRequestPush(buddyId);
      setProfileSheetFeedback('Buddy request sent.');
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not update buddy request.';
      setSearchError(message);
      setProfileSheetError(message);
      setIsAddingBuddyId(null);
      return false;
    }
  }, [acceptBuddyById, getBuddyRelationshipSnapshot, loadBuddies, userId]);

  const handleAddBuddy = async (profile: UserProfile) => {
    const added = await handleAddBuddyById(profile.id);
    if (!added) {
      return;
    }

    setShowAddWindow(false);
    setSearchTerm('');
    setSearchResults([]);
  };

  const handleAcceptPendingRequest = useCallback(
    async (senderId: string) => {
      if (!userId) {
        return;
      }

      setPendingRequestError(null);
      setIsProcessingRequestId(senderId);

      const accepted = await acceptBuddyById(senderId, { notifyBuddy: true });
      setIsProcessingRequestId(null);
      if (!accepted) {
        return;
      }

      setPendingRequests((previous) => previous.filter((request) => request.senderId !== senderId));
      setTemporaryChatAllowedIds((previous) =>
        previous.includes(senderId) ? previous : [...previous, senderId],
      );
      openChatWindowForId(senderId);
    },
    [acceptBuddyById, openChatWindowForId, userId],
  );

  const handleDeclinePendingRequest = useCallback(
    async (senderId: string) => {
      if (!userId) {
        return;
      }

      setPendingRequestError(null);
      setIsProcessingRequestId(senderId);

      const { error } = await supabase
        .from('buddies')
        .delete()
        .eq('user_id', senderId)
        .eq('buddy_id', userId)
        .eq('status', 'pending');

      setIsProcessingRequestId(null);

      if (error) {
        setPendingRequestError(error.message);
        return;
      }

      setPendingRequests((previous) => previous.filter((request) => request.senderId !== senderId));
      await loadBuddies(userId);
    },
    [loadBuddies, userId],
  );

  const handleRemoveBuddy = useCallback(async (buddyId: string) => {
    if (!userId) {
      return false;
    }

    setIsRemovingBuddyId(buddyId);
    setProfileSheetError(null);
    const { error } = await supabase
      .from('buddies')
      .delete()
      .or(
        `and(user_id.eq.${userId},buddy_id.eq.${buddyId}),` +
        `and(user_id.eq.${buddyId},buddy_id.eq.${userId})`
      );
    setIsRemovingBuddyId(null);

    if (error) {
      setSearchError(error.message);
      setProfileSheetError(error.message);
      return false;
    }

    if (activeChatBuddyIdRef.current === buddyId) {
      setActiveChatBuddyId(null);
      activeChatBuddyIdRef.current = null;
      setInitialUnreadForActiveChat(0);
      setActiveDmTypingText(null);
      setChatMessages([]);
      setChatError(null);
      setIsChatLoading(false);
      if (dmTypingTimeoutRef.current) {
        clearTimeout(dmTypingTimeoutRef.current);
        dmTypingTimeoutRef.current = null;
      }
      if (activeRoom) {
        replaceAppPathInPlace(`${HI_ITS_ME_PATH}?room=${encodeURIComponent(activeRoom.name)}`);
      } else {
        replaceAppPathInPlace(HI_ITS_ME_PATH);
      }
    }
    setProfileSheetBuddyId((previous) => (previous === buddyId ? null : previous));
    await loadBuddies(userId);
    return true;
  }, [activeRoom, loadBuddies, userId]);

  const handleAddBuddyFromPendingRequest = useCallback(
    async (senderId: string) => {
      if (!userId) {
        return;
      }

      setPendingRequestError(null);
      setIsProcessingRequestId(senderId);

      const added = await handleAddBuddyById(senderId);
      setIsProcessingRequestId(null);

      if (!added) {
        setPendingRequestError('Could not add that buddy right now.');
        return;
      }

      setPendingRequests((previous) => previous.filter((request) => request.senderId !== senderId));
      setTemporaryChatAllowedIds((previous) =>
        previous.includes(senderId) ? previous : [...previous, senderId],
      );
      openChatWindowForId(senderId);
    },
    [handleAddBuddyById, openChatWindowForId, userId],
  );

  const handleOpenChat = (buddyId: string) => {
    openChatWindowForId(buddyId);
  };

  const openBuddyProfile = useCallback((buddyId: string) => {
    setProfileSheetError(null);
    setProfileSheetFeedback(null);
    setProfileSheetBuddyId(buddyId);
  }, []);

  const closeBuddyProfile = useCallback(() => {
    setProfileSheetError(null);
    setProfileSheetFeedback(null);
    setProfileSheetBuddyId(null);
  }, []);

  const handleSendMessage = useCallback(
    async ({
      content,
      attachments = [],
      replyToMessageId = null,
      previewType = 'text',
    }: {
      content: string;
      attachments?: File[];
      replyToMessageId?: number | null;
      previewType?: 'text' | 'attachment' | 'forwarded' | 'voice_note' | 'buzz';
    }) => {
      if (!userId || !activeChatBuddyId) {
        return;
      }

      const isBuzz = previewType === 'buzz';
      const trimmedContent = content.trim();
      const normalizedAttachments = Array.isArray(attachments) ? attachments : [];
      if (!isBuzz && !trimmedContent && normalizedAttachments.length === 0) {
        return;
      }

      const messageContent = isBuzz
        ? '⚡ Buzz!'
        : trimmedContent
          ? content
          : normalizedAttachments.length === 1
            ? 'Sent an attachment.'
            : 'Sent attachments.';
      const clientMessageId = createClientMessageId();
      const expiresAt = getMessageExpiresAt(
        getDmPreference(dmPreferencesByBuddyId, activeChatBuddyId).disappearingTimerSeconds,
      );
      const trackedOutboxItem =
        normalizedAttachments.length === 0
          ? queueOutboxMessage({
              type: 'dm',
              targetId: activeChatBuddyId,
              content: messageContent,
              clientMessageId,
              status: 'sending',
              expiresAt,
              replyToMessageId,
              previewType,
            })
          : null;

      setIsSendingMessage(true);
      setChatError(null);

      const { data, error } = await sendDirectMessageWithClientMessageId({
        senderId: userId,
        receiverId: activeChatBuddyId,
        content: messageContent,
        clientMessageId,
        expiresAt,
        replyToMessageId,
        previewType,
      });

      setIsSendingMessage(false);

      if (error) {
        const isLikelyNetworkIssue =
          (typeof navigator !== 'undefined' && !navigator.onLine) ||
          /network|fetch|offline|timeout/i.test(error.message);
        if (trackedOutboxItem) {
          if (isLikelyNetworkIssue) {
            setOutboxItems((previous) =>
              normalizeOutboxItems(
                previous.map((item) =>
                  item.id === trackedOutboxItem.id ? markOutboxAttemptFailure(item, error.message) : item,
                ),
              ),
            );
            setChatError('Offline: message queued and will retry automatically.');
            return;
          }

          removeOutboxItem(trackedOutboxItem.id);
        }

        setChatError(error.message);
        throw error;
      }

      const insertedMessage = data as ChatMessage;
      setBuddyLastMessageAt((previous) => ({
        ...previous,
        [activeChatBuddyId]: insertedMessage.created_at,
      }));
      setInitialUnreadForActiveChat(0);
      setChatMessages((previous) =>
        previous.some((message) => message.id === insertedMessage.id)
          ? previous
          : [...previous, insertedMessage],
      );
      if (trackedOutboxItem) {
        removeOutboxItem(trackedOutboxItem.id);
      }

      if (normalizedAttachments.length > 0) {
        const attachmentRows: Array<{
          message_id: number;
          uploader_id: string;
          bucket: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
        }> = [];

        for (const file of normalizedAttachments) {
          try {
            const uploaded = await uploadChatMediaFile({ userId, file });
            attachmentRows.push({
              message_id: insertedMessage.id,
              uploader_id: userId,
              bucket: uploaded.bucket,
              storage_path: uploaded.storagePath,
              file_name: uploaded.fileName,
              mime_type: uploaded.mimeType,
              size_bytes: uploaded.sizeBytes,
            });
          } catch (uploadError) {
            const message =
              uploadError instanceof Error ? uploadError.message : 'Attachment upload failed.';
            setChatError(message);
          }
        }

        if (attachmentRows.length > 0) {
          const { error: attachmentInsertError } = await supabase
            .from('message_attachments')
            .insert(attachmentRows);
          if (attachmentInsertError) {
            setChatError(attachmentInsertError.message);
          }
        }
      }
    },
    [activeChatBuddyId, dmPreferencesByBuddyId, queueOutboxMessage, removeOutboxItem, userId],
  );

  const handleQueueRoomMessage = useCallback(
    ({
      roomId,
      content,
      clientMessageId,
      errorMessage,
    }: {
      roomId: string;
      content: string;
      clientMessageId?: string;
      errorMessage?: string;
    }) => {
      const entry = queueOutboxMessage({
        type: 'room',
        targetId: roomId,
        content,
        clientMessageId,
      });
      if (!entry) {
        return false;
      }

      if (errorMessage) {
        setOutboxItems((previous) =>
          normalizeOutboxItems(
            previous.map((item) => (item.id === entry.id ? markOutboxAttemptFailure(item, errorMessage) : item)),
          ),
        );
      }

      return true;
    },
    [queueOutboxMessage],
  );

  const handleRetryConversationOutboxMessage = useCallback(
    (itemId: string) => {
      setChatError(null);
      retryOutboxMessage(itemId);
    },
    [retryOutboxMessage],
  );

  const handleBeginForwardMessage = useCallback((message: ChatMessage) => {
    setForwardError(null);
    setForwardingMessage(message);
  }, []);

  const handleTogglePinnedForActiveChat = useCallback(() => {
    if (!activeChatBuddyId) {
      return;
    }

    void upsertConversationPreference(activeChatBuddyId, (current) => ({
      isPinned: !current.isPinned,
    }));
  }, [activeChatBuddyId, upsertConversationPreference]);

  const handleToggleMutedForActiveChat = useCallback(() => {
    if (!activeChatBuddyId) {
      return;
    }

    void upsertConversationPreference(activeChatBuddyId, (current) => ({
      isMuted: !current.isMuted,
    }));
  }, [activeChatBuddyId, upsertConversationPreference]);

  const handleToggleArchivedForActiveChat = useCallback(() => {
    if (!activeChatBuddyId) {
      return;
    }

    const currentPreference = getDmPreference(dmPreferencesByBuddyId, activeChatBuddyId);
    void upsertConversationPreference(activeChatBuddyId, {
      isArchived: !currentPreference.isArchived,
    });

    if (!currentPreference.isArchived) {
      setActiveChatBuddyId(null);
      activeChatBuddyIdRef.current = null;
      replaceAppPathInPlace(HI_ITS_ME_PATH);
    }
  }, [activeChatBuddyId, dmPreferencesByBuddyId, upsertConversationPreference]);

  const handleChangeThemeForActiveChat = useCallback(
    (newThemeKey: string | null) => {
      if (!activeChatBuddyId) {
        return;
      }

      void upsertConversationPreference(activeChatBuddyId, {
        themeKey: newThemeKey,
      });
    },
    [activeChatBuddyId, upsertConversationPreference],
  );

  const handleChangeWallpaperForActiveChat = useCallback(
    (newWallpaperKey: string | null) => {
      if (!activeChatBuddyId) {
        return;
      }

      void upsertConversationPreference(activeChatBuddyId, {
        wallpaperKey: newWallpaperKey,
      });
    },
    [activeChatBuddyId, upsertConversationPreference],
  );

  const handleSetDisappearingTimerForActiveChat = useCallback(
    (seconds: number | null) => {
      if (!activeChatBuddyId) {
        return;
      }

      void upsertConversationPreference(activeChatBuddyId, {
        disappearingTimerSeconds: seconds,
      });
    },
    [activeChatBuddyId, upsertConversationPreference],
  );

  const requestedRoomName = searchParams.get('room')?.trim() ?? '';
  const requestedDirectMessageUserId = searchParams.get('dm')?.trim() ?? '';
  const requestedShellSection = requestedRoomName
    ? 'chat'
    : requestedDirectMessageUserId
      ? 'im'
      : normalizeShellSection(searchParams.get(SHELL_SECTION_QUERY_KEY));

  const getUnreadCountForRoom = useCallback(
    (roomName: string) => {
      const normalized = normalizeRoomKey(roomName);
      if (!normalized) {
        return 0;
      }

      return Object.entries(unreadMessages).reduce((count, [key, value]) => {
        if (normalizeRoomKey(key) === normalized) {
          return count + value;
        }
        return count;
      }, 0);
    },
    [unreadMessages],
  );

  const resolveRoomByName = useCallback(async (roomNameInput: string, allowCreate: boolean) => {
    const roomName = roomNameInput.trim();
    const roomKey = normalizeRoomKey(roomName);
    if (!roomName) {
      return null;
    }

    let resolvedRoom: ChatRoom | null = null;

    const normalizeChatRoomRecord = (room: Partial<ChatRoom> | null | undefined): ChatRoom | null => {
      if (!room) {
        return null;
      }

      const normalizedName = typeof room.name === 'string' ? room.name.trim() : '';
      const roomId = typeof room.id === 'string' ? room.id : '';
      if (!roomId || !normalizedName) {
        return null;
      }

      return {
        id: roomId,
        name: normalizedName,
        room_key: normalizeRoomKey(typeof room.room_key === 'string' ? room.room_key : normalizedName) || null,
        invite_code: typeof room.invite_code === 'string' && room.invite_code ? room.invite_code : null,
      };
    };

    const roomSelectFields = roomKeySchemaUnavailableRef.current ? 'id,name' : 'id,name,room_key,invite_code';

    const existingRoomResult = await supabase
      .from('chat_rooms')
      .select(roomSelectFields)
      .eq('name', roomName)
      .maybeSingle();

    let existingRoom = normalizeChatRoomRecord((existingRoomResult.data as Partial<ChatRoom> | null) ?? null);
    let existingRoomError = existingRoomResult.error;

    if (isChatRoomsRoomKeyMissingError(existingRoomError)) {
      roomKeySchemaUnavailableRef.current = true;
      const fallbackRoomResult = await supabase
        .from('chat_rooms')
        .select('id,name')
        .eq('name', roomName)
        .maybeSingle();
      existingRoom = normalizeChatRoomRecord((fallbackRoomResult.data as Partial<ChatRoom> | null) ?? null);
      existingRoomError = fallbackRoomResult.error;
    }

    if (existingRoomError && existingRoomError.code !== 'PGRST116') {
      throw new Error(existingRoomError.message);
    }

    if (existingRoom) {
      resolvedRoom = existingRoom;
    } else {
      const caseInsensitiveRoomResult = await supabase
        .from('chat_rooms')
        .select(roomKeySchemaUnavailableRef.current ? 'id,name' : 'id,name,room_key')
        .ilike('name', roomName)
        .limit(1)
        .maybeSingle();

      let caseInsensitiveRoom = normalizeChatRoomRecord(
        (caseInsensitiveRoomResult.data as Partial<ChatRoom> | null) ?? null,
      );
      let caseInsensitiveRoomError = caseInsensitiveRoomResult.error;

      if (isChatRoomsRoomKeyMissingError(caseInsensitiveRoomError)) {
        roomKeySchemaUnavailableRef.current = true;
        const fallbackRoomResult = await supabase
          .from('chat_rooms')
          .select('id,name')
          .ilike('name', roomName)
          .limit(1)
          .maybeSingle();
        caseInsensitiveRoom = normalizeChatRoomRecord(
          (fallbackRoomResult.data as Partial<ChatRoom> | null) ?? null,
        );
        caseInsensitiveRoomError = fallbackRoomResult.error;
      }

      if (caseInsensitiveRoomError && caseInsensitiveRoomError.code !== 'PGRST116') {
        throw new Error(caseInsensitiveRoomError.message);
      }

      if (caseInsensitiveRoom) {
        resolvedRoom = caseInsensitiveRoom;
      }
    }

    if (!resolvedRoom && !roomKeySchemaUnavailableRef.current) {
      const keyedRoomResult = await supabase
        .from('chat_rooms')
        .select('id,name,room_key')
        .eq('room_key', roomKey)
        .limit(1)
        .maybeSingle();

      let keyedRoom = normalizeChatRoomRecord((keyedRoomResult.data as Partial<ChatRoom> | null) ?? null);
      let keyedRoomError = keyedRoomResult.error;

      if (isChatRoomsRoomKeyMissingError(keyedRoomError)) {
        roomKeySchemaUnavailableRef.current = true;
        keyedRoom = null;
        keyedRoomError = null;
      }

      if (keyedRoomError && keyedRoomError.code !== 'PGRST116') {
        throw new Error(keyedRoomError.message);
      }

      if (keyedRoom) {
        resolvedRoom = keyedRoom;
      }
    }

    if (!resolvedRoom && allowCreate) {
      const createdRoomResult = await supabase
        .from('chat_rooms')
        .insert(roomKeySchemaUnavailableRef.current ? { name: roomName } : { name: roomName, room_key: roomKey })
        .select(roomKeySchemaUnavailableRef.current ? 'id,name' : 'id,name,room_key')
        .single();

      let createdRoom = normalizeChatRoomRecord((createdRoomResult.data as Partial<ChatRoom> | null) ?? null);
      let createRoomError = createdRoomResult.error;

      if (isChatRoomsRoomKeyMissingError(createRoomError)) {
        roomKeySchemaUnavailableRef.current = true;
        const fallbackCreateRoomResult = await supabase
          .from('chat_rooms')
          .insert({ name: roomName })
          .select('id,name')
          .single();
        createdRoom = normalizeChatRoomRecord(
          (fallbackCreateRoomResult.data as Partial<ChatRoom> | null) ?? null,
        );
        createRoomError = fallbackCreateRoomResult.error;
      }

      if (createRoomError && createRoomError.code !== '23505') {
        throw new Error(createRoomError.message);
      }

      if (createdRoom) {
        resolvedRoom = createdRoom;
      }
    }

    if (!resolvedRoom && allowCreate) {
      const racedRoomResult = roomKeySchemaUnavailableRef.current
        ? await supabase
            .from('chat_rooms')
            .select('id,name')
            .ilike('name', roomName)
            .limit(1)
            .maybeSingle()
        : await supabase
            .from('chat_rooms')
            .select('id,name,room_key')
            .eq('room_key', roomKey)
            .maybeSingle();

      let racedRoom = normalizeChatRoomRecord((racedRoomResult.data as Partial<ChatRoom> | null) ?? null);
      let racedRoomError = racedRoomResult.error;

      if (isChatRoomsRoomKeyMissingError(racedRoomError)) {
        roomKeySchemaUnavailableRef.current = true;
        const fallbackRacedRoomResult = await supabase
          .from('chat_rooms')
          .select('id,name')
          .ilike('name', roomName)
          .limit(1)
          .maybeSingle();
        racedRoom = normalizeChatRoomRecord((fallbackRacedRoomResult.data as Partial<ChatRoom> | null) ?? null);
        racedRoomError = fallbackRacedRoomResult.error;
      }

      if (racedRoomError) {
        throw new Error(racedRoomError.message);
      }

      resolvedRoom = racedRoom;
    }

    return resolvedRoom;
  }, []);

  const openRoomView = useCallback(
    async (room: ChatRoom) => {
      setInitialUnreadForActiveRoom(getUnreadCountForRoom(room.name));
      setBodyShellSection('chat');
      await joinRoom(room.name);
      await clearUnreads(room.name);
      setActiveRoom(room);
      replaceAppPathInPlace(buildHiItsMePath({ section: 'chat', roomName: room.name }));
    },
    [clearUnreads, getUnreadCountForRoom, joinRoom],
  );

  const handleOpenActiveRoom = useCallback(
    async (roomName: string) => {
      if (!roomName.trim()) {
        return;
      }

      setRoomJoinError(null);
      setIsJoiningRoom(true);

      try {
        const resolvedRoom = await resolveRoomByName(roomName, true);
        if (!resolvedRoom) {
          await leaveRoom(roomName);
          setRoomJoinError('That room no longer exists.');
          return;
        }

        await openRoomView(resolvedRoom);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Could not open room right now.';
        setRoomJoinError(message);
      } finally {
        setIsJoiningRoom(false);
      }
    },
    [leaveRoom, openRoomView, resolveRoomByName],
  );

  const handleBackFromRoom = useCallback(() => {
    setInitialUnreadForActiveRoom(0);
    setActiveRoom(null);
    replaceAppPathInPlace(buildHiItsMePath({ section: 'chat' }));
  }, []);

  const handleLeaveRoom = useCallback(
    async (roomName: string) => {
      const normalizedRoomName = roomName.trim();
      if (!normalizedRoomName) {
        return;
      }

      await leaveRoom(normalizedRoomName);

      if (activeRoom && sameRoom(activeRoom.name, normalizedRoomName)) {
        setInitialUnreadForActiveRoom(0);
        setActiveRoom(null);
        replaceAppPathInPlace(buildHiItsMePath({ section: 'chat' }));
      }
    },
    [activeRoom, leaveRoom],
  );

  const handleLeaveCurrentRoom = useCallback(() => {
    if (!activeRoom) {
      return;
    }

    void handleLeaveRoom(activeRoom.name);
  }, [activeRoom, handleLeaveRoom]);

  useEffect(() => {
    setBodyShellSection((currentSection) =>
      currentSection === requestedShellSection ? currentSection : requestedShellSection,
    );
  }, [requestedShellSection]);

  useEffect(() => {
    if (!userId || !requestedRoomName) {
      return;
    }

    if (activeRoom && sameRoom(activeRoom.name, requestedRoomName)) {
      return;
    }

    let isCancelled = false;

    void (async () => {
      try {
        const resolvedRoom = await resolveRoomByName(requestedRoomName, false);
        if (isCancelled || !resolvedRoom) {
          return;
        }

        await joinRoom(resolvedRoom.name);
        setInitialUnreadForActiveRoom(getUnreadCountForRoom(resolvedRoom.name));
        await clearUnreads(resolvedRoom.name);
        setActiveRoom(resolvedRoom);
      } catch (error) {
        if (isCancelled) {
          return;
        }
        const message = error instanceof Error ? error.message : 'Could not open room from notification.';
        setRoomJoinError(message);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [activeRoom, clearUnreads, getUnreadCountForRoom, joinRoom, requestedRoomName, resolveRoomByName, userId]);

  useEffect(() => {
    if (!userId || !requestedDirectMessageUserId || requestedRoomName) {
      return;
    }

    if (requestedDirectMessageUserId === userId) {
      replaceAppPathInPlace(buildHiItsMePath({ section: 'profile' }));
      return;
    }

    let isCancelled = false;

    void (async () => {
      const { data: profileData, error: profileError } = await loadSingleUserProfile({
        applyFilters: (query) => query.eq('id', requestedDirectMessageUserId),
      });

      if (isCancelled) {
        return;
      }

      if (profileError) {
        console.error('Failed to load direct message profile:', profileError.message);
      } else if (profileData) {
        const profile = profileData;
        const resolvedProfileStatus = resolveStatusFields({
          status: profile.status,
          awayMessage: profile.away_message,
          statusMessage: profile.status_msg,
        });
        setTemporaryChatProfiles((previous) => ({
          ...previous,
          [requestedDirectMessageUserId]: {
            screenname: profile.screenname?.trim() || 'Unknown User',
            status: resolvedProfileStatus.status,
            away_message: resolvedProfileStatus.awayMessage || null,
            status_msg: resolvedProfileStatus.statusMessage,
            profile_bio: profile.profile_bio ?? null,
            buddy_icon_path: profile.buddy_icon_path ?? null,
            idle_since: profile.idle_since ?? null,
            last_active_at: profile.last_active_at ?? null,
          },
        }));
      }

      setTemporaryChatAllowedIds((previous) =>
        previous.includes(requestedDirectMessageUserId)
          ? previous
          : [...previous, requestedDirectMessageUserId],
      );

      openChatWindowForId(requestedDirectMessageUserId);
    })();

    return () => {
      isCancelled = true;
    };
  }, [loadSingleUserProfile, openChatWindowForId, requestedDirectMessageUserId, requestedRoomName, userId]);

  const handleJoinRoom = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!userId) {
      return;
    }

    const roomName = roomNameDraft.trim();
    if (!roomName) {
      setRoomJoinError('Enter a room name to join.');
      return;
    }

    setIsJoiningRoom(true);
    setRoomJoinError(null);

    try {
      const resolvedRoom = await resolveRoomByName(roomName, true);
      if (!resolvedRoom) {
        setRoomJoinError('Could not join room right now.');
        return;
      }

      await openRoomView(resolvedRoom);
      setShowRoomsWindow(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not join room right now.';
      setRoomJoinError(message);
    } finally {
      setIsJoiningRoom(false);
    }
  };

  const closeChatWindow = useCallback(() => {
    setActiveChatBuddyId(null);
    activeChatBuddyIdRef.current = null;
    setInitialUnreadForActiveChat(0);
    setActiveDmTypingText(null);
    if (dmTypingTimeoutRef.current) {
      clearTimeout(dmTypingTimeoutRef.current);
      dmTypingTimeoutRef.current = null;
    }
    setChatMessages([]);
    setChatError(null);
    setIsChatLoading(false);
    if (activeRoom) {
      replaceAppPathInPlace(buildHiItsMePath({ section: 'chat', roomName: activeRoom.name }));
    } else {
      replaceAppPathInPlace(buildHiItsMePath({ section: bodyShellSection === 'profile' ? 'im' : bodyShellSection }));
    }
  }, [activeRoom, bodyShellSection]);

  const scrollMainShellToTop = useCallback((behavior: ScrollBehavior = 'auto') => {
    const container = mainShellScrollRef.current;
    if (!container) {
      return;
    }

    requestAnimationFrame(() => {
      container.scrollTo({ top: 0, behavior });
    });
  }, []);

  const focusMainShellSection = useCallback((section: ShellSection, behavior: ScrollBehavior = 'smooth') => {
    void hapticSelection();
    setIsHeaderMenuOpen(false);
    setShowSavedMessagesWindow(false);
    setShowSystemStatusSheet(false);
    setShowPrivacySheet(false);
    setShowAwayModal(false);
    setShowAddWindow(false);
    setShowRoomsWindow(false);
    setIsAdminResetOpen(false);
    setIsRecoverySetupOpen(false);

    if (activeChatBuddyIdRef.current) {
      closeChatWindow();
    }
    if (activeRoom) {
      handleBackFromRoom();
    }

    setBodyShellSection(section);
    replaceAppPathInPlace(buildHiItsMePath({ section }));
    scrollMainShellToTop(behavior);
  }, [activeRoom, closeChatWindow, handleBackFromRoom, scrollMainShellToTop]);

  const openAddWindow = useCallback(() => {
    setSearchError(null);
    focusMainShellSection('buddy');
  }, [focusMainShellSection]);

  const openRoomsWindow = useCallback(() => {
    setRoomJoinError(null);
    if (!roomNameDraft && activeRoom?.name) {
      setRoomNameDraft(activeRoom.name);
    }
    focusMainShellSection('chat');
  }, [activeRoom?.name, focusMainShellSection, roomNameDraft]);

  const isCurrentUserAway = currentUserPresenceState === 'away';
  const isCurrentUserIdle = currentUserPresenceState === 'idle';
  const activePendingRequest = pendingRequests[0] ?? null;
  const activeChatBuddyPresenceSummary = activeChatBuddy ? getBuddyPresenceSummary(activeChatBuddy) : null;
  const xpModalFrameClass = 'ui-modal-frame';
  const xpModalHeaderClass = 'ui-modal-header';
  const xpModalBodyClass = 'ui-modal-body';
  const xpModalInputClass = 'ui-focus-ring ui-modal-input';
  const xpModalSelectClass = 'ui-focus-ring ui-modal-select';
  const xpModalButtonClass = 'ui-focus-ring ui-button-secondary ui-button-compact';
  const showSplitPresenceSections = buddySortMode === 'online_then_alpha' && conversationFilter === 'all';
  const onlineBuddiesSorted = visibleOnlineDirectMessageBuddies;
  const offlineBuddiesSorted = visibleOfflineDirectMessageBuddies;
  const isChatSyncBusy = syncState === 'hydrating' || syncState === 'syncing';
  const chatSyncSummary =
    syncState === 'hydrating'
      ? 'Hydrating from cache...'
      : syncState === 'syncing'
        ? 'Syncing with server...'
        : syncState === 'error'
          ? 'Sync issue'
          : syncState === 'live'
            ? `Live${lastSyncedAt ? ` (${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})` : ''}`
            : 'Idle';
  const pendingOutboxCount = outboxItems.length;
  const sendingOutboxCount = outboxItems.filter((item) => item.status === 'sending').length;
  const failedOutboxCount = outboxItems.filter((item) => item.status === 'failed').length;
  const outboxSummary =
    pendingOutboxCount === 0
      ? 'Outbox empty'
      : failedOutboxCount > 0
        ? `${failedOutboxCount} failed${failedOutboxCount === 1 ? '' : ' messages'}`
        : sendingOutboxCount > 0
          ? `${sendingOutboxCount} sending${sendingOutboxCount === 1 ? '' : ' messages'}`
          : `${pendingOutboxCount} queued${pendingOutboxCount === 1 ? '' : ' messages'}`;
  const latestOutboxError = outboxItems.find((item) => item.lastError)?.lastError ?? null;
  const activeDirectOutboxItems = useMemo(() => {
    if (!activeChatBuddyId) {
      return [];
    }

    return outboxItems.filter((item) => item.type === 'dm' && item.targetId === activeChatBuddyId);
  }, [activeChatBuddyId, outboxItems]);
  const activeChatPreference = useMemo(
    () => (activeChatBuddyId ? getDmPreference(dmPreferencesByBuddyId, activeChatBuddyId) : null),
    [activeChatBuddyId, dmPreferencesByBuddyId],
  );
  const activeRoomOutboxItems = useMemo(() => {
    if (!activeRoom?.id) {
      return [];
    }

    return outboxItems.filter((item) => item.type === 'room' && item.targetId === activeRoom.id);
  }, [activeRoom?.id, outboxItems]);
  const shouldShowSystemStatusChip =
    syncState === 'hydrating' || syncState === 'syncing' || syncState === 'error' || pendingOutboxCount > 0;
  const isConversationOverlayOpen = Boolean(activeChatBuddy || activeRoom);
  const activeTab =
    showAwayModal || showPrivacySheet
      ? 'profile'
      : Boolean(activeRoom)
        ? 'chat'
        : bodyShellSection;
  const headerSummaryParts = acceptedBuddies.length === 0
    ? ['Add your first buddy to get started']
    : [
        `${onlineBuddies.length} online`,
        `${acceptedBuddies.length} buddy${acceptedBuddies.length === 1 ? '' : 'ies'}`,
      ];
  if (pendingRequests.length > 0) {
    headerSummaryParts.push(`${pendingRequests.length} request${pendingRequests.length === 1 ? '' : 's'}`);
  }
  if (activeRooms.length > 0) {
    headerSummaryParts.push(`${activeRooms.length} room${activeRooms.length === 1 ? '' : 's'}`);
  }
  const hiItsMeHeaderSummary = headerSummaryParts.join(' · ');
  const totalUnreadDirectCount = Object.values(unreadDirectMessages).reduce((sum, count) => sum + count, 0);
  const activeAwayMood = getAwayMoodOption(awayMoodId);
  const buddyActivityById = useMemo(
    () =>
      new Map(
        buddyActivityToasts.map((item) => [item.buddyId, item] as const),
      ),
    [buddyActivityToasts],
  );
  const roomCards = useMemo(
    () =>
      activeRooms.map((roomName) => ({
        roomName,
        meta: getHimRoomMeta(roomName),
      })),
    [activeRooms],
  );
  const roomFilterOptions = useMemo(() => buildRoomFilterOptions(activeRooms), [activeRooms]);
  const filteredRoomCards = useMemo(
    () =>
      roomCards.filter(
        (roomCard) => roomFilterTag === 'all' || roomCard.meta.tags.some((tag) => tag.key === roomFilterTag),
      ),
    [roomCards, roomFilterTag],
  );
  useEffect(() => {
    if (roomFilterTag === 'all') {
      return;
    }

    if (roomFilterOptions.some((option) => option.key === roomFilterTag)) {
      return;
    }

    setRoomFilterTag('all');
  }, [roomFilterOptions, roomFilterTag]);
  const mainShellTitle =
    bodyShellSection === 'im'
      ? 'H.I.M.'
      : bodyShellSection === 'chat'
        ? 'Chat Rooms'
        : bodyShellSection === 'buddy'
          ? 'Find Buddies'
          : 'Profile';
  const mainShellSubtitle =
    bodyShellSection === 'im'
      ? hiItsMeHeaderSummary
      : bodyShellSection === 'chat'
      ? 'Find your people'
        : bodyShellSection === 'buddy'
          ? 'Search people and handle buddy requests'
          : 'Identity, status, and privacy';
  const nativeShellMode =
    activeChatBuddy || activeRoom
      ? 'conversation'
      : showSavedMessagesWindow ||
          showPrivacySheet ||
          showSystemStatusSheet ||
          isAdminResetOpen ||
          isRecoverySetupOpen ||
          showAwayModal ||
          showAddWindow ||
          showRoomsWindow
        ? 'sheet'
        : 'standard';
  const nativeShellTitle =
    activeChatBuddy?.screenname ||
    activeRoom?.name ||
    (showSavedMessagesWindow
      ? 'Saved Messages'
      : showPrivacySheet
        ? 'Privacy'
        : showSystemStatusSheet
          ? 'System Status'
          : isAdminResetOpen
            ? 'Reset Account Access'
            : isRecoverySetupOpen
              ? 'Finish Account Protection'
              : mainShellTitle);
  const nativeShellSubtitle =
    activeChatBuddy
      ? activeChatBuddyPresenceSummary?.presenceLabel || 'Direct message'
      : activeRoom
        ? 'Room chat'
        : showSavedMessagesWindow
          ? 'Private notes'
          : showPrivacySheet
            ? 'Control what H.I.M. reveals'
            : showSystemStatusSheet
              ? chatSyncSummary
              : isAdminResetOpen
                ? 'Recovery concierge'
                : isRecoverySetupOpen
                  ? 'Set your private recovery code'
                  : mainShellSubtitle;
  const nativeShellCanGoBack = Boolean(
    activeChatBuddy ||
      activeRoom ||
      showSavedMessagesWindow ||
      showPrivacySheet ||
      showSystemStatusSheet ||
      isAdminResetOpen ||
      isRecoverySetupOpen ||
      showAwayModal ||
      isHeaderMenuOpen ||
      bodyShellSection !== 'profile',
  );
  const nativeShellShowsBottomChrome = !isConversationOverlayOpen;
  const shellIsDark = isDark || (typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));
  const nativeShellTrailingActions = useMemo(
    () =>
      nativeShellMode === 'conversation'
        ? ([] as const)
        : nativeShellMode === 'sheet'
          ? (['openMenu'] as const)
          : bodyShellSection === 'im'
            ? (['openSaved', 'toggleTheme', 'openMenu'] as const)
            : bodyShellSection === 'profile'
            ? (['toggleTheme', 'openMenu'] as const)
            : (['toggleTheme', 'openMenu'] as const),
    [bodyShellSection, nativeShellMode],
  );
  const nativeShellAccentTone =
    activeRoom || bodyShellSection === 'chat'
      ? 'violet'
      : bodyShellSection === 'buddy'
        ? 'emerald'
        : bodyShellSection === 'profile'
          ? 'slate'
          : 'blue';
  const headerActionButtonClass =
    'ui-focus-ring ui-window-header-button min-h-[40px] px-3 text-[11px] font-semibold';

  const renderDirectMessageRow = (buddy: (typeof acceptedBuddies)[number]) => {
    const unreadDirectCount = unreadDirectMessages[buddy.id] ?? 0;
    const isSelected = selectedBuddyId === buddy.id;
    const presenceSummary = getBuddyPresenceSummary(buddy);
    const conversationPreference = getDmPreference(dmPreferencesByBuddyId, buddy.id);
    const isBlockedBuddy = blockedUserIds.includes(buddy.id);
    const recentBuddyActivity = buddyActivityById.get(buddy.id) ?? null;
    const showArrivalWave = recentBuddyActivity?.tone === 'online' || recentBuddyActivity?.tone === 'back';
    const presenceToneClass =
      presenceSummary.presenceState === 'away'
        ? 'text-[var(--gold)]'
        : presenceSummary.presenceState === 'idle'
          ? 'text-[var(--lavender)]'
          : presenceSummary.presenceState === 'offline'
            ? 'text-[var(--muted)]'
            : 'text-[var(--green)]';

    return (
      <div
        key={buddy.id}
        data-testid={`dm-row-${buddy.id}`}
        data-unread-dm={unreadDirectCount}
        data-screenname={buddy.screenname}
        data-active={isSelected ? 'true' : 'false'}
        className="ui-list-row group text-left"
      >
        <button
          type="button"
          onClick={() => openBuddyProfile(buddy.id)}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <ProfileAvatar
            screenname={buddy.screenname}
            buddyIconPath={buddy.buddy_icon_path}
            presenceState={presenceSummary.presenceState}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className={`ui-screenname truncate text-[13px] font-semibold leading-tight ${
              isSelected ? 'text-[var(--rose)]' : 'text-slate-800 dark:text-slate-100'
            }`}>
              {buddy.screenname}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              {conversationPreference.isPinned ? (
                <span className="rounded-full border border-[rgba(232,96,138,0.16)] bg-[rgba(232,96,138,0.1)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--rose)]">
                  Pinned
                </span>
              ) : null}
              {isBlockedBuddy ? (
                <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-red-500 dark:bg-red-500/15 dark:text-red-200">
                  Blocked
                </span>
              ) : null}
              {conversationPreference.isMuted ? (
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:bg-[#13100E] dark:text-slate-300">
                  Muted
                </span>
              ) : null}
              {unreadDirectCount > 0 ? (
                <span className="rounded-full border border-[rgba(232,96,138,0.16)] bg-[rgba(232,96,138,0.1)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[var(--rose)]">
                  Unread
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <p className={`truncate text-[11px] font-semibold ${presenceToneClass}`}>
                {presenceSummary.presenceLabel}
              </p>
              {showArrivalWave ? (
                <span className="ui-buddy-arrival-wave" aria-hidden="true" title={recentBuddyActivity?.message}>
                  <span />
                  <span />
                  <span />
                </span>
              ) : null}
            </div>
            <p className="truncate text-[11px] text-slate-400" title={recentBuddyActivity?.message || presenceSummary.presenceDetail}>
              {activeDmTypingText && activeChatBuddyId === buddy.id ? (
                <span className="italic text-[var(--rose)]">typing…</span>
              ) : (
                buddyLastMessagePreview[buddy.id] || presenceSummary.presenceDetail
              )}
            </p>
          </div>
        </button>

        {unreadDirectCount > 0 ? (
          <span
            data-testid={`dm-unread-${buddy.id}`}
            aria-label={`Unread from ${buddy.screenname}: ${unreadDirectCount}`}
            className={`ui-unread-badge ml-1 flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
              isSelected ? '' : 'aim-unread-badge-pulse'
            }`}
          >
            {unreadDirectCount}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => (isBlockedBuddy ? openBuddyProfile(buddy.id) : handleOpenChat(buddy.id))}
          className={`ui-focus-ring shrink-0 ${isSelected && !isBlockedBuddy ? 'ui-button-primary' : 'ui-button-secondary'} ui-button-compact`}
        >
          {isBlockedBuddy ? 'View' : 'IM'}
        </button>
      </div>
    );
  };
  const renderSavedMessagesRow = () => (
    <div
      key="saved-messages"
      data-active={showSavedMessagesWindow ? 'true' : 'false'}
      className="ui-list-row group text-left"
    >
      <button
        type="button"
        onClick={() => {
          setSavedMessageError(null);
          setShowSavedMessagesWindow(true);
        }}
        className="flex min-w-0 flex-1 items-center gap-3 text-left"
      >
        <div className="ui-brand-sparkle flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
          <AppIcon kind="mail" className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold leading-tight text-slate-800 dark:text-slate-100">Saved Messages</p>
          <p className="truncate text-[11px] font-semibold text-[var(--rose)]">Private notes</p>
          <p className="truncate text-[11px] text-slate-400">
            {savedMessages[0]
              ? htmlToPlainText(savedMessages[0].content).trim() || 'Saved keepsakes'
              : 'Save standout messages or jot down notes'}
          </p>
        </div>
      </button>
      <button
        type="button"
        onClick={() => {
          setSavedMessageError(null);
          setShowSavedMessagesWindow(true);
        }}
        className={`ui-focus-ring shrink-0 ${showSavedMessagesWindow ? 'ui-button-primary' : 'ui-button-secondary'} ui-button-compact`}
      >
        Open
      </button>
    </div>
  );
  const pinnedConversationRows = filteredDirectMessageBuddies.filter(
    (buddy) => getDmPreference(dmPreferencesByBuddyId, buddy.id).isPinned,
  );
  const visibleDirectMessageRows = showSplitPresenceSections
    ? [...onlineBuddiesSorted, ...offlineBuddiesSorted]
    : filteredDirectMessageBuddies;
  const visibleDirectMessageSections = showSplitPresenceSections
    ? [
        {
          id: 'online' as const,
          label: 'Online',
          buddies: filteredDirectMessageBuddies.filter((buddy) => {
            const state = getBuddyPresenceSummary(buddy).presenceState;
            return state === 'available' || state === 'idle';
          }),
        },
        {
          id: 'away' as const,
          label: 'Away',
          buddies: filteredDirectMessageBuddies.filter((buddy) => getBuddyPresenceSummary(buddy).presenceState === 'away'),
        },
        {
          id: 'offline' as const,
          label: 'Offline',
          buddies: filteredDirectMessageBuddies.filter((buddy) => getBuddyPresenceSummary(buddy).presenceState === 'offline'),
        },
      ].filter((section) => section.buddies.length > 0)
    : [];
  const conversationFilterOptions = [
    { id: 'all', label: 'All', count: unarchivedDirectMessageBuddies.length },
    {
      id: 'unread',
      label: 'Unread',
      count: unarchivedDirectMessageBuddies.filter((buddy) => (unreadDirectMessages[buddy.id] ?? 0) > 0).length,
    },
    {
      id: 'pinned',
      label: 'Pinned',
      count: unarchivedDirectMessageBuddies.filter((buddy) => getDmPreference(dmPreferencesByBuddyId, buddy.id).isPinned).length,
    },
    { id: 'requests', label: 'Requests', count: pendingRequests.length },
    { id: 'archived', label: 'Archived', count: archivedDirectMessageBuddies.length },
  ] as Array<{ id: ConversationFilter; label: string; count: number }>;
  const xpModalPrimaryButtonClass =
    'ui-focus-ring ui-button-primary ui-button-compact disabled:opacity-60';

  const handleOpenImFromActionBar = useCallback(() => {
    focusMainShellSection('im');
  }, [focusMainShellSection]);

  const handleSetupAction = useCallback(() => {
    focusMainShellSection('profile');
  }, [focusMainShellSection]);

  const handleNativeShellCommand = useEffectEvent((command: NativeShellCommand) => {
    if (command.type === 'selectTab') {
      switch (command.tab) {
        case 'im':
          handleOpenImFromActionBar();
          return;
        case 'chat':
          openRoomsWindow();
          return;
        case 'buddy':
          openAddWindow();
          return;
        case 'profile':
          handleSetupAction();
          return;
        default:
          return;
      }
    }

    switch (command.action) {
      case 'toggleTheme':
        toggleDark();
        return;
      case 'openSaved':
        setSavedMessageError(null);
        setShowSavedMessagesWindow(true);
        return;
      case 'openAdd':
        openAddWindow();
        return;
      case 'openMenu':
        setIsHeaderMenuOpen((previous) => !previous);
        return;
      case 'openPrivacy':
        openPrivacyControls();
        return;
      case 'openAdminReset':
        openAdminResetWindow();
        return;
      case 'signOff':
        void handleSignOff();
        return;
      case 'goBack':
        if (isHeaderMenuOpen) {
          setIsHeaderMenuOpen(false);
          return;
        }
        if (showSavedMessagesWindow) {
          setShowSavedMessagesWindow(false);
          return;
        }
        if (showSystemStatusSheet) {
          setShowSystemStatusSheet(false);
          return;
        }
        if (showPrivacySheet) {
          setShowPrivacySheet(false);
          return;
        }
        if (showAddWindow) {
          setShowAddWindow(false);
          return;
        }
        if (showRoomsWindow) {
          setShowRoomsWindow(false);
          return;
        }
        if (showAwayModal) {
          setShowAwayModal(false);
          return;
        }
        if (isAdminResetOpen) {
          setIsAdminResetOpen(false);
          return;
        }
        if (activeChatBuddy) {
          closeChatWindow();
          return;
        }
        if (activeRoom) {
          handleBackFromRoom();
          return;
        }
        if (bodyShellSection !== 'profile') {
          focusMainShellSection('profile');
        }
        return;
      default:
        return;
    }
  });

  useEffect(() => {
    if (!nativeShellActive) {
      return;
    }

    return subscribeNativeShellCommands(handleNativeShellCommand);
  }, [nativeShellActive]);

  useEffect(() => {
    if (!nativeShellActive) {
      return;
    }

    void publishNativeShellChromeState({
      title: nativeShellTitle,
      subtitle: nativeShellSubtitle,
      mode: nativeShellMode,
      activeTab,
      tabBarVisibility: nativeShellShowsBottomChrome ? 'visible' : 'hidden',
      leadingAction: nativeShellCanGoBack ? 'goBack' : null,
      trailingActions: [...nativeShellTrailingActions],
      accentTone: nativeShellAccentTone,
      canGoBack: nativeShellCanGoBack,
      isDark: shellIsDark,
      isAdminUser,
      unreadDirectCount: totalUnreadDirectCount,
      showsTopChrome: true,
      showsBottomChrome: nativeShellShowsBottomChrome,
    });
  }, [
    activeTab,
    hiItsMeHeaderSummary,
    chatSyncSummary,
    isAdminUser,
    nativeShellActive,
    nativeShellCanGoBack,
    nativeShellAccentTone,
    nativeShellMode,
    nativeShellShowsBottomChrome,
    shellIsDark,
    nativeShellSubtitle,
    nativeShellTrailingActions,
    nativeShellTitle,
    totalUnreadDirectCount,
  ]);

  const selectedAwayPreset = awayPresets.find((preset) => preset.id === selectedAwayPresetId) ?? null;
  const awayPreview = resolveAwayTemplate(
    awayText || selectedAwayPreset?.message || "I'm away right now.",
    screenname,
    'Buddy',
  );
  const savedAwayPreview = awayMessage?.trim()
    ? resolveAwayTemplate(awayMessage, screenname, screenname)
    : 'Set an away message so your buddies know the vibe.';
  const selfStatusCopy =
    currentUserPresenceState === 'away'
      ? savedAwayPreview
      : profileBio || (statusMsg.trim() && statusMsg !== AVAILABLE_STATUS ? statusMsg : 'Say a little more than “available.”');
  const currentUserPresenceToneClass =
    currentUserPresenceState === 'away'
      ? 'text-[var(--gold)]'
      : currentUserPresenceState === 'idle'
        ? 'text-[var(--lavender)]'
        : currentUserPresenceState === 'offline'
          ? 'text-[var(--muted)]'
          : 'text-[var(--green)]';
  const currentUserPresenceChipClass =
    currentUserPresenceState === 'away'
      ? 'border border-[rgba(212,150,58,0.18)] bg-[rgba(212,150,58,0.12)] text-[var(--gold)]'
      : currentUserPresenceState === 'idle'
        ? 'border border-[rgba(167,139,250,0.18)] bg-[rgba(167,139,250,0.12)] text-[var(--lavender)]'
        : currentUserPresenceState === 'offline'
          ? 'border border-[rgba(156,142,130,0.18)] bg-[rgba(156,142,130,0.12)] text-[var(--muted)]'
          : 'border border-[rgba(78,201,122,0.18)] bg-[rgba(78,201,122,0.12)] text-[var(--green)]';
  const profileQuickStats = [
    { label: 'buddies', value: acceptedBuddies.length },
    { label: 'rooms', value: activeRooms.length },
    { label: 'saved', value: savedMessages.length },
  ];

  return (
    <main className="h-[100dvh] overflow-hidden bg-transparent">
      <RetroWindow
        title="H.I.M."
        variant="xp_shell"
        hideHeader={nativeShellActive}
        xpTitleText={mainShellTitle}
        xpSubtitleText={mainShellSubtitle}
        headerActions={(
          <>
            <button
              type="button"
              onClick={toggleDark}
              className={headerActionButtonClass}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? 'Light' : 'Dark'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSavedMessageError(null);
                setShowSavedMessagesWindow(true);
              }}
              className={headerActionButtonClass}
              aria-label="Open saved messages"
            >
              Saved
            </button>
            <button
              type="button"
              onClick={openAddWindow}
              className={headerActionButtonClass}
              aria-label="Find buddies"
            >
              Find
            </button>
          </>
        )}
        onXpClose={bodyShellSection !== 'profile' ? () => focusMainShellSection('profile') : undefined}
        onXpSignOff={() => setIsHeaderMenuOpen((previous) => !previous)}
      >
        <div
          className={`relative flex h-full min-h-0 flex-col overflow-hidden text-[12px] text-slate-700 dark:text-slate-300 ${nativeShellActive ? 'bg-transparent' : 'ui-window-panel rounded-[1.6rem]'}`}
        >
          {isHeaderMenuOpen ? (
            <div className="fixed inset-0 z-30" onClick={() => setIsHeaderMenuOpen(false)}>
              <div
                className={`ui-popover-menu absolute right-2 w-56 rounded-2xl p-1.5 ${
                  nativeShellActive ? 'top-3' : 'top-[calc(env(safe-area-inset-top)+3.2rem)]'
                }`}
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={openPrivacyControls}
                  className="ui-focus-ring ui-popover-item mt-0.5"
                >
                  Privacy
                </button>
                <button
                  type="button"
                  onClick={() => void handleSignOff()}
                  className="ui-focus-ring ui-popover-item"
                >
                  Sign Off
                </button>
                {isAdminUser ? (
                  <button
                    type="button"
                    onClick={openAdminResetWindow}
                    className="ui-focus-ring ui-popover-item mt-0.5"
                  >
                    Reset Access
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col">
            <div
              ref={mainShellScrollRef}
              className="min-h-0 flex-1 overflow-y-auto"
              style={{ paddingBottom: '1rem' }}
              onTouchStart={pullToRefresh.onTouchStart}
              onTouchMove={pullToRefresh.onTouchMove}
              onTouchEnd={pullToRefresh.onTouchEnd}
            >
            {(pullToRefresh.pullDistance > 0 || pullToRefresh.isRefreshing) ? (
              <div
                className="flex flex-col items-center justify-center gap-1 overflow-hidden text-slate-400 transition-all"
                style={{ height: pullToRefresh.isRefreshing ? 44 : Math.min(pullToRefresh.pullDistance * 0.6, 44) }}
                aria-hidden="true"
              >
                <svg className={`h-6 w-6 ${pullToRefresh.isRefreshing ? 'animate-spin' : ''}`} viewBox="0 0 24 24">
                  <circle
                    cx="12" cy="12" r="9"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={`${pullToRefresh.isRefreshing ? 42 : Math.min(pullToRefresh.pullDistance / 70, 1) * 56.5} 56.5`}
                    className="text-[var(--rose)]"
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%' }}
                  />
                </svg>
                <span className="text-[10px] font-semibold">
                  {pullToRefresh.isRefreshing ? 'Refreshing…' : pullToRefresh.pullDistance >= 70 ? 'Release' : ''}
                </span>
              </div>
            ) : null}
              {bodyShellSection === 'profile' ? (
                <div className="ui-page-stack">
                  <div className="ui-panel-card ui-profile-hero rounded-[1.7rem] px-4 py-5">
                    <input
                      ref={quickPhotoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isProfileSchemaUnavailable}
                      onChange={(event) => {
                        handleQuickPhotoSelection(event.target.files);
                        event.currentTarget.value = '';
                      }}
                    />
                    <div className="ui-profile-hero-glow" aria-hidden="true" />
                    <div className="relative z-[1] flex flex-col items-center text-center">
                      <button
                        type="button"
                        onClick={handleQuickPhotoPickerOpen}
                        className="ui-profile-avatar-button group relative shrink-0 rounded-full text-left transition active:scale-95"
                        aria-label="Change profile photo"
                      >
                        <ProfileAvatar
                          screenname={screenname}
                          buddyIconPath={buddyIconPath}
                          presenceState={currentUserPresenceState}
                          size="lg"
                        />
                        <span className="ui-profile-avatar-badge">
                          Buddy icon
                        </span>
                        <span className="ui-profile-pro-badge">H.I.M. Pro</span>
                      </button>
                      <div className="mt-4 min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--rose)]">You</p>
                        <p className="ui-screenname mt-1 truncate text-[17px] font-semibold text-slate-800 dark:text-slate-100">{screenname}</p>
                        <p className={`mt-1 text-[11px] font-semibold ${currentUserPresenceToneClass}`}>
                          {getPresenceLabel(currentUserPresenceState)}
                        </p>
                        {currentUserPresenceDetail !== getPresenceLabel(currentUserPresenceState) ? (
                          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-400">{currentUserPresenceDetail}</p>
                        ) : null}
                        {profileBio ? (
                          <p className="mt-2 text-[11px] italic text-slate-400 dark:text-slate-400">{profileBio}</p>
                        ) : null}
                        <p className="mt-2 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                          {buddyIconPath ? 'Tap your avatar to change your photo.' : 'Tap your avatar to add a profile photo.'}
                        </p>
                      </div>

                      <div className="ui-profile-away-box mt-4 w-full" data-mood={awayMoodId}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="ui-profile-away-label">Away message</p>
                          <span className="ui-away-mood-pill" data-tone={activeAwayMood.tone}>
                            {activeAwayMood.label}
                          </span>
                        </div>
                        <p className="ui-profile-away-text mt-1">{savedAwayPreview}</p>
                      </div>

                      <div className="ui-profile-stat-row mt-4 w-full">
                        {profileQuickStats.map((item) => (
                          <div key={item.label} className="ui-profile-stat">
                            <p className="ui-profile-stat-value">{item.value}</p>
                            <p className="ui-profile-stat-label">{item.label}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-4 grid w-full grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => openAwayModal('away')}
                          className="ui-focus-ring ui-button-primary ui-button-compact justify-center"
                        >
                          {currentUserPresenceState === 'away' ? 'Update away' : 'Away message'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openAwayModal('profile')}
                          className="ui-focus-ring ui-button-secondary ui-button-compact justify-center"
                        >
                          Edit profile
                        </button>
                      </div>
                    </div>
                  </div>
                  {awayModalError ? <p className="ui-note-error mt-2">{awayModalError}</p> : null}

                  <div className="ui-panel-card rounded-[1.55rem] px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="ui-section-kicker">Presence</p>
                        <p className="mt-2 text-[14px] font-semibold text-slate-800 dark:text-slate-100">
                          {currentUserPresenceDetail}
                        </p>
                        <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                          {selfStatusCopy}
                        </p>
                        {awaySinceAt ? (
                          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                            Since {new Date(awaySinceAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${currentUserPresenceChipClass}`}>
                          {getPresenceLabel(currentUserPresenceState)}
                        </span>
                        <span className="ui-away-mood-pill" data-tone={activeAwayMood.tone}>
                          {activeAwayMood.label}
                        </span>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => openAwayModal('away')}
                        className="ui-focus-ring ui-button-secondary ui-button-compact justify-center"
                      >
                        Away message
                      </button>
                      <button
                        type="button"
                        onClick={() => openAwayModal('profile')}
                        className="ui-focus-ring ui-button-secondary ui-button-compact justify-center"
                      >
                        Edit profile
                      </button>
                    </div>
                  </div>

                  <div className="ui-panel-card rounded-[1.55rem] px-4 py-4">
                    <p className="ui-section-kicker">Privacy & System</p>
                    <div className="mt-3 space-y-2">
                      <button
                        type="button"
                        onClick={openPrivacyControls}
                        className="ui-focus-ring ui-list-row text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">Privacy controls</p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500">
                            Read receipts, notification previews, app lock, and blocked buddies.
                          </p>
                        </div>
                        <span className="ui-button-secondary ui-button-compact">Open</span>
                      </button>

                      {shouldShowSystemStatusChip ? (
                        <button
                          type="button"
                          onClick={() => setShowSystemStatusSheet(true)}
                          className="ui-focus-ring ui-status-chip"
                        >
                          <div className="flex min-w-0 items-center gap-1.5">
                            <span className={`h-1.5 w-1.5 rounded-full ${
                              syncState === 'error' ? 'bg-red-400' :
                              isChatSyncBusy ? 'bg-amber-400 animate-pulse' :
                              pendingOutboxCount > 0 ? 'bg-[#D4963A]' :
                              'bg-emerald-400'
                            }`} />
                            <span className="truncate">
                              {syncState === 'error'
                                ? 'Sync issue'
                                : isChatSyncBusy
                                  ? chatSyncSummary
                                  : pendingOutboxCount > 0
                                    ? outboxSummary
                                    : 'System status'}
                            </span>
                          </div>
                          <span className="shrink-0 rounded-full border border-white/70 bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-slate-700 dark:bg-[#13100E]/70 dark:text-slate-300">
                            Details
                          </span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {bodyShellSection === 'buddy' ? (
                <section className="px-3 pb-2">
                  <div className="ui-panel-card rounded-[1.45rem] px-4 py-4">
                    <div className="min-w-0">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">Find People</p>
                          <p className="mt-1 text-[14px] font-semibold text-slate-800 dark:text-slate-100">Search and add buddies without leaving the page.</p>
                        </div>
                        {pendingRequests.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setConversationFilter('requests');
                              focusMainShellSection('im');
                            }}
                            className="ui-focus-ring ui-button-secondary ui-button-compact shrink-0"
                          >
                            {pendingRequests.length} request{pendingRequests.length === 1 ? '' : 's'}
                          </button>
                        ) : null}
                      </div>
                      <form onSubmit={handleSearch} className="mt-3 flex gap-2">
                        <input
                          value={searchTerm}
                          onChange={(event) => setSearchTerm(event.target.value)}
                          className={xpModalInputClass}
                          placeholder="Search screen names..."
                        />
                        <button
                          type="submit"
                          className={`${xpModalPrimaryButtonClass} shrink-0`}
                        >
                          Search
                        </button>
                      </form>

                      {searchError ? <p className="ui-note-error mt-2">{searchError}</p> : null}

                      {(isSearching || searchTerm.trim() !== '' || searchResults.length > 0) ? (
                        <div className="mt-3 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white/80 p-2 shadow-[inset_0_1px_1px_rgba(15,23,42,0.05)] dark:border-slate-700 dark:bg-[#13100E]/50">
                          {isSearching ? (
                            <p className="p-2 text-sm italic text-slate-500">Searching screen names...</p>
                          ) : null}
                          {!isSearching && searchTerm.trim() !== '' && searchResults.length === 0 ? (
                            <p className="p-2 text-sm italic text-slate-500">No screen names found.</p>
                          ) : null}
                          {!isSearching &&
                            searchResults.map((profile) => {
                              const resolvedProfileStatus = resolveStatusFields({
                                status: profile.status,
                                awayMessage: profile.away_message,
                                statusMessage: profile.status_msg,
                              });
                              const isProfileAway = normalizeStatusLabel(resolvedProfileStatus.status) === AWAY_STATUS;

                              return (
                                <div
                                  key={profile.id}
                                  className="ui-panel-muted mb-2 flex items-center justify-between gap-2 rounded-2xl p-3 last:mb-0"
                                >
                                  <div className="min-w-0">
                                    <p className="ui-screenname truncate font-bold">{profile.screenname || 'Unknown User'}</p>
                                    <p className="truncate text-[11px] italic text-slate-500">
                                      {isProfileAway
                                        ? `Away: ${resolvedProfileStatus.awayMessage || 'Away'}`
                                        : resolvedProfileStatus.statusMessage}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleAddBuddy(profile)}
                                    disabled={isAddingBuddyId === profile.id}
                                    className={xpModalPrimaryButtonClass}
                                  >
                                    {isAddingBuddyId === profile.id ? 'Adding...' : 'Add'}
                                  </button>
                                </div>
                              );
                            })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </section>
              ) : null}

              {bodyShellSection === 'im' ? (
                <div className="ui-page-stack pt-2">
                  <section className="ui-my-status-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="ui-my-status-label">
                          {currentUserPresenceState === 'away' ? 'your away message' : 'your line right now'}
                        </p>
                        <p className="ui-my-status-text">{selfStatusCopy}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${currentUserPresenceChipClass}`}>
                        {getPresenceLabel(currentUserPresenceState)}
                      </span>
                    </div>
                    <div className="ui-my-status-chips">
                      <button
                        type="button"
                        onClick={() => openAwayModal('away')}
                        className="ui-focus-ring ui-my-status-chip"
                        data-tone="rose"
                      >
                        {currentUserPresenceState === 'away' ? 'edit' : 'set away'}
                      </button>
                      <span className="ui-my-status-chip" data-tone={activeAwayMood.tone}>
                        {activeAwayMood.label}
                      </span>
                      <button
                        type="button"
                        onClick={currentUserPresenceState === 'away' ? handleImBack : () => openAwayModal('profile')}
                        className="ui-focus-ring ui-my-status-chip"
                        data-tone={currentUserPresenceState === 'away' ? 'ghost' : 'gold'}
                      >
                        {currentUserPresenceState === 'away' ? 'back online' : 'edit profile'}
                      </button>
                    </div>
                  </section>

                  {isCurrentUserIdle ? (
                    <div className="ui-note-info">
                      <div className="flex items-start gap-2">
                        <AppIcon kind="clock" className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
                        <div className="min-w-0 flex-1">
                          <p className="text-[12px] font-semibold text-sky-800">Idle</p>
                          <p className="mt-0.5 text-[11px] text-sky-700">{formatPresenceSince(idleSinceAt, 'Idle since')}</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleClearIdle}
                          className="ui-focus-ring ui-button-secondary ui-button-compact shrink-0"
                        >
                          I&apos;m Here
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {pinnedConversationRows.length > 0 ? (
                    <section className="ui-list-panel px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="ui-section-kicker">Pinned</p>
                          <p className="mt-1 text-[13px] font-semibold text-slate-800 dark:text-slate-100">Fast access to your priority chats.</p>
                        </div>
                        <span className="ui-section-count">{pinnedConversationRows.length}</span>
                      </div>
                      <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
                        {pinnedConversationRows.map((buddy) => {
                          const unread = unreadDirectMessages[buddy.id] ?? 0;
                          return (
                            <button
                              key={buddy.id}
                              type="button"
                              onClick={() => handleOpenChat(buddy.id)}
                              className="ui-focus-ring flex min-w-[68px] flex-col items-center gap-1.5"
                            >
                              <div className="relative">
                                <ProfileAvatar
                                  screenname={buddy.screenname}
                                  buddyIconPath={buddy.buddy_icon_path}
                                  presenceState={getBuddyPresenceSummary(buddy).presenceState}
                                  size="md"
                                />
                                {unread > 0 ? (
                                  <span className="ui-unread-badge ui-unread-badge-pulse absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold">
                                    {unread}
                                  </span>
                                ) : null}
                              </div>
                              <span className="ui-screenname max-w-[56px] truncate text-[10px] font-medium text-slate-600 dark:text-slate-400">
                                {buddy.screenname}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}

                  <section className="ui-list-panel overflow-hidden">
                    <div className="px-4 pt-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="ui-section-kicker">Messages</p>
                          <p className="mt-1 text-[16px] font-semibold text-slate-800 dark:text-slate-100">Direct Messages</p>
                          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                            {conversationFilter === 'requests'
                              ? 'People who messaged you before being accepted.'
                              : `${filteredDirectMessageBuddies.length} conversation${filteredDirectMessageBuddies.length === 1 ? '' : 's'} · ${totalUnreadDirectCount} unread`}
                          </p>
                        </div>
                        <span className="ui-section-count">
                          {conversationFilter === 'requests' ? pendingRequests.length : filteredDirectMessageBuddies.length}
                        </span>
                      </div>
                    </div>

                    <div className="ui-filter-band">
                      <label htmlFor="buddy-sort-mode" className="sr-only">Buddy Sort Mode</label>
                      <select
                        id="buddy-sort-mode"
                        title="Buddy Sort Mode"
                        value={buddySortMode}
                        onChange={(event) => setBuddySortMode(event.target.value as BuddySortMode)}
                        className={`${xpModalSelectClass} min-h-[34px] w-auto py-1 pl-3 pr-8 text-[11px]`}
                      >
                        <option value="online_then_alpha">Online first</option>
                        <option value="alpha">A – Z</option>
                        <option value="recent_activity">Recent activity</option>
                      </select>
                      <div className="flex flex-1 gap-1 overflow-x-auto pb-1">
                        {conversationFilterOptions.map((filterOption) => (
                          <button
                            key={filterOption.id}
                            type="button"
                            onClick={() => setConversationFilter(filterOption.id)}
                            className="ui-focus-ring ui-filter-chip"
                            data-active={conversationFilter === filterOption.id ? 'true' : 'false'}
                          >
                            <span>{filterOption.label}</span>
                            {filterOption.count > 0 ? <span>({filterOption.count})</span> : null}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="px-2 pb-2">
                      {buddyListWaveTone ? (
                        <div className="aim-buddy-wave px-2 pb-2" data-tone={buddyListWaveTone} aria-hidden="true">
                          <span />
                          <span />
                          <span />
                        </div>
                      ) : null}
                      {isBootstrapping || (!isBootstrapping && isLoadingBuddies) ? (
                        <div className="space-y-2 px-2 py-2 ui-fade-in">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <div key={idx} className="flex items-center gap-3 rounded-2xl px-2 py-2">
                              <div className="ui-skeleton-circle h-10 w-10 shrink-0" />
                              <div className="flex-1 space-y-2">
                                <div className="ui-skeleton h-3.5 w-28" />
                                <div className="ui-skeleton h-2.5 w-20" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : null}

                      {!isBootstrapping && !isLoadingBuddies && acceptedBuddies.length === 0 && conversationFilter !== 'requests' ? (
                        <div className="ui-empty-state px-6 py-10 ui-fade-in">
                          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(232,96,138,0.16)] bg-[rgba(232,96,138,0.12)]">
                            <AppIcon kind="smile" className="h-8 w-8 text-[var(--rose)]" />
                          </div>
                          <div className="text-center">
                            <p className="text-[14px] font-semibold text-slate-500">No buddies yet</p>
                            <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
                              Add your first buddy to start messaging.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={openAddWindow}
                            className="ui-focus-ring ui-button-secondary ui-button-compact mt-1"
                          >
                            Add buddy
                          </button>
                        </div>
                      ) : null}

                      {!isBootstrapping && conversationFilter !== 'requests' ? renderSavedMessagesRow() : null}

                      {!isBootstrapping && conversationFilter === 'requests' ? (
                        pendingRequests.length === 0 ? (
                          <div className="ui-empty-state px-6 py-10 ui-fade-in">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(212,150,58,0.16)] bg-[rgba(212,150,58,0.12)]">
                              <AppIcon kind="mail" className="h-8 w-8 text-[var(--gold)]" />
                            </div>
                            <div className="text-center">
                              <p className="text-[14px] font-semibold text-slate-500">No message requests</p>
                              <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
                                New people who message you will show up here first.
                              </p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2 px-2 pb-1">
                            {pendingRequests.map((request) => (
                              <div key={request.senderId} className="ui-list-row">
                                <div className="min-w-0 flex-1">
                                  <p className="ui-screenname truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{request.screenname}</p>
                                  <p className="text-[11px] text-slate-400 dark:text-slate-500">Wants to start a chat</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleAcceptPendingRequest(request.senderId)}
                                    className="ui-focus-ring ui-button-primary ui-button-compact"
                                  >
                                    Accept
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeclinePendingRequest(request.senderId)}
                                    className="ui-focus-ring ui-button-secondary ui-button-compact"
                                  >
                                    Decline
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )
                      ) : null}

                      {!isBootstrapping && conversationFilter !== 'requests' && filteredDirectMessageBuddies.length === 0 && acceptedBuddies.length > 0 ? (
                        <div className="ui-empty-state px-6 py-10 ui-fade-in">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[rgba(167,139,250,0.16)] bg-[rgba(167,139,250,0.12)]">
                            <AppIcon kind="chat" className="h-6 w-6 text-[var(--lavender)]" />
                          </div>
                          <div className="text-center">
                            <p className="text-[14px] font-semibold text-slate-500">No chats in this view</p>
                            <p className="mt-1 text-[12px] leading-relaxed text-slate-400">
                              Try another filter or start a new conversation.
                            </p>
                          </div>
                        </div>
                      ) : null}

                      {!isBootstrapping && conversationFilter !== 'requests' && !showSplitPresenceSections && visibleDirectMessageRows.map((buddy) => renderDirectMessageRow(buddy))}

                      {!isBootstrapping && conversationFilter !== 'requests' && showSplitPresenceSections ? (
                        <div className="space-y-3 px-2 pb-1">
                          {visibleDirectMessageSections.map((section) => (
                            <section key={section.id} className="space-y-2">
                              <div className="ui-section-header" data-tone={section.id}>
                                <span>{section.label}</span>
                                <span className="ui-section-count">{section.buddies.length}</span>
                              </div>
                              {section.buddies.map((buddy) => renderDirectMessageRow(buddy))}
                            </section>
                          ))}
                        </div>
                      ) : null}

                      {pendingBuddies.length > 0 ? (
                        <div className="ui-away-card mx-2 mt-2">
                          <p data-away-label="true" className="text-[10px] font-semibold uppercase tracking-widest">
                            Pending ({pendingBuddies.length})
                          </p>
                          {pendingBuddies.map((buddy) => (
                            <p key={buddy.id} data-away-text="true" className="ui-screenname mt-0.5 truncate text-[12px] italic">
                              {buddy.screenname}
                            </p>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  </section>
                </div>
              ) : null}

              {bodyShellSection === 'chat' ? (
                <div className="ui-page-stack pt-2">
                  <section className="ui-list-panel overflow-hidden">
                    <div className="px-4 pt-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="ui-section-kicker">Rooms</p>
                          <p className="mt-1 text-[16px] font-semibold text-slate-800 dark:text-slate-100">Chat Rooms</p>
                          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
                            Find your people, then join or create the room in one move.
                          </p>
                        </div>
                        <span className="ui-section-count">{activeRooms.length}</span>
                      </div>
                    </div>

                    <div className="px-4 pt-3">
                      <form onSubmit={handleJoinRoom} className="flex gap-2">
                        <input
                          id="room-name-input-inline"
                          value={roomNameDraft}
                          onChange={(event) => setRoomNameDraft(event.target.value)}
                          className={xpModalInputClass}
                          placeholder="cool_kids_club"
                          maxLength={80}
                        />
                        <button
                          type="submit"
                          disabled={isJoiningRoom}
                          className={`${xpModalPrimaryButtonClass} shrink-0`}
                        >
                          {isJoiningRoom ? 'Joining...' : 'Join'}
                        </button>
                      </form>
                      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-500">
                        The room will be created automatically if it does not exist yet.
                      </p>
                      {roomJoinError ? (
                        <p className="mt-2 text-[11px] font-semibold text-red-600">{roomJoinError}</p>
                      ) : null}
                    </div>

                    {roomFilterOptions.length > 1 ? (
                      <div className="px-4 pt-3">
                        <div className="ui-room-filter-row">
                          {roomFilterOptions.map((option) => (
                            <button
                              key={option.key}
                              type="button"
                              onClick={() => setRoomFilterTag(option.key)}
                              className="ui-focus-ring ui-room-filter-chip"
                              data-active={roomFilterTag === option.key ? 'true' : 'false'}
                              data-tone={option.tone}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="px-2 pb-2 pt-3">
                      {activeRooms.length === 0 ? (
                        <div className="ui-empty-state px-4 py-8 ui-fade-in">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-50">
                            <AppIcon kind="chat" className="h-5 w-5 text-violet-400" />
                          </div>
                          <p className="text-[12px] text-slate-400">Join a room to start chatting.</p>
                        </div>
                      ) : filteredRoomCards.length === 0 ? (
                        <div className="ui-empty-state px-4 py-8 ui-fade-in">
                          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[rgba(232,96,138,0.16)] bg-[rgba(232,96,138,0.12)]">
                            <AppIcon kind="chat" className="h-5 w-5 text-[var(--rose)]" />
                          </div>
                          <p className="text-[12px] text-slate-400">No rooms match this vibe right now.</p>
                        </div>
                      ) : (
                        filteredRoomCards.map(({ roomName, meta }) => {
                          const unreadCount = getUnreadCountForRoom(roomName);
                          const isRoomSelected = Boolean(activeRoom && sameRoom(activeRoom.name, roomName));
                          const normalizedRoomKey = normalizeRoomKey(roomName);

                          return (
                            <div key={roomName} className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => void handleOpenActiveRoom(roomName)}
                                data-testid={`room-row-${normalizedRoomKey}`}
                                data-room-name={roomName}
                                data-room-unread={unreadCount}
                                data-active={isRoomSelected ? 'true' : 'false'}
                                data-live={meta.liveCount > 0 ? 'true' : 'false'}
                                className="ui-list-row ui-room-card flex-1 text-left"
                              >
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.9rem] border border-[rgba(212,150,58,0.18)] bg-[rgba(212,150,58,0.14)] text-[13px] font-bold text-[var(--gold)]">
                                  #
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">{roomName}</p>
                                    <span className="ui-room-live-pill">
                                      <span className="ui-room-live-dot" />
                                      {meta.liveCount}
                                    </span>
                                  </div>
                                  <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">{meta.blurb}</p>
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {meta.tags.map((tag) => (
                                      <span key={`${normalizedRoomKey}-${tag.key}`} className="ui-room-tag" data-tone={tag.tone}>
                                        {tag.label}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                {unreadCount > 0 ? (
                                  <span
                                    data-testid={`room-unread-${normalizedRoomKey}`}
                                    aria-label={`Unread in ${roomName}: ${unreadCount}`}
                                    className={`ui-unread-badge flex min-w-[20px] items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                                      isRoomSelected ? '' : 'aim-unread-badge-pulse'
                                    }`}
                                  >
                                    {unreadCount}
                                  </span>
                                ) : null}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleLeaveRoom(roomName)}
                                className="ui-focus-ring ui-button-danger ui-button-compact flex h-8 w-8 shrink-0 p-0"
                                aria-label={`Leave ${roomName}`}
                                title="Leave room"
                              >
                                <AppIcon kind="close" className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </section>
                </div>
              ) : null}
          </div>

            {/* iOS-style tab bar */}
            {nativeShellActive || isConversationOverlayOpen ? null : (
              <div
                className="ui-tabbar shrink-0"
                style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
              >
                <div className="grid h-16 grid-cols-4 items-center">
                  <button
                    type="button"
                    onClick={handleSetupAction}
                    className="ui-focus-ring ui-tabbar-button"
                    data-active={activeTab === 'profile' ? 'true' : 'false'}
                  >
                    <span className="ui-tabbar-icon">
                      <HiItsMeTabIcon kind="profile" className="h-5 w-5 text-current" />
                    </span>
                    <span className="ui-tabbar-label">Profile</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenImFromActionBar}
                    className="ui-focus-ring ui-tabbar-button"
                    data-active={activeTab === 'im' ? 'true' : 'false'}
                  >
                    <span className="ui-tabbar-icon relative">
                      <HiItsMeTabIcon kind="im" className="h-5 w-5 text-current" />
                      {totalUnreadDirectCount > 0 ? (
                        <span className="ui-unread-badge absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold leading-none shadow-sm">
                          {totalUnreadDirectCount > 99 ? '99+' : totalUnreadDirectCount}
                        </span>
                      ) : null}
                    </span>
                    <span className="ui-tabbar-label">IM</span>
                  </button>
                  <button
                    type="button"
                    onClick={openRoomsWindow}
                    className="ui-focus-ring ui-tabbar-button"
                    data-active={activeTab === 'chat' ? 'true' : 'false'}
                  >
                    <span className="ui-tabbar-icon">
                      <HiItsMeTabIcon kind="chat" className="h-5 w-5 text-current" />
                    </span>
                    <span className="ui-tabbar-label">Group Chats</span>
                  </button>
                  <button
                    type="button"
                    onClick={openAddWindow}
                    className="ui-focus-ring ui-tabbar-button"
                    data-active={activeTab === 'buddy' ? 'true' : 'false'}
                  >
                    <span className="ui-tabbar-icon">
                      <HiItsMeTabIcon kind="buddy" className="h-5 w-5 text-current" />
                    </span>
                    <span className="ui-tabbar-label">Buddy</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </RetroWindow>

      {isRecoverySetupOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-[#13100E]/60 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md">
            <div className={xpModalFrameClass}>
              <div className={`${xpModalHeaderClass} mb-2`}>Finish Account Protection</div>
              <form onSubmit={handleSaveRecoveryCode} className={xpModalBodyClass}>
                <div className="ui-note-warning">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold">Choose your private recovery code</p>
                      <p className="mt-1">
                        Keep it somewhere safe. You will need it if you ever forget your password.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleGenerateRecoveryCodeDraft()}
                      disabled={isSavingRecoveryCode}
                      className="ui-focus-ring ui-button-secondary ui-button-compact shrink-0"
                    >
                      Generate
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="recovery-code-input" className="mb-1 block text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                    Recovery code
                  </label>
                  <input
                    ref={recoveryCodeInputRef}
                    id="recovery-code-input"
                    value={recoveryCodeDraft}
                    onChange={(event) => setRecoveryCodeDraft(event.target.value)}
                    className={xpModalInputClass}
                    placeholder="MY-SECRET-CODE-2026"
                    minLength={RECOVERY_CODE_MIN_LENGTH}
                    disabled={isSavingRecoveryCode}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>

                <div>
                  <label
                    htmlFor="recovery-code-confirm-input"
                    className="mb-1 block text-[12px] font-semibold text-slate-700 dark:text-slate-300"
                  >
                    Confirm recovery code
                  </label>
                  <input
                    id="recovery-code-confirm-input"
                    value={recoveryCodeConfirmDraft}
                    onChange={(event) => setRecoveryCodeConfirmDraft(event.target.value)}
                    className={xpModalInputClass}
                    placeholder="Repeat your code"
                    minLength={RECOVERY_CODE_MIN_LENGTH}
                    disabled={isSavingRecoveryCode}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    spellCheck={false}
                  />
                </div>

                {recoverySetupFeedback && (
                  <p className="ui-note-success">{recoverySetupFeedback}</p>
                )}

                {recoverySetupError && (
                  <p className="ui-note-error">{recoverySetupError}</p>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void handleSignOff()}
                    className={xpModalButtonClass}
                  >
                    Sign Off
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingRecoveryCode}
                    className={xpModalPrimaryButtonClass}
                  >
                    {isSavingRecoveryCode ? 'Saving...' : 'Save Recovery Code'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {isAdminResetOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#13100E]/45 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md">
            <div className={xpModalFrameClass}>
              <div className={`${xpModalHeaderClass} mb-2`}>Reset Account Access</div>
              <form onSubmit={handleIssueAdminResetTicket} className={xpModalBodyClass}>
                <div className="ui-note-info">
                  <div className="flex items-start gap-3">
                    <span className="ui-brand-sparkle mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                      <AppIcon kind="shield" className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-bold uppercase tracking-wide">Recovery Concierge</p>
                      <p className="mt-1">
                        Issue a one-time handoff ticket for members who missed recovery setup or need assisted access.
                        Older unused tickets are revoked automatically.
                      </p>
                    </div>
                  </div>
                </div>
                <div>
                  <label htmlFor="admin-reset-screenname" className="mb-1 block text-[12px] font-semibold text-slate-700 dark:text-slate-300">
                    Member screen name
                  </label>
                  <input
                    ref={adminResetInputRef}
                    id="admin-reset-screenname"
                    value={adminResetScreenname}
                    onChange={(event) => setAdminResetScreenname(event.target.value)}
                    className={xpModalInputClass}
                    placeholder="screenname"
                    disabled={isIssuingAdminReset}
                  />
                </div>

                <label className="ui-note-warning flex items-start gap-2">
                  <input
                    type="checkbox"
                    checked={confirmAdminResetAction}
                    onChange={(event) => setConfirmAdminResetAction(event.target.checked)}
                    disabled={isIssuingAdminReset}
                    className="mt-[1px] h-3.5 w-3.5 accent-amber-700"
                  />
                  <span>I verified this request and will deliver the reset handoff through a trusted channel.</span>
                </label>

                {adminResetFeedback && (
                  <p className="ui-note-success">{adminResetFeedback}</p>
                )}

                {adminResetError && (
                  <p className="ui-note-error">{adminResetError}</p>
                )}

                {issuedAdminTicket && (
                  <div className="ui-note-success">
                    <p className="font-bold">Secure reset ready</p>
                    <p className="mt-1">
                      Share this with <span className="font-semibold">{adminResetScreenname.trim() || 'the member'}</span>.
                      They will choose a fresh password and recovery code after redemption.
                    </p>
                    <p className="mt-1 break-all font-mono text-[13px] font-bold">{issuedAdminTicket.ticket}</p>
                    <p className="mt-1 text-[11px]">
                      Expires: {new Date(issuedAdminTicket.expiresAt).toLocaleString()}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCopyAdminResetValue('ticket')}
                        className="ui-focus-ring ui-button-secondary ui-button-compact"
                      >
                        Copy Ticket
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCopyAdminResetValue('handoff')}
                        className="ui-focus-ring ui-button-secondary ui-button-compact"
                      >
                        Copy Secure Handoff
                      </button>
                    </div>
                  </div>
                )}

                <div className="ui-panel-card rounded-2xl px-3 py-3 text-[11px] text-slate-700 dark:text-slate-300">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold">Recent Recovery Activity</p>
                    <button
                      type="button"
                      onClick={() => void fetchAdminAuditEntries()}
                      disabled={isLoadingAdminAudit}
                      className={`${xpModalButtonClass} disabled:opacity-60`}
                    >
                      {isLoadingAdminAudit ? 'Refreshing...' : 'Refresh'}
                    </button>
                  </div>

                  {adminAuditError ? (
                    <p className="ui-note-error mt-2">{adminAuditError}</p>
                  ) : null}

                  {!adminAuditError && !isLoadingAdminAudit && adminAuditEntries.length === 0 ? (
                    <p className="mt-2 italic text-slate-500">No recent events.</p>
                  ) : null}

                  {adminAuditEntries.length > 0 ? (
                    <div className="mt-2 max-h-44 space-y-1.5 overflow-y-auto pr-1">
                      {adminAuditEntries.map((entry) => {
                        const actorLabel = formatAuditUserLabel(entry.actorScreenname, entry.actorUserId);
                        const targetLabel = formatAuditUserLabel(entry.targetScreenname, entry.targetUserId);
                        const reason =
                          typeof entry.metadata.reason === 'string' && entry.metadata.reason.trim()
                            ? entry.metadata.reason
                            : null;

                        return (
                          <div key={entry.id} className="ui-panel-muted rounded-xl px-2.5 py-2">
                            <p className="font-semibold text-slate-700 dark:text-slate-300">{formatAdminAuditEvent(entry.eventType)}</p>
                            <p className="text-[10px] text-slate-500">{new Date(entry.createdAt).toLocaleString()}</p>
                            <p className="mt-0.5">
                              <span className="font-semibold">Actor:</span> {actorLabel}
                            </p>
                            <p>
                              <span className="font-semibold">Target:</span> {targetLabel}
                            </p>
                            {reason ? (
                              <p>
                                <span className="font-semibold">Reason:</span> {reason}
                              </p>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAdminResetOpen(false)}
                    className={xpModalButtonClass}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={isIssuingAdminReset || !confirmAdminResetAction}
                    className={xpModalPrimaryButtonClass}
                  >
                    {isIssuingAdminReset ? 'Issuing...' : 'Issue Ticket'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showAwayModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#13100E]/25 backdrop-blur-[2px]"
          onClick={() => {
            setShowAwayModal(false);
            setShowRename(false);
            setAwayModalError(null);
          }}
        >
          <div
            className="ui-sheet-surface w-full max-w-lg bottom-sheet rounded-t-[2rem]"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="ui-drag-handle" />
            </div>

            {/* Header */}
            <div className="ui-sheet-header">
              <h2 className="ui-sheet-title">{awayModalMode === 'away' ? 'Away Message' : 'Profile'}</h2>
              <button
                type="button"
                onClick={() => {
                  setShowAwayModal(false);
                  setShowRename(false);
                  setAwayModalError(null);
                }}
                className="ui-focus-ring ui-sheet-close"
              >
                <AppIcon kind="close" className="h-3.5 w-3.5" />
              </button>
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void saveProfileSettings({ goAway: true });
              }}
              className="space-y-4 px-5 pb-2"
            >
              <div className="ui-panel-card rounded-2xl px-4 py-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Profile</p>
                <div className="flex items-center gap-3">
                  <label
                    className={`group relative shrink-0 ${isProfileSchemaUnavailable ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'}`}
                    aria-label="Upload profile photo"
                  >
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isProfileSchemaUnavailable}
                      onChange={(event) => {
                        handleSelectBuddyIcon(event.target.files);
                        event.currentTarget.value = '';
                      }}
                    />
                    <ProfileAvatar
                      screenname={screenname}
                      buddyIconPath={removeBuddyIconOnSave ? null : buddyIconPath}
                      imageSrc={removeBuddyIconOnSave ? null : buddyIconPreviewUrl}
                      presenceState={currentUserPresenceState}
                      size="lg"
                    />
                    <span className="absolute inset-x-1 bottom-1 rounded-full bg-[#13100E]/85 px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm transition group-hover:bg-[#13100E]">
                      Edit Photo
                    </span>
                  </label>
                  <div className="min-w-0 flex-1">
                    <p className="ui-screenname truncate text-[14px] font-semibold text-slate-800 dark:text-slate-100">{screenname}</p>
                    <p className="truncate text-[11px] text-slate-500">{profileStatusDraft || AVAILABLE_STATUS}</p>
                    {buddyIconPreviewUrl ? (
                      <p className="mt-1 text-[10px] text-[var(--rose)]">New icon ready to save</p>
                    ) : removeBuddyIconOnSave ? (
                      <p className="mt-1 text-[10px] text-red-500">Icon will be removed on save</p>
                    ) : buddyIconPath ? (
                      <p className="mt-1 text-[10px] text-slate-400">Current icon on profile</p>
                    ) : (
                      <p className="mt-1 text-[10px] text-slate-400">Using initials for now</p>
                    )}
                    <p className="mt-2 text-[10px] text-slate-400">
                      Tap the avatar to upload a profile photo. JPG or PNG up to 2MB.
                    </p>
                  </div>
                </div>

                {buddyIconPreviewUrl ? (
                  <div className="mt-3">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Preview</p>
                    <img
                      src={buddyIconPreviewUrl ?? undefined}
                      alt=""
                      className="h-20 w-20 rounded-2xl border border-white/70 object-cover shadow-sm"
                    />
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  <label className={`ui-focus-ring inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm dark:border-slate-700 dark:bg-[#13100E]/70 dark:text-slate-200 ${isProfileSchemaUnavailable ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-[#13100E]'}`}>
                    Upload Profile Photo
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={isProfileSchemaUnavailable}
                      onChange={(event) => {
                        handleSelectBuddyIcon(event.target.files);
                        event.currentTarget.value = '';
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      if (buddyIconPreviewUrl?.startsWith('blob:')) {
                        URL.revokeObjectURL(buddyIconPreviewUrl);
                      }
                      setBuddyIconPreviewUrl(null);
                      setPendingBuddyIconFile(null);
                      setRemoveBuddyIconOnSave(true);
                    }}
                    disabled={!buddyIconPath && !buddyIconPreviewUrl}
                    className="ui-focus-ring ui-button-danger ui-button-compact disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Remove Photo
                  </button>
                </div>

                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (!userId) {
                        return;
                      }
                      setShowRename(true);
                    }}
                    disabled={!userId}
                    className="ui-focus-ring ui-list-row w-full text-left disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Screenname</p>
                      <p className="mt-1 text-[11px] text-slate-500">Change how buddies see your name.</p>
                    </div>
                    <div className="ml-3 flex min-w-0 items-center gap-2">
                      <span className="ui-screenname max-w-[140px] truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                        {screenname}
                      </span>
                      <AppIcon kind="chevron" className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                  </button>
                </div>

                <div className="mt-3">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Status Line</p>
                  <input
                    value={profileStatusDraft}
                    onChange={(event) => setProfileStatusDraft(event.target.value.slice(0, PROFILE_STATUS_MAX_LENGTH))}
                    className={xpModalInputClass}
                    placeholder="What should buddies see?"
                    maxLength={PROFILE_STATUS_MAX_LENGTH}
                  />
                  <p className="mt-1 text-right text-[10px] text-slate-400">{profileStatusDraft.length}/{PROFILE_STATUS_MAX_LENGTH}</p>
                </div>

                <div className="mt-3">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Bio</p>
                  <textarea
                    value={profileBioDraft}
                    onChange={(event) => setProfileBioDraft(event.target.value.slice(0, PROFILE_BIO_MAX_LENGTH))}
                    className={`${xpModalInputClass} min-h-[84px] resize-none`}
                    placeholder="Add a short AIM-style profile blurb…"
                    maxLength={PROFILE_BIO_MAX_LENGTH}
                  />
                  <p className="mt-1 text-right text-[10px] text-slate-400">{profileBioDraft.length}/{PROFILE_BIO_MAX_LENGTH}</p>
                </div>
              </div>

              {/* Preset chips */}
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Preset</p>
                <div className="flex flex-wrap gap-1.5">
                  {awayPresets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setSelectedAwayPresetId(preset.id);
                        setAwayLabelDraft(preset.label);
                        setAwayText(preset.message);
                      }}
                      className={`ui-focus-ring rounded-full border px-3 py-1 text-[11px] font-semibold transition active:scale-95 ${
                        selectedAwayPresetId === preset.id
                          ? 'border-rose-400/70 bg-[linear-gradient(180deg,#E8608A_0%,#B93A67_100%)] text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#13100E]/70 dark:text-slate-200 dark:hover:bg-[#13100E]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => { setSelectedAwayPresetId('__custom__'); setAwayText(''); setAwayLabelDraft(''); }}
                    className={`ui-focus-ring rounded-full border px-3 py-1 text-[11px] font-semibold transition active:scale-95 ${
                      selectedAwayPresetId === '__custom__'
                        ? 'border-rose-400/70 bg-[linear-gradient(180deg,#E8608A_0%,#B93A67_100%)] text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#13100E]/70 dark:text-slate-200 dark:hover:bg-[#13100E]'
                    }`}
                  >
                    Custom…
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">Mood</p>
                  <span className="text-[10px] italic text-slate-500">{activeAwayMood.hint}</span>
                </div>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {AWAY_MOOD_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setAwayMoodId(option.id)}
                      className="ui-focus-ring ui-mood-button"
                      data-active={awayMoodId === option.id ? 'true' : 'false'}
                      data-tone={option.tone}
                    >
                      <span className="ui-mood-symbol" aria-hidden="true">{option.symbol}</span>
                      <span className="ui-mood-label">{option.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Message textarea */}
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Message</p>
                <textarea
                  id="away-message-input"
                  ref={awayMessageFieldRef}
                  value={awayText}
                  onChange={(event) => setAwayText(event.target.value)}
                  className={`${xpModalInputClass} min-h-[90px] resize-none`}
                  placeholder="what's going on with you right now…"
                  maxLength={320}
                />
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="text-[10px] italic text-slate-500">Use %n for names, %t for time, %d for date.</p>
                  <p className="text-right text-[10px] text-slate-400">{awayText.length}/320</p>
                </div>
              </div>

              {/* Live preview */}
              <div className="ui-away-preview-card rounded-2xl px-3.5 py-3" data-mood={awayMoodId}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Preview</p>
                  <span className="ui-away-mood-pill" data-tone={activeAwayMood.tone}>
                    {activeAwayMood.label}
                  </span>
                </div>
                <p className="mt-1 break-words text-[13px] text-[#ffc4d8]">{awayPreview}</p>
              </div>

              {/* Auto-away settings */}
              <div className="ui-panel-muted space-y-3 rounded-2xl px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">Show Idle when inactive</p>
                    <p className="text-[11px] text-slate-400">Mark yourself idle after inactivity</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAutoAwayEnabled((p) => !p)}
                    className={`ios-toggle ${isAutoAwayEnabled ? 'on' : ''}`}
                    role="switch"
                    aria-checked={isAutoAwayEnabled}
                  />
                </div>
                {isAutoAwayEnabled ? (
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] text-slate-600">Idle timeout</p>
                    <select
                      value={autoAwayMinutes}
                      onChange={(event) => setAutoAwayMinutes(Number(event.target.value))}
                      className={`${xpModalSelectClass} w-auto py-1 pl-3 pr-8 text-[12px]`}
                    >
                      {AUTO_AWAY_MINUTE_OPTIONS.map((minutes) => (
                        <option key={minutes} value={minutes}>{minutes} min</option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">Clear idle on activity</p>
                    <p className="text-[11px] text-slate-400">Move back to active when you interact</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoReturnOnActivity((p) => !p)}
                    disabled={!isAutoAwayEnabled}
                    className={`ios-toggle ${autoReturnOnActivity && isAutoAwayEnabled ? 'on' : ''} disabled:opacity-50`}
                    role="switch"
                    aria-checked={autoReturnOnActivity}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">Save as preset</p>
                  <button
                    type="button"
                    onClick={() => setSaveAwayPreset((p) => !p)}
                    className={`ios-toggle ${saveAwayPreset ? 'on' : ''}`}
                    role="switch"
                    aria-checked={saveAwayPreset}
                  />
                </div>
              </div>

              {isProfileSchemaUnavailable ? (
                <p className="ui-note-warning font-semibold">
                  {PROFILE_SCHEMA_NOTICE}
                </p>
              ) : null}

              {awayModalError ? (
                <p className="ui-note-error font-semibold">
                  {awayModalError}
                </p>
              ) : null}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void saveProfileSettings({ goAway: false })}
                  disabled={isSavingAwayMessage}
                  className="ui-focus-ring ui-button-secondary flex-1 disabled:opacity-60"
                >
                  {isSavingAwayMessage ? 'Saving…' : 'Save Profile'}
                </button>
                <button
                  type="submit"
                  disabled={isSavingAwayMessage}
                  className="ui-focus-ring ui-button-primary flex-1 disabled:opacity-60"
                >
                  {isSavingAwayMessage ? 'Saving…' : 'Go Away'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showRename && userId ? (
        <RenameScreenname
          currentUsername={screenname}
          userId={userId}
          onSuccess={(newUsername) => {
            setScreenname(newUsername);
          }}
          onClose={() => setShowRename(false)}
        />
      ) : null}

      {showSystemStatusSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#13100E]/25 backdrop-blur-[2px]"
          onClick={() => setShowSystemStatusSheet(false)}
        >
          <div
            className="ui-sheet-surface w-full max-w-lg bottom-sheet rounded-t-[2rem]"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-center pb-1 pt-3">
              <div className="ui-drag-handle" />
            </div>
            <div className="ui-sheet-header">
              <h2 className="ui-sheet-title">System Status</h2>
              <button
                type="button"
                onClick={() => setShowSystemStatusSheet(false)}
                className="ui-focus-ring ui-sheet-close"
              >
                <AppIcon kind="close" className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-3 px-5 pb-2">
              <div className="ui-panel-card rounded-2xl px-3.5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Sync</p>
                <p className="mt-1 text-[14px] font-semibold text-slate-800 dark:text-slate-100">{chatSyncSummary}</p>
                <p className="mt-1 text-[12px] text-slate-500">
                  {lastSyncedAt
                    ? `Last synced ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'No successful sync yet in this session.'}
                </p>
                {lastSyncError ? (
                  <p className="ui-note-error mt-2">{lastSyncError}</p>
                ) : null}
              </div>

              <div className="ui-panel-card rounded-2xl px-3.5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Outbox</p>
                <p className="mt-1 text-[14px] font-semibold text-slate-800 dark:text-slate-100">{outboxSummary}</p>
                {latestOutboxError ? (
                  <p className="ui-note-warning mt-2">{latestOutboxError}</p>
                ) : null}
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowSystemStatusSheet(false)}
                  className={xpModalButtonClass}
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => void syncFromServer()}
                  disabled={isChatSyncBusy}
                  className={xpModalPrimaryButtonClass}
                >
                  {isChatSyncBusy ? 'Syncing…' : 'Sync Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPrivacySheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[#13100E]/25 backdrop-blur-[2px]"
          onClick={() => setShowPrivacySheet(false)}
        >
          <div
            className="ui-sheet-surface w-full max-w-lg bottom-sheet rounded-t-[2rem]"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-center pb-1 pt-3">
              <div className="ui-drag-handle" />
            </div>
            <div className="ui-sheet-header">
              <h2 className="ui-sheet-title">Privacy</h2>
              <button
                type="button"
                onClick={() => setShowPrivacySheet(false)}
                className="ui-focus-ring ui-sheet-close"
              >
                <AppIcon kind="close" className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-3 px-5 pb-2">
              {trustSafetyError ? (
                <p className="ui-note-error text-[12px] font-semibold">{trustSafetyError}</p>
              ) : null}
              <div className="ui-panel-card rounded-2xl px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">Share read receipts</p>
                    <p className="text-[11px] text-slate-400">Let buddies know when you have read their messages.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void updatePrivacyPreferences((current) => ({
                      shareReadReceipts: !current.shareReadReceipts,
                    }))}
                    className={`ios-toggle ${privacySettings.shareReadReceipts ? 'on' : ''}`}
                    role="switch"
                    aria-checked={privacySettings.shareReadReceipts}
                  />
                </div>
              </div>

              <div className="ui-panel-card rounded-2xl px-4 py-4">
                <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">Notification previews</p>
                <p className="mt-1 text-[11px] text-slate-400">Choose how much message detail appears in banners.</p>
                <select
                  value={privacySettings.notificationPreviewMode}
                  onChange={(event) =>
                    void updatePrivacyPreferences({
                      notificationPreviewMode: event.target.value as UserPrivacySettings['notificationPreviewMode'],
                    })}
                  className={`${xpModalSelectClass} mt-3 w-full py-2 pl-3 pr-8 text-[12px]`}
                >
                  <option value="full">Show sender and message</option>
                  <option value="name_only">Show sender only</option>
                  <option value="hidden">Hide message details</option>
                </select>
              </div>

              <div className="ui-panel-card rounded-2xl px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">Screen shield</p>
                    <p className="text-[11px] text-slate-400">Obscure the app when it moves to the background.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void updatePrivacyPreferences((current) => ({
                      screenShieldEnabled: !current.screenShieldEnabled,
                    }))}
                    className={`ios-toggle ${privacySettings.screenShieldEnabled ? 'on' : ''}`}
                    role="switch"
                    aria-checked={privacySettings.screenShieldEnabled}
                  />
                </div>
              </div>

              <div className="ui-panel-card rounded-2xl px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">App lock</p>
                    <p className="text-[11px] text-slate-400">
                      Device-only PIN lock that appears when H.I.M. returns from the background.
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {appLockSettings.enabled
                        ? `Auto-locks ${formatAppLockTimeoutLabel(appLockSettings.autoLockSeconds).toLowerCase()}.`
                        : 'Currently off on this device.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (appLockSettings.enabled) {
                        handleDisableAppLock();
                        return;
                      }
                      openAppLockSetup();
                    }}
                    className={`ios-toggle ${appLockSettings.enabled ? 'on' : ''}`}
                    role="switch"
                    aria-checked={appLockSettings.enabled}
                  />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {appLockSettings.enabled ? (
                    <button
                      type="button"
                      onClick={handleLockAppNow}
                      className="ui-focus-ring ui-button-secondary ui-button-compact"
                    >
                      Lock now
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={openAppLockSetup}
                      className="ui-focus-ring ui-button-secondary ui-button-compact"
                    >
                      Set PIN
                    </button>
                  )}
                </div>
                {appLockSettings.enabled ? (
                  <div className="mt-3 space-y-3">
                    {biometricAvailability.isAvailable ? (
                      <div className="flex items-center justify-between gap-3 rounded-[1rem] border border-white/70 bg-white/75 px-3 py-3 dark:border-slate-800 dark:bg-[#13100E]/55">
                        <div>
                          <p className="text-[12px] font-semibold text-slate-700 dark:text-slate-100">
                            Use {biometricAvailability.label}
                          </p>
                          <p className="mt-0.5 text-[10px] text-slate-400">Try biometrics first, then fall back to your app PIN.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setAppLockSettings((current) => ({
                              ...current,
                              biometricsEnabled: !current.biometricsEnabled,
                            }))
                          }
                          className={`ios-toggle ${appLockSettings.biometricsEnabled ? 'on' : ''}`}
                          role="switch"
                          aria-checked={appLockSettings.biometricsEnabled}
                          aria-label={`Use ${biometricAvailability.label} for app unlock`}
                        />
                      </div>
                    ) : null}
                    <div>
                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                        Auto-lock timing
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {[0, 30, 60, 300].map((value) => {
                          const selected = appLockSettings.autoLockSeconds === value;
                          return (
                            <button
                              key={value}
                              type="button"
                              onClick={() =>
                                setAppLockSettings((current) => ({
                                  ...current,
                                  autoLockSeconds: value,
                                }))
                              }
                              className={`ui-focus-ring rounded-full border px-3 py-2 text-[11px] font-semibold transition ${
                                selected
                                  ? 'border-rose-500/70 bg-[linear-gradient(180deg,#E8608A_0%,#B93A67_100%)] text-white shadow-[0_12px_30px_rgba(232,96,138,0.24)]'
                                  : 'border-white/75 bg-white/78 text-slate-600 dark:border-slate-800 dark:bg-[#13100E]/45 dark:text-slate-300'
                              }`}
                            >
                              {formatAppLockTimeoutLabel(value)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="ui-panel-card rounded-2xl px-4 py-4">
                <p className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">Blocked buddies</p>
                <p className="mt-1 text-[11px] text-slate-400">Blocked contacts cannot send new messages or requests.</p>
                {blockedUserIds.length === 0 ? (
                  <p className="mt-3 text-[11px] text-slate-400">No one is blocked right now.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {blockedUserIds.map((blockedUserId) => {
                      const blockedProfile = blockedProfiles.find((profile) => profile.id === blockedUserId);
                      return (
                        <div
                          key={blockedUserId}
                          className="flex items-center justify-between gap-3 rounded-[1rem] border border-white/70 bg-white/75 px-3 py-2 dark:border-slate-800 dark:bg-[#13100E]/55"
                        >
                          <div className="min-w-0">
                            <p className="ui-screenname truncate text-[12px] font-semibold text-slate-700 dark:text-slate-100">
                              {blockedProfile?.screenname?.trim() || 'Blocked buddy'}
                            </p>
                            <p className="truncate text-[10px] text-slate-400">{blockedUserId}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleUnblockBuddyById(blockedUserId)}
                            disabled={isBlockingBuddyId === blockedUserId}
                            className="ui-focus-ring ui-button-secondary ui-button-compact disabled:opacity-60"
                          >
                            {isBlockingBuddyId === blockedUserId ? '...' : 'Unblock'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <AppLockSheet
        key={`${appLockMode}-${showAppLockSheet ? 'open' : 'closed'}`}
        isOpen={showAppLockSheet}
        mode={appLockMode}
        pinDraft={appLockPinDraft}
        confirmDraft={appLockConfirmDraft}
        errorMessage={appLockError}
        autoLockSeconds={appLockSettings.autoLockSeconds}
        biometricLabel={biometricAvailability.label}
        isBiometricAvailable={biometricAvailability.isAvailable && appLockSettings.biometricsEnabled}
        isBiometricAuthenticating={isBiometricAuthenticating}
        onPinChange={setAppLockPinDraft}
        onConfirmChange={setAppLockConfirmDraft}
        onAutoLockSecondsChange={(value) =>
          setAppLockSettings((current) => ({
            ...current,
            autoLockSeconds: value,
          }))
        }
        onUseBiometrics={() => void handleUseBiometrics()}
        onSubmit={() => void handleSubmitAppLock()}
        onCancel={() => {
          if (appLockMode === 'unlock') {
            return;
          }
          setShowAppLockSheet(false);
          setAppLockError(null);
          setAppLockPinDraft('');
          setAppLockConfirmDraft('');
          setIsBiometricAuthenticating(false);
          attemptedBiometricUnlockRef.current = false;
        }}
      />

      {isAppLocked ? (
        <div className="pointer-events-auto fixed inset-0 z-[65] bg-[#13100E]/18 backdrop-blur-[10px]" aria-hidden="true" />
      ) : null}

      {showRoomsWindow && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#13100E]/45 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-sm">
            <div className={xpModalFrameClass}>
              <div className={`${xpModalHeaderClass} mb-2`}>Join a Room</div>
              <form onSubmit={handleJoinRoom} className="flex flex-col gap-3 px-2 pb-2 text-[11px]">
                <label htmlFor="room-name-input" className="font-semibold text-slate-700 dark:text-slate-300">
                  Room name
                </label>
                <input
                  id="room-name-input"
                  value={roomNameDraft}
                  onChange={(event) => setRoomNameDraft(event.target.value)}
                  className={xpModalInputClass}
                  placeholder="cool_kids_club"
                  maxLength={80}
                />
                <p className="text-[12px] text-slate-500">If the room does not exist yet, H.I.M. will create it.</p>
                {roomJoinError && (
                  <p className="ui-note-error">{roomJoinError}</p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRoomsWindow(false)}
                    className={xpModalButtonClass}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isJoiningRoom}
                    className={xpModalPrimaryButtonClass}
                  >
                    {isJoiningRoom ? 'Joining...' : 'Join'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {activePendingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#13100E]/50 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-sm">
            <div className={xpModalFrameClass}>
              <div className={`${xpModalHeaderClass} mb-2`}>New Message Request</div>
              <div className="flex flex-col gap-3 px-2 pb-2 text-[11px] text-slate-700 dark:text-slate-300">
                <p>
                  <span className="ui-screenname font-bold text-[var(--rose)]">{activePendingRequest.screenname}</span> wants to message
                  you, but they are not in your H.I.M. contacts yet.
                </p>
                {pendingRequestError && (
                  <p className="ui-note-error">{pendingRequestError}</p>
                )}
                <div className="flex flex-wrap justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => void handleBlockBuddyById(activePendingRequest.senderId)}
                    className="ui-focus-ring ui-button-danger ui-button-compact"
                  >
                    Block
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAcceptPendingRequest(activePendingRequest.senderId)}
                    className={xpModalPrimaryButtonClass}
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeclinePendingRequest(activePendingRequest.senderId)}
                    className={xpModalButtonClass}
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    disabled={isProcessingRequestId === activePendingRequest.senderId}
                    onClick={() => void handleAddBuddyFromPendingRequest(activePendingRequest.senderId)}
                    className={xpModalPrimaryButtonClass}
                  >
                    {isProcessingRequestId === activePendingRequest.senderId ? 'Adding...' : 'Add Buddy'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAddWindow && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#13100E]/45 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md">
            <div className={xpModalFrameClass}>
              <div className={`${xpModalHeaderClass} mb-2`}>Add Buddy</div>
              <div className="flex flex-col gap-3 px-2 pb-2 text-[11px]">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className={xpModalInputClass}
                    placeholder="Search screen names..."
                  />
                  <button
                    type="submit"
                    className={xpModalPrimaryButtonClass}
                  >
                    Search
                  </button>
                </form>

                {searchError && <p className="ui-note-error">{searchError}</p>}

                <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white/80 p-2 shadow-[inset_0_1px_1px_rgba(15,23,42,0.05)] dark:border-slate-700 dark:bg-[#13100E]/50">
                  {isSearching && (
                    <p className="p-2 text-sm italic text-slate-500">Searching screen names...</p>
                  )}
                  {!isSearching && searchTerm.trim() !== '' && searchResults.length === 0 && (
                    <p className="p-2 text-sm italic text-slate-500">No screen names found.</p>
                  )}
                  {!isSearching &&
                    searchResults.map((profile) => {
                      const resolvedProfileStatus = resolveStatusFields({
                        status: profile.status,
                        awayMessage: profile.away_message,
                        statusMessage: profile.status_msg,
                      });
                      const isProfileAway = normalizeStatusLabel(resolvedProfileStatus.status) === AWAY_STATUS;

                      return (
                        <div
                          key={profile.id}
                          className="ui-panel-muted mb-2 flex items-center justify-between gap-2 rounded-2xl p-3"
                        >
                          <div className="min-w-0">
                            <p className="ui-screenname truncate font-bold">{profile.screenname || 'Unknown User'}</p>
                            <p className="truncate text-[11px] italic text-slate-500">
                              {isProfileAway
                                ? `Away: ${resolvedProfileStatus.awayMessage || 'Away'}`
                                : resolvedProfileStatus.statusMessage}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddBuddy(profile)}
                            disabled={isAddingBuddyId === profile.id}
                            className={xpModalPrimaryButtonClass}
                          >
                            {isAddingBuddyId === profile.id ? 'Adding...' : 'Add'}
                          </button>
                        </div>
                      );
                    })}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAddWindow(false)}
                    className={xpModalButtonClass}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {forwardingMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#13100E]/45 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md">
            <div className={xpModalFrameClass}>
              <div className={`${xpModalHeaderClass} mb-2`}>Forward Message</div>
              <div className="flex flex-col gap-3 px-2 pb-2 text-[11px]">
                <div className="ui-panel-muted rounded-2xl px-3 py-3">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Preview</p>
                  <p className="mt-1 text-[12px] text-slate-700 dark:text-slate-300">
                    {htmlToPlainText(forwardingMessage.content).trim() || 'Forwarded message'}
                  </p>
                </div>

                {forwardError ? <p className="ui-note-error">{forwardError}</p> : null}

                <button
                  type="button"
                  onClick={() => void handleForwardMessageToTarget(forwardingMessage, 'saved')}
                  disabled={isForwardingToId === 'saved'}
                  className="ui-focus-ring ui-panel-muted flex items-center justify-between rounded-2xl px-3 py-3 text-left"
                >
                  <span>
                    <span className="block font-semibold text-slate-800 dark:text-slate-100">Saved Messages</span>
                    <span className="block text-[11px] text-slate-400">Keep a copy for yourself</span>
                  </span>
                  <span className="ui-button-secondary ui-button-compact">{isForwardingToId === 'saved' ? '…' : 'Save'}</span>
                </button>

                <div className="max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white/80 p-2 shadow-[inset_0_1px_1px_rgba(15,23,42,0.05)] dark:border-slate-700 dark:bg-[#13100E]/50">
                  {sortedDirectMessageBuddies.map((buddy) => (
                    <button
                      key={buddy.id}
                      type="button"
                      onClick={() => void handleForwardMessageToTarget(forwardingMessage, buddy.id)}
                      disabled={isForwardingToId === buddy.id}
                      className="ui-focus-ring ui-panel-muted mb-2 flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left last:mb-0"
                    >
                      <span className="min-w-0">
                        <span className="ui-screenname block truncate font-semibold text-slate-800 dark:text-slate-100">{buddy.screenname}</span>
                        <span className="block truncate text-[11px] text-slate-400">Forward as a new message</span>
                      </span>
                      <span className="ui-button-secondary ui-button-compact">{isForwardingToId === buddy.id ? '…' : 'Send'}</span>
                    </button>
                  ))}
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setForwardError(null);
                      setForwardingMessage(null);
                    }}
                    className={xpModalButtonClass}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showSavedMessagesWindow ? (
        <SavedMessagesWindow
          entries={savedMessages}
          draft={savedMessageDraft}
          errorMessage={savedMessageError}
          isSaving={isSavingSavedMessage}
          deletingEntryId={deletingSavedMessageId}
          onDraftChange={setSavedMessageDraft}
          onSave={handleSaveSavedMessageDraft}
          onDeleteEntry={handleDeleteSavedMessage}
          onClose={() => setShowSavedMessagesWindow(false)}
        />
      ) : null}

      <BuddyProfileSheet
        key={selectedProfileSummary?.id ?? 'profile-sheet'}
        buddy={selectedProfileSummary}
        isOpen={Boolean(selectedProfileSummary)}
        currentUserId={userId ?? undefined}
        isUpdating={isAddingBuddyId === selectedProfileSummary?.id || isRemovingBuddyId === selectedProfileSummary?.id}
        errorMessage={profileSheetError}
        feedbackMessage={profileSheetFeedback}
        isBlocked={selectedProfileSummary ? blockedUserIds.includes(selectedProfileSummary.id) : false}
        isBlocking={isBlockingBuddyId === selectedProfileSummary?.id}
        isReporting={isReportingBuddyId === selectedProfileSummary?.id}
        onClose={closeBuddyProfile}
        onStartChat={() => {
          if (!selectedProfileSummary) {
            return;
          }
          closeBuddyProfile();
          handleOpenChat(selectedProfileSummary.id);
        }}
        onAddBuddy={
          selectedProfileSummary
            ? async () => {
                const added = await handleAddBuddyById(selectedProfileSummary.id);
                if (added) {
                  closeBuddyProfile();
                }
              }
            : undefined
        }
        onRemoveBuddy={
          selectedProfileSummary
            ? async () => {
                await handleRemoveBuddy(selectedProfileSummary.id);
              }
            : undefined
        }
        onBlockBuddy={
          selectedProfileSummary
            ? async () => {
                await handleBlockBuddyById(selectedProfileSummary.id);
              }
            : undefined
        }
        onUnblockBuddy={
          selectedProfileSummary
            ? async () => {
                await handleUnblockBuddyById(selectedProfileSummary.id);
              }
            : undefined
        }
        onSubmitReport={
          selectedProfileSummary
            ? async (payload) => {
                await handleReportBuddy(selectedProfileSummary.id, payload);
              }
            : undefined
        }
      />

      {buddyActivityToasts.length > 0 ? (
        <div
          aria-live="polite"
          className={`pointer-events-none fixed right-3 z-40 flex w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2 ${
            nativeShellActive ? 'top-3' : 'top-[calc(env(safe-area-inset-top)+4.25rem)]'
          }`}
        >
          {buddyActivityToasts.map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl border px-3 py-2 text-[12px] shadow-[0_16px_34px_rgba(0,0,0,0.32)] backdrop-blur-xl ${
                item.tone === 'offline'
                  ? 'border-[rgba(156,142,130,0.22)] bg-[rgba(29,25,22,0.94)] text-[var(--muted)]'
                  : item.tone === 'away'
                    ? 'border-[rgba(212,150,58,0.24)] bg-[rgba(44,31,15,0.92)] text-[var(--gold)]'
                    : item.tone === 'back'
                      ? 'border-[rgba(167,139,250,0.26)] bg-[rgba(42,31,58,0.92)] text-[var(--lavender)]'
                      : 'border-[rgba(78,201,122,0.24)] bg-[rgba(17,37,27,0.92)] text-[var(--green)]'
              }`}
            >
              {item.message}
            </div>
          ))}
        </div>
      ) : null}

      {activeChatBuddy && userId && (
        <>
          <ChatWindow
            key={activeChatBuddy.id}
            buddyScreenname={activeChatBuddy.screenname}
            buddyStatusMessage={
              activeChatBuddyPresenceSummary?.presenceState === 'away'
                ? activeChatBuddyPresenceSummary.awayLine
                : null
            }
            buddyPresenceState={activeChatBuddyPresenceSummary?.presenceState ?? 'available'}
            buddyPresenceDetail={activeChatBuddyPresenceSummary?.presenceLabel ?? 'Available'}
            buddyStatusLine={activeChatBuddyPresenceSummary?.resolvedStatus.statusMessage ?? null}
            buddyBio={activeChatBuddy.profile_bio}
            buddyIconPath={activeChatBuddy.buddy_icon_path}
            currentUserId={userId}
            messages={chatMessages}
            outboxItems={activeDirectOutboxItems}
            initialUnreadCount={initialUnreadForActiveChat}
            initialDraft={draftCache.dm[activeChatBuddy.id] ?? ''}
            typingText={activeDmTypingText}
            isPinned={activeChatPreference?.isPinned ?? false}
            isMuted={activeChatPreference?.isMuted ?? false}
            isArchived={activeChatPreference?.isArchived ?? false}
            disappearingTimerSeconds={activeChatPreference?.disappearingTimerSeconds ?? null}
            onSendMessage={handleSendMessage}
            onTypingActivity={sendDmTypingPulse}
            onRetryOutboxMessage={handleRetryConversationOutboxMessage}
            onDraftChange={(draft) => updateDmDraft(activeChatBuddy.id, draft)}
            onTogglePinned={handleTogglePinnedForActiveChat}
            onToggleMuted={handleToggleMutedForActiveChat}
            onToggleArchived={handleToggleArchivedForActiveChat}
            onSetDisappearingTimer={handleSetDisappearingTimerForActiveChat}
            onForwardMessage={handleBeginForwardMessage}
            onSaveMessage={handleSaveDirectMessage}
            onClose={closeChatWindow}
            onSignOff={handleSignOff}
            onOpenProfile={() => openBuddyProfile(activeChatBuddy.id)}
            isLoading={isChatLoading}
            isSending={isSendingMessage}
            themeKey={activeChatPreference?.themeKey ?? null}
            wallpaperKey={activeChatPreference?.wallpaperKey ?? null}
            onChangeTheme={handleChangeThemeForActiveChat}
            onChangeWallpaper={handleChangeWallpaperForActiveChat}
            showReadReceipts={privacySettings.shareReadReceipts}
          />
          {chatError && (
            <p className="fixed bottom-3 left-3 right-3 z-50 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
              {chatError}
            </p>
          )}
        </>
      )}

      {activeRoom && userId && (
        <GroupChatWindow
          key={activeRoom.id}
          roomId={activeRoom.id}
          roomName={activeRoom.name}
          currentUserId={userId}
          currentUserScreenname={screenname}
          currentUserBuddyIconPath={buddyIconPath}
          initialUnreadCount={initialUnreadForActiveRoom}
          initialDraft={draftCache.rooms[normalizeRoomKey(activeRoom.name)] ?? ''}
          outboxItems={activeRoomOutboxItems}
          reloadToken={activeRoomReloadToken}
          onDraftChange={(draft) => updateRoomDraft(activeRoom.name, draft)}
          onRetryOutboxMessage={handleRetryConversationOutboxMessage}
          onQueueRoomMessage={handleQueueRoomMessage}
          inviteCode={activeRoom.invite_code ?? null}
          onBack={handleBackFromRoom}
          onLeave={handleLeaveCurrentRoom}
          onSignOff={handleSignOff}
        />
      )}
    </main>
  );
}

export default function HiItsMe() {
  return (
    <Suspense fallback={<main className="h-[100dvh] overflow-hidden bg-[#f8f9fa]" />}>
      <HiItsMeContent />
    </Suspense>
  );
}
