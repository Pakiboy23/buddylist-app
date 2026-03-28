'use client';

import Image from 'next/image';
import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AppIcon from '@/components/AppIcon';
import BuddyListTabIcon from '@/components/BuddyListTabIcon';
import ChatWindow, { ChatMessage } from '@/components/ChatWindow';
import GroupChatWindow from '@/components/GroupChatWindow';
import BuddyProfileSheet from '@/components/BuddyProfileSheet';
import ProfileAvatar from '@/components/ProfileAvatar';
import { getAccessTokenOrNull, waitForSessionOrNull } from '@/lib/authClient';
import { getAppApiUrl } from '@/lib/appApi';
import { navigateAppPath, replaceAppPathInPlace } from '@/lib/appNavigation';
import { deleteBuddyIconFile, uploadBuddyIconFile, validateBuddyIconFile } from '@/lib/buddyIcon';
import {
  getRaw,
  getVersionedData,
  removeValue,
  setVersionedData,
  subscribeToStorageKey,
} from '@/lib/clientStorage';
import { uploadChatMediaFile } from '@/lib/chatMedia';
import {
  createClientMessageId,
  createOutboxItem,
  getOutboxStorageKey,
  isOutboxItemDue,
  loadOutbox,
  markOutboxAttemptFailure,
  normalizeOutboxItems,
  type OutboxItem,
  saveOutbox,
} from '@/lib/outbox';
import {
  DIRECT_MESSAGE_SELECT_FIELDS,
  sendDirectMessageWithClientMessageId,
  sendRoomMessageWithClientMessageId,
} from '@/lib/messageIdempotency';
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
import { initSoundSystem, playFallbackTone, playUiSound } from '@/lib/sound';
import { supabase } from '@/lib/supabase';
import { normalizeRoomKey, sameRoom } from '@/lib/roomName';
import {
  formatPresenceSince,
  getPresenceDetail,
  getPresenceLabel,
  resolvePresenceState,
} from '@/lib/presence';
import {
  applyDmStateEvent,
  mapRowsToUnreadDirectMessages,
  type DmStateEventType,
  type UserDmStateRowLite,
} from '@/lib/unread-dm';
import RetroWindow from '@/components/RetroWindow';
import { useChatContext } from '@/context/ChatContext';

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

interface BuddyRelationshipRow {
  buddy_id: string;
  status: 'pending' | 'accepted';
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
const BUDDY_LIST_PATH = '/buddy-list';
const AVAILABLE_STATUS = 'Available';
const AWAY_STATUS = 'Away';
const KNOWN_STATUSES = ['Available', 'Away', 'Invisible', 'Busy', 'Be Right Back'] as const;
const UI_CACHE_KEY_PREFIX = 'buddylist:ui:v1:';
const UI_CACHE_VERSION = 1;
const UI_CACHE_MAX_BYTES = 96 * 1024;
const UI_MAX_CUSTOM_PRESETS = 24;
const UI_MAX_COOLDOWN_ENTRIES = 220;
const UI_MAX_DRAFT_ITEMS = 48;
const UI_MAX_DRAFT_LENGTH = 1600;
const UI_COOLDOWN_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const AWAY_PRESETS_STORAGE_KEY = 'buddylist:away-presets';
const AWAY_SETTINGS_STORAGE_KEY = 'buddylist:away-settings';
const AWAY_COOLDOWN_STORAGE_KEY = 'buddylist:away-cooldowns';
const BUDDY_SORT_STORAGE_KEY = 'buddylist:buddy-sort';
const AWAY_AUTO_REPLY_PREFIX = '[Auto-Reply]';
const AWAY_AUTO_REPLY_COOLDOWN_MS = 10 * 60 * 1000;
const TYPING_THROTTLE_MS = 1200;
const TYPING_TTL_MS = 3500;
const AUTO_AWAY_MINUTE_OPTIONS = [5, 10, 15, 30] as const;
const PROFILE_STATUS_MAX_LENGTH = 80;
const PROFILE_BIO_MAX_LENGTH = 240;
const PROFILE_ACTIVITY_TTL_MS = 4200;
const PROFILE_ACTIVITY_DEDUPE_MS = 4000;
const LAST_ACTIVE_WRITE_INTERVAL_MS = 60 * 1000;
const DEFAULT_AWAY_PRESETS: AwayPreset[] = [
  { id: 'simple-plan', label: 'Simple Plan', message: "Hey %n, I'm away right now. Back at %t.", builtIn: true },
  { id: 'brb', label: 'BRB', message: 'Be right back. Current time: %t.', builtIn: true },
  { id: 'lunch', label: 'Lunch', message: 'Out for lunch (%d %t). Leave me a message.', builtIn: true },
  { id: 'afk', label: 'AFK', message: "AFK for a bit. I'll get back to you soon.", builtIn: true },
];

interface UiDraftState {
  dm: Record<string, string>;
  rooms: Record<string, string>;
}

interface UiCachePayloadV1 {
  buddySortMode: BuddySortMode;
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

function BuddyListContent() {
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
  const [awayPresets, setAwayPresets] = useState<AwayPreset[]>(DEFAULT_AWAY_PRESETS);
  const [selectedAwayPresetId, setSelectedAwayPresetId] = useState<string>(DEFAULT_AWAY_PRESETS[0].id);
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
  const [isBuddiesOpen, setIsBuddiesOpen] = useState(true);
  const [isOfflineOpen, setIsOfflineOpen] = useState(true);
  const [isActiveChatsOpen, setIsActiveChatsOpen] = useState(true);
  const [buddySortMode, setBuddySortMode] = useState<BuddySortMode>('online_then_alpha');
  const [buddyLastMessageAt, setBuddyLastMessageAt] = useState<Record<string, string>>({});
  const [isUiCacheHydrated, setIsUiCacheHydrated] = useState(false);
  const [awayReplyCooldowns, setAwayReplyCooldowns] = useState<Record<string, number>>({});
  const [draftCache, setDraftCache] = useState<UiDraftState>({ dm: {}, rooms: {} });

  const [isRecoverySetupOpen, setIsRecoverySetupOpen] = useState(false);
  const [recoveryCodeDraft, setRecoveryCodeDraft] = useState('');
  const [recoveryCodeConfirmDraft, setRecoveryCodeConfirmDraft] = useState('');
  const [recoverySetupError, setRecoverySetupError] = useState<string | null>(null);
  const [isSavingRecoveryCode, setIsSavingRecoveryCode] = useState(false);

  const [showAddWindow, setShowAddWindow] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAddingBuddyId, setIsAddingBuddyId] = useState<string | null>(null);
  const [isRemovingBuddyId, setIsRemovingBuddyId] = useState<string | null>(null);
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
  const [profileSheetBuddyId, setProfileSheetBuddyId] = useState<string | null>(null);
  const [profileSheetError, setProfileSheetError] = useState<string | null>(null);
  const [showSystemStatusSheet, setShowSystemStatusSheet] = useState(false);
  const [buddyActivityToasts, setBuddyActivityToasts] = useState<BuddyActivityToast[]>([]);

  const [showRoomsWindow, setShowRoomsWindow] = useState(false);
  const [roomNameDraft, setRoomNameDraft] = useState('');
  const [roomJoinError, setRoomJoinError] = useState<string | null>(null);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [isAdminResetOpen, setIsAdminResetOpen] = useState(false);
  const [adminResetScreenname, setAdminResetScreenname] = useState('');
  const [adminResetError, setAdminResetError] = useState<string | null>(null);
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

  const hasPresenceSyncedRef = useRef(false);
  const isSigningOffRef = useRef(false);
  const activeChatBuddyIdRef = useRef<string | null>(null);
  const acceptedBuddyIdsRef = useRef<Set<string>>(new Set());
  const buddyRowsRef = useRef<Buddy[]>([]);
  const pendingRequestsRef = useRef<PendingRequest[]>([]);
  const temporaryChatAllowedIdsRef = useRef<Set<string>>(new Set());
  const temporaryChatProfilesRef = useRef<Record<string, TemporaryChatProfile>>({});
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
  const playSound = useSoundPlayer();
  const router = useRouter();
  const searchParams = useSearchParams();
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

  const readApiError = async (response: Response) => {
    try {
      const payload = (await response.json()) as { error?: string };
      return payload.error ?? 'Request failed.';
    } catch {
      return 'Request failed.';
    }
  };

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
        if (!isOutboxItemDue(item, nowMs)) {
          continue;
        }

        if (item.type === 'dm') {
          const { data, error } = await sendDirectMessageWithClientMessageId({
            senderId: userId,
            receiverId: item.targetId,
            content: item.content,
            clientMessageId: item.id,
          });

          if (error) {
            nextItems = nextItems.map((candidate) =>
              candidate.id === item.id ? markOutboxAttemptFailure(candidate, error.message) : candidate,
            );
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
          continue;
        }
        if (activeRoom?.id === item.targetId && data) {
          setActiveRoomReloadToken((previous) => previous + 1);
        }
        nextItems = nextItems.filter((candidate) => candidate.id !== item.id);
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
    (item: { type: 'dm' | 'room'; targetId: string; content: string; clientMessageId?: string }) => {
      if (!userId) {
        return false;
      }

      const trimmedContent = item.content.trim();
      if (!trimmedContent) {
        return false;
      }

      const entry = createOutboxItem({
        type: item.type,
        targetId: item.targetId,
        content: trimmedContent,
        clientMessageId: item.clientMessageId,
      });
      setOutboxItems((previous) => normalizeOutboxItems([...previous, entry]));
      return true;
    },
    [userId],
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

  const loadBuddies = useCallback(async (targetUserId: string) => {
    setIsLoadingBuddies(true);

    const { data: relationships, error: relationshipsError } = await supabase
      .from('buddies')
      .select('buddy_id,status')
      .eq('user_id', targetUserId)
      .in('status', ['accepted', 'pending']);

    if (relationshipsError) {
      console.error('Failed to load buddies:', relationshipsError.message);
      setIsLoadingBuddies(false);
      return;
    }

    const relationshipRows = (relationships ?? []) as BuddyRelationshipRow[];

    if (relationshipRows.length === 0) {
      setBuddyRows([]);
      setSelectedBuddyId(null);
      setIsLoadingBuddies(false);
      return;
    }

    const buddyIds = [...new Set(relationshipRows.map((item) => item.buddy_id))];
    const { data: profiles, error: profilesError } = await loadManyUserProfiles({
      applyFilters: (query) => query.in('id', buddyIds),
    });

    if (profilesError) {
      console.error('Failed to load buddy profiles:', profilesError.message);
    }

    const profileMap = new Map(
      profiles.map((profile) => [
        profile.id,
        profile,
      ]),
    );

    const mergedRows = relationshipRows.map((relationship) => {
      const profile = profileMap.get(relationship.buddy_id);
      return {
        id: relationship.buddy_id,
        screenname: profile?.screenname?.trim() || 'Unknown Buddy',
        status: profile?.status ?? null,
        away_message: profile?.away_message ?? null,
        status_msg: profile?.status_msg ?? null,
        profile_bio: profile?.profile_bio ?? null,
        buddy_icon_path: profile?.buddy_icon_path ?? null,
        idle_since: profile?.idle_since ?? null,
        last_active_at: profile?.last_active_at ?? null,
        relationshipStatus: relationship.status,
      } as Buddy;
    });

    const dedupedRows = Array.from(new Map(mergedRows.map((row) => [row.id, row])).values()).sort(
      (left, right) => left.screenname.localeCompare(right.screenname, undefined, { sensitivity: 'base' }),
    );

    setBuddyRows(dedupedRows);
    setSelectedBuddyId((previous) =>
      previous && dedupedRows.some((buddy) => buddy.id === previous)
        ? previous
        : (dedupedRows[0]?.id ?? null),
    );
    setIsLoadingBuddies(false);
  }, [loadManyUserProfiles]);

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
  }, [loadBuddies, loadSingleUserProfile, markProfileSchemaUnavailable, router, syncUnreadDirectFromServer]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const buddiesChannel = supabase
      .channel(`buddies:${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'buddies', filter: `user_id=eq.${userId}` },
        () => {
          void loadBuddies(userId);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(buddiesChannel);
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
        setBuddyRows((previous) =>
          previous.map((buddy) => {
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
          }),
        );

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

    const presenceChannel = supabase.channel('buddylist-presence', {
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
      setOnlineUserIds(new Set(Object.keys(state)));
      hasPresenceSyncedRef.current = true;
    });

    presenceChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void presenceChannel.track({
          user_id: userId,
          online_at: new Date().toISOString(),
        });
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
      [...acceptedBuddies].sort((left, right) =>
        left.screenname.localeCompare(right.screenname, undefined, { sensitivity: 'base' }),
      ),
    [acceptedBuddies],
  );
  const recentActivitySortedAcceptedBuddies = useMemo(
    () =>
      [...acceptedBuddies].sort((left, right) => {
        const rightTime = normalizeTimestampMs(buddyLastMessageAt[right.id]);
        const leftTime = normalizeTimestampMs(buddyLastMessageAt[left.id]);
        if (leftTime !== rightTime) {
          return rightTime - leftTime;
        }
        return left.screenname.localeCompare(right.screenname, undefined, { sensitivity: 'base' });
      }),
    [acceptedBuddies, buddyLastMessageAt],
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
  const onlineBuddies = useMemo(
    () => acceptedBuddies.filter((buddy) => buddy.isOnline),
    [acceptedBuddies],
  );
  const offlineBuddies = useMemo(
    () => acceptedBuddies.filter((buddy) => !buddy.isOnline),
    [acceptedBuddies],
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
      const { data, error } = await supabase
        .from('messages')
        .select(DIRECT_MESSAGE_SELECT_FIELDS)
        .or(chatFilter)
        .order('created_at', { ascending: true })
        .limit(200);

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
      setInitialUnreadForActiveChat(unreadDirectMessages[buddyId] ?? 0);
      setActiveDmTypingText(null);
      setSelectedBuddyId(buddyId);
      setActiveChatBuddyId(buddyId);
      activeChatBuddyIdRef.current = buddyId;
      clearUnreadDirectMessages(buddyId);
      replaceAppPathInPlace(`${BUDDY_LIST_PATH}?dm=${encodeURIComponent(buddyId)}`);
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

  const handleAcceptPendingRequest = useCallback(
    (senderId: string) => {
      setPendingRequestError(null);
      setPendingRequests((previous) => previous.filter((request) => request.senderId !== senderId));
      setTemporaryChatAllowedIds((previous) =>
        previous.includes(senderId) ? previous : [...previous, senderId],
      );
      openChatWindowForId(senderId);
    },
    [openChatWindowForId],
  );

  const handleDeclinePendingRequest = useCallback((senderId: string) => {
    setPendingRequestError(null);
    setPendingRequests((previous) => previous.filter((request) => request.senderId !== senderId));
  }, []);

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
    setProfileSheetBuddyId(null);
    setProfileSheetError(null);
    setBuddyActivityToasts([]);
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

  const openAwayModal = useCallback(() => {
    setIsHeaderMenuOpen(false);
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
    setPendingBuddyIconFile(null);
    setRemoveBuddyIconOnSave(false);
    setBuddyIconPreviewUrl(null);
    setAwayModalError(null);
    setShowAwayModal(true);
  }, [awayMessage, awayPresets, profileBio, statusMsg]);

  const handleSelectBuddyIcon = useCallback((fileList: FileList | null) => {
    const nextFile = fileList?.[0] ?? null;
    if (!nextFile) {
      return;
    }

    if (isProfileSchemaUnavailable) {
      setAwayModalError(PROFILE_SCHEMA_NOTICE);
      return;
    }

    const validationError = validateBuddyIconFile(nextFile);
    if (validationError) {
      setAwayModalError(validationError);
      return;
    }

    if (buddyIconPreviewUrl?.startsWith('blob:')) {
      URL.revokeObjectURL(buddyIconPreviewUrl);
    }

    setAwayModalError(null);
    setPendingBuddyIconFile(nextFile);
    setRemoveBuddyIconOnSave(false);
    setBuddyIconPreviewUrl(URL.createObjectURL(nextFile));
  }, [buddyIconPreviewUrl, isProfileSchemaUnavailable]);

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
      return;
    }

    if (trimmed !== confirm) {
      setRecoverySetupError('Recovery code entries do not match.');
      return;
    }

    setIsSavingRecoveryCode(true);
    setRecoverySetupError(null);

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
  };

  const fetchAdminAuditEntries = async () => {
    setIsLoadingAdminAudit(true);
    setAdminAuditError(null);

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setAdminAuditError('Session expired. Please sign on again.');
      setIsLoadingAdminAudit(false);
      return;
    }

    let response: Response;
    try {
      response = await fetch(getAppApiUrl('/api/admin/password-reset-audit?limit=12'), {
        headers: {
          authorization: `Bearer ${accessToken}`,
        },
        cache: 'no-store',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Load failed';
      setAdminAuditError(message);
      setIsLoadingAdminAudit(false);
      return;
    }

    if (!response.ok) {
      const errorMessage = await readApiError(response);
      setAdminAuditError(errorMessage);
      setIsLoadingAdminAudit(false);
      return;
    }

    const payload = (await response.json()) as AdminAuditResponse;
    setAdminAuditEntries(Array.isArray(payload.entries) ? payload.entries : []);
    setIsLoadingAdminAudit(false);
  };

  const openAdminResetWindow = () => {
    setAdminResetScreenname('');
    setAdminResetError(null);
    setIssuedAdminTicket(null);
    setConfirmAdminResetAction(false);
    setAdminAuditEntries([]);
    setAdminAuditError(null);
    setIsAdminResetOpen(true);
    void fetchAdminAuditEntries();
  };

  const handleIssueAdminResetTicket = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!confirmAdminResetAction) {
      setAdminResetError('Confirm this admin action before issuing a reset ticket.');
      return;
    }
    const target = adminResetScreenname.trim();
    if (!target) {
      setAdminResetError('Enter a screen name.');
      return;
    }

    setIsIssuingAdminReset(true);
    setAdminResetError(null);
    setIssuedAdminTicket(null);

    const accessToken = await getAccessToken();
    if (!accessToken) {
      setAdminResetError('Session expired. Please sign on again.');
      setIsIssuingAdminReset(false);
      return;
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
      setAdminResetError(message);
      setIsIssuingAdminReset(false);
      return;
    }

    if (!response.ok) {
      const errorMessage = await readApiError(response);
      setAdminResetError(errorMessage);
      setIsIssuingAdminReset(false);
      return;
    }

    const payload = (await response.json()) as AdminTicketResponse;
    setIssuedAdminTicket({
      ticket: payload.ticket,
      expiresAt: payload.expiresAt,
    });
    setIsIssuingAdminReset(false);
    void fetchAdminAuditEntries();
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

    setSearchResults(data);
  };

  const handleAddBuddyById = useCallback(async (buddyId: string) => {
    if (!userId) {
      return false;
    }

    setIsAddingBuddyId(buddyId);
    setSearchError(null);
    setProfileSheetError(null);

    const { error } = await supabase.from('buddies').upsert(
      {
        user_id: userId,
        buddy_id: buddyId,
        status: 'accepted',
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
    setProfileSheetError(null);
    return true;
  }, [loadBuddies, userId]);

  const handleAddBuddy = async (profile: UserProfile) => {
    const added = await handleAddBuddyById(profile.id);
    if (!added) {
      return;
    }

    setShowAddWindow(false);
    setSearchTerm('');
    setSearchResults([]);
  };

  const handleRemoveBuddy = useCallback(async (buddyId: string) => {
    if (!userId) {
      return false;
    }

    setIsRemovingBuddyId(buddyId);
    setProfileSheetError(null);
    const { error } = await supabase
      .from('buddies')
      .delete()
      .eq('user_id', userId)
      .eq('buddy_id', buddyId);
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
        replaceAppPathInPlace(`${BUDDY_LIST_PATH}?room=${encodeURIComponent(activeRoom.name)}`);
      } else {
        replaceAppPathInPlace(BUDDY_LIST_PATH);
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
    setProfileSheetBuddyId(buddyId);
  }, []);

  const closeBuddyProfile = useCallback(() => {
    setProfileSheetError(null);
    setProfileSheetBuddyId(null);
  }, []);

  const handleSendMessage = useCallback(
    async (content: string, attachments: File[] = []) => {
      if (!userId || !activeChatBuddyId) {
        return;
      }

      const trimmedContent = content.trim();
      const normalizedAttachments = Array.isArray(attachments) ? attachments : [];
      if (!trimmedContent && normalizedAttachments.length === 0) {
        return;
      }

      const messageContent = trimmedContent
        ? content
        : normalizedAttachments.length === 1
          ? 'Sent an attachment.'
          : 'Sent attachments.';
      const clientMessageId = createClientMessageId();

      setIsSendingMessage(true);
      setChatError(null);

      const { data, error } = await sendDirectMessageWithClientMessageId({
        senderId: userId,
        receiverId: activeChatBuddyId,
        content: messageContent,
        clientMessageId,
      });

      setIsSendingMessage(false);

      if (error) {
        const isLikelyNetworkIssue =
          (typeof navigator !== 'undefined' && !navigator.onLine) ||
          /network|fetch|offline|timeout/i.test(error.message);
        if (isLikelyNetworkIssue && normalizedAttachments.length === 0) {
          const queued = queueOutboxMessage({
            type: 'dm',
            targetId: activeChatBuddyId,
            content: messageContent,
            clientMessageId,
          });
          if (queued) {
            setChatError('Offline: message queued and will retry automatically.');
            return;
          }
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
    [activeChatBuddyId, queueOutboxMessage, userId],
  );

  const handleQueueRoomMessage = useCallback(
    ({ roomId, content, clientMessageId }: { roomId: string; content: string; clientMessageId?: string }) => {
      return queueOutboxMessage({
        type: 'room',
        targetId: roomId,
        content,
        clientMessageId,
      });
    },
    [queueOutboxMessage],
  );

  const requestedRoomName = searchParams.get('room')?.trim() ?? '';
  const requestedDirectMessageUserId = searchParams.get('dm')?.trim() ?? '';

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
    if (!roomName) {
      return null;
    }

    let resolvedRoom: ChatRoom | null = null;

    const { data: existingRoom, error: existingRoomError } = await supabase
      .from('chat_rooms')
      .select('id,name')
      .eq('name', roomName)
      .maybeSingle();

    if (existingRoomError && existingRoomError.code !== 'PGRST116') {
      throw new Error(existingRoomError.message);
    }

    if (existingRoom) {
      resolvedRoom = existingRoom as ChatRoom;
    } else {
      const { data: caseInsensitiveRoom, error: caseInsensitiveRoomError } = await supabase
        .from('chat_rooms')
        .select('id,name')
        .ilike('name', roomName)
        .limit(1)
        .maybeSingle();

      if (caseInsensitiveRoomError && caseInsensitiveRoomError.code !== 'PGRST116') {
        throw new Error(caseInsensitiveRoomError.message);
      }

      if (caseInsensitiveRoom) {
        resolvedRoom = caseInsensitiveRoom as ChatRoom;
      }
    }

    if (!resolvedRoom && allowCreate) {
      const { data: createdRoom, error: createRoomError } = await supabase
        .from('chat_rooms')
        .insert({ name: roomName })
        .select('id,name')
        .single();

      if (createRoomError && createRoomError.code !== '23505') {
        throw new Error(createRoomError.message);
      }

      if (createdRoom) {
        resolvedRoom = createdRoom as ChatRoom;
      }
    }

    if (!resolvedRoom && allowCreate) {
      const { data: racedRoom, error: racedRoomError } = await supabase
        .from('chat_rooms')
        .select('id,name')
        .eq('name', roomName)
        .maybeSingle();

      if (racedRoomError) {
        throw new Error(racedRoomError.message);
      }

      resolvedRoom = racedRoom as ChatRoom | null;
    }

    return resolvedRoom;
  }, []);

  const openRoomView = useCallback(
    async (room: ChatRoom) => {
      setInitialUnreadForActiveRoom(getUnreadCountForRoom(room.name));
      await joinRoom(room.name);
      await clearUnreads(room.name);
      setActiveRoom(room);
      replaceAppPathInPlace(`${BUDDY_LIST_PATH}?room=${encodeURIComponent(room.name)}`);
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
    replaceAppPathInPlace(BUDDY_LIST_PATH);
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
        replaceAppPathInPlace(BUDDY_LIST_PATH);
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
      replaceAppPathInPlace(BUDDY_LIST_PATH);
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

  const openAddWindow = () => {
    setSearchTerm('');
    setSearchResults([]);
    setSearchError(null);
    setShowAddWindow(true);
    setIsHeaderMenuOpen(false);
  };

  const openRoomsWindow = () => {
    setRoomNameDraft(activeRoom?.name ?? '');
    setRoomJoinError(null);
    setShowRoomsWindow(true);
    setIsHeaderMenuOpen(false);
  };

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

  const closeChatWindow = () => {
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
      replaceAppPathInPlace(`${BUDDY_LIST_PATH}?room=${encodeURIComponent(activeRoom.name)}`);
    } else {
      replaceAppPathInPlace(BUDDY_LIST_PATH);
    }
  };

  const isCurrentUserAway = currentUserPresenceState === 'away';
  const isCurrentUserIdle = currentUserPresenceState === 'idle';
  const activePendingRequest = pendingRequests[0] ?? null;
  const activeChatBuddyPresenceSummary = activeChatBuddy ? getBuddyPresenceSummary(activeChatBuddy) : null;
  const xpGroupHeaderClass =
    'flex min-h-[36px] w-full items-center gap-2 px-3 py-1.5 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-400';
  const xpModalFrameClass =
    'rounded-[1.4rem] border border-white/60 bg-white/90 p-2 shadow-[0_24px_42px_rgba(15,23,42,0.2)] backdrop-blur-xl';
  const xpModalBodyClass = 'space-y-3 px-2 pb-2 text-[12px] text-slate-700';
  const xpModalInputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12px] text-slate-700 shadow-[inset_0_1px_1px_rgba(15,23,42,0.05)] focus:outline-none focus:ring-2 focus:ring-blue-200';
  const xpModalButtonClass =
    'min-h-[32px] rounded-xl border border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-700 hover:bg-slate-50';
  const showSplitPresenceSections = buddySortMode === 'online_then_alpha';
  const onlineBuddiesSorted = alphabeticallySortedAcceptedBuddies.filter((buddy) => buddy.isOnline);
  const offlineBuddiesSorted = alphabeticallySortedAcceptedBuddies.filter((buddy) => !buddy.isOnline);
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
  const outboxSummary =
    pendingOutboxCount === 0
      ? 'Outbox empty'
      : `${pendingOutboxCount} queued${pendingOutboxCount === 1 ? '' : ' messages'}`;
  const latestOutboxError = outboxItems.find((item) => item.lastError)?.lastError ?? null;
  const shouldShowSystemStatusChip =
    syncState === 'hydrating' || syncState === 'syncing' || syncState === 'error' || pendingOutboxCount > 0;

  const renderDirectMessageRow = (buddy: (typeof acceptedBuddies)[number]) => {
    const unreadDirectCount = unreadDirectMessages[buddy.id] ?? 0;
    const isSelected = selectedBuddyId === buddy.id;
    const presenceSummary = getBuddyPresenceSummary(buddy);
    const presenceToneClass =
      presenceSummary.presenceState === 'away'
        ? 'text-amber-500'
        : presenceSummary.presenceState === 'idle'
          ? 'text-sky-500'
          : presenceSummary.presenceState === 'offline'
            ? 'text-slate-400'
            : 'text-emerald-500';

    return (
      <div
        key={buddy.id}
        data-testid={`dm-row-${buddy.id}`}
        data-unread-dm={unreadDirectCount}
        data-screenname={buddy.screenname}
        className={`group flex min-h-[52px] w-full items-center gap-3 px-3 py-2.5 text-left transition active:scale-[0.98] ${
          isSelected
            ? 'bg-blue-500/15'
            : 'hover:bg-white/60'
        }`}
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
            <p className={`truncate text-[13px] font-semibold leading-tight ${
              isSelected ? 'text-blue-700' : 'text-slate-800'
            }`}>
              {buddy.screenname}
            </p>
            <p className={`truncate text-[11px] font-semibold ${presenceToneClass}`}>
              {presenceSummary.presenceLabel}
            </p>
            <p className="truncate text-[11px] text-slate-400" title={presenceSummary.presenceDetail}>
              {presenceSummary.presenceDetail}
            </p>
          </div>
        </button>

        {unreadDirectCount > 0 ? (
          <span
            data-testid={`dm-unread-${buddy.id}`}
            aria-label={`Unread from ${buddy.screenname}: ${unreadDirectCount}`}
            className={`ml-1 flex min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white ${
              isSelected ? '' : 'aim-unread-badge-pulse'
            }`}
          >
            {unreadDirectCount}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => handleOpenChat(buddy.id)}
          className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-[11px] font-semibold transition active:scale-95 ${
            isSelected
              ? 'border-blue-200 bg-blue-500 text-white'
              : 'border-white/70 bg-white/85 text-slate-600 hover:bg-white'
          }`}
        >
          IM
        </button>
      </div>
    );
  };
  const xpModalPrimaryButtonClass =
    'min-h-[32px] rounded-xl border border-blue-500/70 bg-gradient-to-b from-blue-500 to-blue-600 px-3 text-[12px] font-semibold text-white shadow-[0_10px_20px_rgba(37,99,235,0.32)] disabled:opacity-60';

  const handleOpenImFromActionBar = () => {
    const fallbackBuddyId =
      (selectedBuddyId && acceptedBuddies.some((buddy) => buddy.id === selectedBuddyId)
        ? selectedBuddyId
        : null) ??
      sortedDirectMessageBuddies[0]?.id ??
      null;

    if (!fallbackBuddyId) {
      return;
    }

    handleOpenChat(fallbackBuddyId);
  };

  const handleSetupAction = () => {
    setIsHeaderMenuOpen(false);
    openAwayModal();
  };

  const selectedAwayPreset = awayPresets.find((preset) => preset.id === selectedAwayPresetId) ?? null;
  const awayPreview = resolveAwayTemplate(
    awayText || selectedAwayPreset?.message || "I'm away right now.",
    screenname,
    'Buddy',
  );

  return (
    <main className="h-[100dvh] overflow-hidden bg-transparent">
      <RetroWindow
        title="Buddy List"
        variant="xp_shell"
        xpTitleText="Buddy List"
        onXpSignOff={() => setIsHeaderMenuOpen((previous) => !previous)}
      >
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden rounded-[1.6rem] border border-white/45 bg-white/50 text-[12px] text-slate-700 shadow-[0_20px_44px_rgba(15,23,42,0.14)] backdrop-blur-2xl">
          {isHeaderMenuOpen ? (
            <div className="fixed inset-0 z-30" onClick={() => setIsHeaderMenuOpen(false)}>
              <div
                className="absolute right-2 top-[calc(env(safe-area-inset-top)+3.2rem)] w-52 rounded-2xl border border-white/60 bg-white/85 p-1.5 shadow-[0_18px_40px_rgba(15,23,42,0.18)] backdrop-blur-xl"
                onClick={(event) => event.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => void handleSignOff()}
                  className="block w-full rounded-xl border border-transparent px-3 py-2 text-left text-[12px] font-semibold text-slate-700 hover:bg-blue-50"
                >
                  Sign Off
                </button>
                <button
                  type="button"
                  onClick={openAwayModal}
                  className="mt-0.5 block w-full rounded-xl border border-transparent px-3 py-2 text-left text-[12px] font-semibold text-slate-700 hover:bg-blue-50"
                >
                  Profile & Away
                </button>
                <button
                  type="button"
                  onClick={openAddWindow}
                  className="mt-0.5 block w-full rounded-xl border border-transparent px-3 py-2 text-left text-[12px] font-semibold text-slate-700 hover:bg-blue-50"
                >
                  Add Buddy
                </button>
                {isAdminUser ? (
                  <button
                    type="button"
                    onClick={openAdminResetWindow}
                    className="mt-0.5 block w-full rounded-xl border border-transparent px-3 py-2 text-left text-[12px] font-semibold text-slate-700 hover:bg-blue-50"
                  >
                    Admin Reset
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto pb-20">
            <div className="px-3 pt-3 pb-2">
              <div className="rounded-2xl border border-white/65 bg-white/72 px-3.5 py-3 shadow-sm">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={openAwayModal}
                    className="group relative shrink-0 rounded-full text-left transition active:scale-95"
                    aria-label="Edit profile photo"
                  >
                    <ProfileAvatar
                      screenname={screenname}
                      buddyIconPath={buddyIconPath}
                      presenceState={currentUserPresenceState}
                      size="md"
                    />
                    <span className="absolute -bottom-1 -right-1 rounded-full border border-white/80 bg-slate-900/90 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white shadow-sm">
                      Edit
                    </span>
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-slate-800">{screenname}</p>
                    <p className={`truncate text-[11px] font-semibold ${
                      currentUserPresenceState === 'away'
                        ? 'text-amber-500'
                        : currentUserPresenceState === 'idle'
                          ? 'text-sky-500'
                          : 'text-emerald-500'
                    }`}>
                      {getPresenceLabel(currentUserPresenceState)}
                    </p>
                    <p className="truncate text-[11px] text-slate-400">{currentUserPresenceDetail}</p>
                    {profileBio ? <p className="mt-1 truncate text-[11px] text-slate-400">{profileBio}</p> : null}
                    <p className="mt-1 truncate text-[10px] font-semibold text-slate-400">
                      {buddyIconPath ? 'Profile photo live on your card' : 'Add a profile photo to personalize your card'}
                    </p>
                  </div>
                  <div className="shrink-0 space-y-1.5">
                    <button
                      type="button"
                      onClick={openAwayModal}
                      className="block w-full rounded-xl border border-white/65 bg-white/80 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-white active:scale-95"
                    >
                      Edit Profile
                    </button>
                    <button
                      type="button"
                      onClick={openAwayModal}
                      className="block w-full rounded-xl border border-blue-200/80 bg-blue-50/85 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 shadow-sm hover:bg-blue-100/80 active:scale-95"
                    >
                      Edit Photo
                    </button>
                  </div>
                </div>
              </div>
              {awayModalError ? <p className="mt-2 text-[11px] font-semibold text-red-600">{awayModalError}</p> : null}

              {shouldShowSystemStatusChip ? (
                <button
                  type="button"
                  onClick={() => setShowSystemStatusSheet(true)}
                  className="mt-2 flex w-full items-center justify-between gap-2 rounded-2xl border border-white/55 bg-white/55 px-3 py-1.5 text-[10px] text-slate-500 transition hover:bg-white/70"
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      syncState === 'error' ? 'bg-red-400' :
                      isChatSyncBusy ? 'bg-amber-400 animate-pulse' :
                      pendingOutboxCount > 0 ? 'bg-sky-400' :
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
                  <span className="shrink-0 rounded-full border border-white/70 bg-white/80 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                    Details
                  </span>
                </button>
              ) : null}
            </div>

            {isCurrentUserAway ? (
              <div className="mx-3 mt-2 rounded-2xl border border-amber-200/70 bg-amber-50/90 px-3 py-3 backdrop-blur-sm">
                <div className="flex items-start gap-2">
                  <AppIcon kind="moon" className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-amber-800">Away</p>
                    <p className="mt-0.5 break-words text-[11px] italic text-amber-700">
                      {resolveAwayTemplate(awayMessage || 'Away from keyboard.', screenname, screenname)}
                    </p>
                    {awaySinceAt ? (
                      <p className="mt-0.5 text-[10px] text-amber-600">
                        Since {new Date(awaySinceAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={handleImBack}
                    className="shrink-0 rounded-xl border border-amber-300 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-amber-700 shadow-sm hover:bg-white active:scale-95"
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : null}

            {isCurrentUserIdle ? (
              <div className="mx-3 mt-2 rounded-2xl border border-sky-200/70 bg-sky-50/90 px-3 py-3 backdrop-blur-sm">
                <div className="flex items-start gap-2">
                  <AppIcon kind="clock" className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-semibold text-sky-800">Idle</p>
                    <p className="mt-0.5 text-[11px] text-sky-700">{formatPresenceSince(idleSinceAt, 'Idle since')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearIdle}
                    className="shrink-0 rounded-xl border border-sky-300 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-sky-700 shadow-sm hover:bg-white active:scale-95"
                  >
                    I&apos;m Here
                  </button>
                </div>
              </div>
            ) : null}

            <div className="bg-transparent">
              <div className="select-none">
                <button
                  type="button"
                  onClick={() => setIsBuddiesOpen((previous) => !previous)}
                  className={xpGroupHeaderClass}
                >
                  <AppIcon kind="chevron" className={`h-3 w-3 transition-transform ${isBuddiesOpen ? 'rotate-90' : ''}`} />
                  <span>
                    {showSplitPresenceSections
                      ? `Online — ${onlineBuddies.length} of ${acceptedBuddies.length}`
                      : `Direct Messages — ${acceptedBuddies.length}`}
                  </span>
                </button>

                {isBuddiesOpen ? (
                  <div>
                    <div className="flex items-center justify-between px-3 py-1.5">
                      <label htmlFor="buddy-sort-mode" className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                        Sort
                      </label>
                      <select
                        id="buddy-sort-mode"
                        title="Buddy Sort Mode"
                        value={buddySortMode}
                        onChange={(event) => setBuddySortMode(event.target.value as BuddySortMode)}
                        className="min-h-[28px] rounded-xl border border-white/65 bg-white/80 px-2 py-0.5 text-[11px] text-slate-700 shadow-sm"
                      >
                        <option value="online_then_alpha">Online first</option>
                        <option value="alpha">A – Z</option>
                        <option value="recent_activity">Recent activity</option>
                      </select>
                    </div>

                    {isBootstrapping ? <p className="px-3 py-2 italic text-slate-500">Dialing in...</p> : null}
                    {!isBootstrapping && isLoadingBuddies ? (
                      <p className="px-3 py-2 italic text-slate-500">Loading your buddy list...</p>
                    ) : null}
                    {!isBootstrapping && !isLoadingBuddies && acceptedBuddies.length === 0 ? (
                      <p className="px-3 py-2 italic text-slate-500">List is empty.</p>
                    ) : null}
                    {!isBootstrapping &&
                      (showSplitPresenceSections ? onlineBuddiesSorted : sortedDirectMessageBuddies).map((buddy) =>
                        renderDirectMessageRow(buddy),
                      )}

                    {pendingBuddies.length > 0 ? (
                      <div className="mx-3 mb-2 rounded-2xl border border-amber-200/70 bg-amber-50/80 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-600">Pending ({pendingBuddies.length})</p>
                        {pendingBuddies.map((buddy) => (
                          <p key={buddy.id} className="mt-0.5 truncate text-[12px] italic text-amber-700">
                            {buddy.screenname}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {showSplitPresenceSections ? (
                <div className="select-none">
                  <button
                    type="button"
                    onClick={() => setIsOfflineOpen((previous) => !previous)}
                    className={xpGroupHeaderClass}
                  >
                    <AppIcon kind="chevron" className={`h-3 w-3 transition-transform ${isOfflineOpen ? 'rotate-90' : ''}`} />
                    <span>Offline — {offlineBuddies.length}</span>
                  </button>

                  {isOfflineOpen ? offlineBuddiesSorted.map((buddy) => renderDirectMessageRow(buddy)) : null}
                </div>
              ) : null}

              <div className="select-none">
                <button
                  type="button"
                  onClick={() => setIsActiveChatsOpen((previous) => !previous)}
                  className={xpGroupHeaderClass}
                >
                  <AppIcon kind="chevron" className={`h-3 w-3 transition-transform ${isActiveChatsOpen ? 'rotate-90' : ''}`} />
                  <span>Group Rooms — {activeRooms.length}</span>
                </button>

                {isActiveChatsOpen ? (
                  activeRooms.length === 0 ? (
                    <p className="px-3 py-2 italic text-slate-500">No active rooms.</p>
                  ) : (
                    activeRooms.map((roomName) => {
                      const unreadCount = getUnreadCountForRoom(roomName);
                      const isRoomSelected = Boolean(activeRoom && sameRoom(activeRoom.name, roomName));
                      const normalizedRoomKey = normalizeRoomKey(roomName);

                      return (
                        <div key={roomName} className="flex items-center gap-2 px-3 py-2">
                          <button
                            type="button"
                            onClick={() => void handleOpenActiveRoom(roomName)}
                            data-testid={`room-row-${normalizedRoomKey}`}
                            data-room-name={roomName}
                            data-room-unread={unreadCount}
                            className={`flex min-h-[44px] flex-1 items-center gap-3 rounded-2xl px-2.5 py-2 text-left transition active:scale-[0.98] ${
                              isRoomSelected ? 'bg-blue-500/12' : 'hover:bg-white/60'
                            }`}
                          >
                            {/* Room avatar */}
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[13px] font-bold text-violet-700">
                              #
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[13px] font-semibold text-slate-800">{roomName}</p>
                              <p className="text-[11px] text-slate-400">Group chat</p>
                            </div>
                            {unreadCount > 0 ? (
                              <span
                                data-testid={`room-unread-${normalizedRoomKey}`}
                                aria-label={`Unread in ${roomName}: ${unreadCount}`}
                                className={`flex min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white ${
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
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-red-200/80 bg-white/80 text-[11px] font-semibold text-red-400 transition hover:bg-red-50"
                            aria-label={`Leave ${roomName}`}
                            title="Leave room"
                          >
                            <AppIcon kind="close" className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )
                ) : null}
                {roomJoinError ? (
                  <p className="px-3 pb-2 text-[11px] font-semibold text-red-600">{roomJoinError}</p>
                ) : null}
              </div>
            </div>
          </div>

          {/* iOS-style tab bar */}
          <div
            className="fixed bottom-0 left-0 z-20 w-full border-t border-white/50 bg-white/68 backdrop-blur-xl shadow-[0_-6px_24px_rgba(15,23,42,0.08)]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            <div className="grid h-16 grid-cols-4 items-center">
              <button
                type="button"
                onClick={handleOpenImFromActionBar}
                className="flex flex-col items-center justify-center gap-0.5 py-2 transition active:scale-90"
              >
                <BuddyListTabIcon kind="im" className="h-5 w-5 text-current" />
                <span className="text-[10px] font-semibold text-blue-500">IM</span>
              </button>
              <button
                type="button"
                onClick={openRoomsWindow}
                className="flex flex-col items-center justify-center gap-0.5 py-2 transition active:scale-90"
              >
                <BuddyListTabIcon kind="chat" className="h-5 w-5 text-current" />
                <span className="text-[10px] font-semibold text-slate-500">Chat</span>
              </button>
              <button
                type="button"
                onClick={openAddWindow}
                className="flex flex-col items-center justify-center gap-0.5 py-2 transition active:scale-90"
              >
                <BuddyListTabIcon kind="buddy" className="h-5 w-5 text-current" />
                <span className="text-[10px] font-semibold text-slate-500">Buddy</span>
              </button>
              <button
                type="button"
                onClick={handleSetupAction}
                className="flex flex-col items-center justify-center gap-0.5 py-2 transition active:scale-90"
              >
                <BuddyListTabIcon kind="profile" className="h-5 w-5 text-current" />
                <span className="text-[10px] font-semibold text-slate-500">Profile</span>
              </button>
            </div>
          </div>
        </div>
      </RetroWindow>

      {isRecoverySetupOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md">
            <div className={xpModalFrameClass}>
              <div className="mb-2 flex min-h-[34px] items-center rounded-xl border border-white/70 bg-white/70 px-3 text-[12px] font-semibold text-slate-800">
                Set Recovery Code
              </div>
              <form onSubmit={handleSaveRecoveryCode} className={xpModalBodyClass}>
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
                  You must set a recovery code before continuing. Store this safely. It is required for forgotten
                  password recovery.
                </p>

                <div>
                  <label htmlFor="recovery-code-input" className="mb-1 block text-[12px] font-semibold text-slate-700">
                    Recovery code
                  </label>
                  <input
                    id="recovery-code-input"
                    value={recoveryCodeDraft}
                    onChange={(event) => setRecoveryCodeDraft(event.target.value)}
                    className={xpModalInputClass}
                    placeholder="MY-SECRET-CODE-2026"
                    minLength={8}
                    disabled={isSavingRecoveryCode}
                  />
                </div>

                <div>
                  <label
                    htmlFor="recovery-code-confirm-input"
                    className="mb-1 block text-[12px] font-semibold text-slate-700"
                  >
                    Confirm recovery code
                  </label>
                  <input
                    id="recovery-code-confirm-input"
                    value={recoveryCodeConfirmDraft}
                    onChange={(event) => setRecoveryCodeConfirmDraft(event.target.value)}
                    className={xpModalInputClass}
                    placeholder="Repeat your code"
                    minLength={8}
                    disabled={isSavingRecoveryCode}
                  />
                </div>

                {recoverySetupError && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">
                    {recoverySetupError}
                  </p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md">
            <div className={xpModalFrameClass}>
              <div className="mb-2 flex min-h-[34px] items-center rounded-xl border border-white/70 bg-white/70 px-3 text-[12px] font-semibold text-slate-800">
                Admin Password Reset
              </div>
              <form onSubmit={handleIssueAdminResetTicket} className={xpModalBodyClass}>
                <div className="border border-[#b95f5f] bg-[#fff0f0] px-2 py-1.5 text-[11px] text-[#8b2020]">
                  <p className="font-bold uppercase tracking-wide">Admin Tools</p>
                  <p className="mt-1">Issue a one-time password reset ticket for out-of-band delivery.</p>
                </div>
                <div>
                  <label htmlFor="admin-reset-screenname" className="mb-1 block text-[12px] font-semibold text-slate-700">
                    Target screen name
                  </label>
                  <input
                    id="admin-reset-screenname"
                    value={adminResetScreenname}
                    onChange={(event) => setAdminResetScreenname(event.target.value)}
                    className={xpModalInputClass}
                    placeholder="screenname"
                    disabled={isIssuingAdminReset}
                  />
                </div>

                <label className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-2.5 py-2 text-[11px] text-amber-900">
                  <input
                    type="checkbox"
                    checked={confirmAdminResetAction}
                    onChange={(event) => setConfirmAdminResetAction(event.target.checked)}
                    disabled={isIssuingAdminReset}
                    className="mt-[1px] h-3.5 w-3.5 accent-amber-700"
                  />
                  <span>I confirm this is an authorized reset request and the ticket will be shared securely.</span>
                </label>

                {adminResetError && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">
                    {adminResetError}
                  </p>
                )}

                {issuedAdminTicket && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] text-amber-900">
                    <p className="font-bold">One-time ticket (share securely):</p>
                    <p className="mt-1 break-all font-mono text-[13px] font-bold">{issuedAdminTicket.ticket}</p>
                    <p className="mt-1 text-[11px]">
                      Expires: {new Date(issuedAdminTicket.expiresAt).toLocaleString()}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(issuedAdminTicket.ticket);
                      }}
                      className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] font-semibold text-amber-800"
                    >
                      Copy Ticket
                    </button>
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 bg-white/75 px-2.5 py-2 text-[11px] text-slate-700">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold">Recent Recovery Activity</p>
                    <button
                      type="button"
                      onClick={() => void fetchAdminAuditEntries()}
                      disabled={isLoadingAdminAudit}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 disabled:opacity-60"
                    >
                      {isLoadingAdminAudit ? 'Refreshing...' : 'Refresh'}
                    </button>
                  </div>

                  {adminAuditError ? (
                    <p className="mt-2 border border-[#b95f5f] bg-[#ffe5e5] px-2 py-1 text-[11px] text-[#8b2020]">
                      {adminAuditError}
                    </p>
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
                          <div key={entry.id} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2">
                            <p className="font-semibold text-slate-700">{formatAdminAuditEvent(entry.eventType)}</p>
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 backdrop-blur-[2px]"
          onClick={() => { setShowAwayModal(false); setAwayModalError(null); }}
        >
          <div
            className="w-full max-w-lg bottom-sheet rounded-t-[2rem] border border-white/60 bg-white/90 shadow-[var(--shadow-elevated)] backdrop-blur-2xl"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-10 rounded-full bg-slate-300" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3 pt-1">
              <h2 className="text-[17px] font-semibold text-slate-800">Profile &amp; Away</h2>
              <button
                type="button"
                onClick={() => { setShowAwayModal(false); setAwayModalError(null); }}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[13px] font-semibold text-slate-500 hover:bg-slate-200"
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
              <div className="rounded-2xl border border-white/65 bg-white/78 px-4 py-3">
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
                    <span className="absolute inset-x-1 bottom-1 rounded-full bg-slate-900/85 px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-white shadow-sm transition group-hover:bg-slate-950">
                      Edit Photo
                    </span>
                  </label>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-slate-800">{screenname}</p>
                    <p className="truncate text-[11px] text-slate-500">{profileStatusDraft || AVAILABLE_STATUS}</p>
                    {buddyIconPreviewUrl ? (
                      <p className="mt-1 text-[10px] text-blue-600">New icon ready to save</p>
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
                    <Image
                      src={buddyIconPreviewUrl}
                      alt=""
                      width={80}
                      height={80}
                      unoptimized
                      className="h-20 w-20 rounded-2xl border border-white/70 object-cover shadow-sm"
                    />
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-2">
                  <label className={`inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 shadow-sm ${isProfileSchemaUnavailable ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-slate-50'}`}>
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
                    className="rounded-xl border border-red-200/80 bg-white px-3 py-1.5 text-[11px] font-semibold text-red-500 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
                  >
                    Remove Photo
                  </button>
                </div>

                <div className="mt-3">
                  <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Status Line</p>
                  <input
                    value={profileStatusDraft}
                    onChange={(event) => setProfileStatusDraft(event.target.value.slice(0, PROFILE_STATUS_MAX_LENGTH))}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                    className="min-h-[84px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
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
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition active:scale-95 ${
                        selectedAwayPresetId === preset.id
                          ? 'border-blue-400/70 bg-blue-500 text-white'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => { setSelectedAwayPresetId('__custom__'); setAwayText(''); setAwayLabelDraft(''); }}
                    className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition active:scale-95 ${
                      selectedAwayPresetId === '__custom__'
                        ? 'border-blue-400/70 bg-blue-500 text-white'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    Custom…
                  </button>
                </div>
              </div>

              {/* Message textarea */}
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Message</p>
                <textarea
                  id="away-message-input"
                  value={awayText}
                  onChange={(event) => setAwayText(event.target.value)}
                  className="min-h-[90px] w-full resize-none rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-[13px] text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="Use %n for buddy's name, %t for time, %d for date…"
                  maxLength={320}
                />
                <p className="mt-1 text-right text-[10px] text-slate-400">{awayText.length}/320</p>
              </div>

              {/* Live preview */}
              <div className="rounded-2xl border border-slate-800/80 bg-slate-950 px-3.5 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">Preview</p>
                <p className="mt-1 break-words text-[13px] text-[#ffc4d8]">{awayPreview}</p>
              </div>

              {/* Auto-away settings */}
              <div className="space-y-3 rounded-2xl border border-white/65 bg-white/72 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-700">Show Idle when inactive</p>
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
                      className="rounded-xl border border-slate-200 bg-white px-2.5 py-1 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-200"
                    >
                      {AUTO_AWAY_MINUTE_OPTIONS.map((minutes) => (
                        <option key={minutes} value={minutes}>{minutes} min</option>
                      ))}
                    </select>
                  </div>
                ) : null}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[13px] font-semibold text-slate-700">Clear idle on activity</p>
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
                  <p className="text-[13px] font-semibold text-slate-700">Save as preset</p>
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
                <p className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-800">
                  {PROFILE_SCHEMA_NOTICE}
                </p>
              ) : null}

              {awayModalError ? (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">
                  {awayModalError}
                </p>
              ) : null}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void saveProfileSettings({ goAway: false })}
                  disabled={isSavingAwayMessage}
                  className="flex-1 rounded-2xl border border-white/65 bg-white py-3.5 text-[15px] font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-60"
                >
                  {isSavingAwayMessage ? 'Saving…' : 'Save Profile'}
                </button>
                <button
                  type="submit"
                  disabled={isSavingAwayMessage}
                  className="flex-1 rounded-2xl border border-blue-500/50 bg-blue-500 py-3.5 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(37,99,235,0.35)] transition hover:bg-blue-600 active:scale-[0.98] disabled:opacity-60"
                >
                  {isSavingAwayMessage ? 'Saving…' : 'Go Away'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSystemStatusSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/25 backdrop-blur-[2px]"
          onClick={() => setShowSystemStatusSheet(false)}
        >
          <div
            className="w-full max-w-lg bottom-sheet rounded-t-[2rem] border border-white/60 bg-white/92 shadow-[var(--shadow-elevated)] backdrop-blur-2xl"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex justify-center pb-1 pt-3">
              <div className="h-1 w-10 rounded-full bg-slate-300" />
            </div>
            <div className="flex items-center justify-between px-5 pb-3 pt-1">
              <h2 className="text-[17px] font-semibold text-slate-800">System Status</h2>
              <button
                type="button"
                onClick={() => setShowSystemStatusSheet(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[13px] font-semibold text-slate-500 hover:bg-slate-200"
              >
                <AppIcon kind="close" className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-3 px-5 pb-2">
              <div className="rounded-2xl border border-white/65 bg-white/82 px-3.5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Sync</p>
                <p className="mt-1 text-[14px] font-semibold text-slate-800">{chatSyncSummary}</p>
                <p className="mt-1 text-[12px] text-slate-500">
                  {lastSyncedAt
                    ? `Last synced ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                    : 'No successful sync yet in this session.'}
                </p>
                {lastSyncError ? (
                  <p className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-700">
                    {lastSyncError}
                  </p>
                ) : null}
              </div>

              <div className="rounded-2xl border border-white/65 bg-white/82 px-3.5 py-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Outbox</p>
                <p className="mt-1 text-[14px] font-semibold text-slate-800">{outboxSummary}</p>
                {latestOutboxError ? (
                  <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800">
                    {latestOutboxError}
                  </p>
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

      {showRoomsWindow && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-sm">
            <div className={xpModalFrameClass}>
              <div className="mb-2 flex min-h-[34px] items-center rounded-xl border border-white/70 bg-white/70 px-3 text-[12px] font-semibold text-slate-800">
                Join a Chat Room
              </div>
              <form onSubmit={handleJoinRoom} className="flex flex-col gap-3 px-2 pb-2 text-[11px]">
                <label htmlFor="room-name-input" className="font-semibold text-slate-700">
                  Room name:
                </label>
                <input
                  id="room-name-input"
                  value={roomNameDraft}
                  onChange={(event) => setRoomNameDraft(event.target.value)}
                  className={xpModalInputClass}
                  placeholder="cool_kids_club"
                  maxLength={80}
                />
                <p className="text-[12px] text-slate-500">If the room does not exist, it will be created.</p>
                {roomJoinError && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">
                    {roomJoinError}
                  </p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-sm">
            <div className={xpModalFrameClass}>
              <div className="mb-2 flex min-h-[34px] items-center rounded-xl border border-white/70 bg-white/70 px-3 text-[12px] font-semibold text-slate-800">
                Incoming Message
              </div>
              <div className="flex flex-col gap-3 px-2 pb-2 text-[11px] text-slate-700">
                <p>
                  <span className="font-bold text-blue-700">{activePendingRequest.screenname}</span> is trying to
                  send you a message, but they are not on your Buddy List.
                </p>
                {pendingRequestError && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] text-red-700">
                    {pendingRequestError}
                  </p>
                )}
                <div className="flex flex-wrap justify-end gap-2">
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
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[1px]">
          <div className="w-full max-w-md">
            <div className={xpModalFrameClass}>
              <div className="mb-2 flex min-h-[34px] items-center rounded-xl border border-white/70 bg-white/70 px-3 text-[12px] font-semibold text-slate-800">
                Add Buddy
              </div>
              <div className="flex flex-col gap-3 px-2 pb-2 text-[11px]">
                <form onSubmit={handleSearch} className="flex gap-2">
                  <input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    className={xpModalInputClass}
                    placeholder="Search screennames..."
                  />
                  <button
                    type="submit"
                    className={xpModalPrimaryButtonClass}
                  >
                    Find
                  </button>
                </form>

                {searchError && <p className="text-sm text-red-700">{searchError}</p>}

                <div className="max-h-56 overflow-y-auto border border-[#7f9db9] border-t-[#808080] border-l-[#808080] border-r-white border-b-white bg-white p-2">
                  {isSearching && (
                    <p className="p-2 text-sm italic text-slate-500">Searching screennames...</p>
                  )}
                  {!isSearching && searchTerm.trim() !== '' && searchResults.length === 0 && (
                    <p className="p-2 text-sm italic text-slate-500">No screennames found.</p>
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
                          className="mb-2 flex items-center justify-between gap-2 border border-[#d7e2f2] bg-[#f7fbff] p-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-bold">{profile.screenname || 'Unknown User'}</p>
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

      <BuddyProfileSheet
        buddy={selectedProfileSummary}
        isOpen={Boolean(selectedProfileSummary)}
        isUpdating={isAddingBuddyId === selectedProfileSummary?.id || isRemovingBuddyId === selectedProfileSummary?.id}
        errorMessage={profileSheetError}
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
      />

      {buddyActivityToasts.length > 0 ? (
        <div className="pointer-events-none fixed right-3 top-[calc(env(safe-area-inset-top)+4.25rem)] z-40 flex w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2">
          {buddyActivityToasts.map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl border px-3 py-2 text-[12px] shadow-[0_12px_28px_rgba(15,23,42,0.16)] backdrop-blur-xl ${
                item.tone === 'offline'
                  ? 'border-slate-200/80 bg-white/88 text-slate-600'
                  : item.tone === 'away'
                    ? 'border-amber-200/80 bg-amber-50/92 text-amber-800'
                    : item.tone === 'back'
                      ? 'border-sky-200/80 bg-sky-50/92 text-sky-800'
                      : 'border-emerald-200/80 bg-emerald-50/92 text-emerald-800'
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
            initialUnreadCount={initialUnreadForActiveChat}
            initialDraft={draftCache.dm[activeChatBuddy.id] ?? ''}
            typingText={activeDmTypingText}
            onSendMessage={handleSendMessage}
            onTypingActivity={sendDmTypingPulse}
            onDraftChange={(draft) => updateDmDraft(activeChatBuddy.id, draft)}
            onClose={closeChatWindow}
            onSignOff={handleSignOff}
            onOpenProfile={() => openBuddyProfile(activeChatBuddy.id)}
            isLoading={isChatLoading}
            isSending={isSendingMessage}
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
          reloadToken={activeRoomReloadToken}
          onDraftChange={(draft) => updateRoomDraft(activeRoom.name, draft)}
          onQueueRoomMessage={handleQueueRoomMessage}
          onBack={handleBackFromRoom}
          onLeave={handleLeaveCurrentRoom}
          onSignOff={handleSignOff}
        />
      )}
    </main>
  );
}

export default function BuddyList() {
  return (
    <Suspense fallback={<main className="h-[100dvh] overflow-hidden bg-[#f8f9fa]" />}>
      <BuddyListContent />
    </Suspense>
  );
}
