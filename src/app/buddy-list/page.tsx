'use client';

import { FormEvent, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import ChatWindow, { ChatMessage } from '@/components/ChatWindow';
import GroupChatWindow from '@/components/GroupChatWindow';
import { getAccessTokenOrNull, getSessionOrNull } from '@/lib/authClient';
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
import { initSoundSystem, playFallbackTone, playUiSound } from '@/lib/sound';
import { supabase } from '@/lib/supabase';
import { normalizeRoomKey, sameRoom } from '@/lib/roomName';
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

function composeStatusMessage(status: string, awayMessage: string | null | undefined): string {
  const normalizedStatus = normalizeStatusLabel(status);
  const trimmedAwayMessage = (awayMessage ?? '').trim();
  if (normalizedStatus === AWAY_STATUS && trimmedAwayMessage) {
    return `${AWAY_STATUS} - ${trimmedAwayMessage}`;
  }

  return normalizedStatus;
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
  const resolvedStatusMessage = composeStatusMessage(resolvedStatus, resolvedAwayMessage);

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
  const [showAwayModal, setShowAwayModal] = useState(false);
  const [awayPresets, setAwayPresets] = useState<AwayPreset[]>(DEFAULT_AWAY_PRESETS);
  const [selectedAwayPresetId, setSelectedAwayPresetId] = useState<string>(DEFAULT_AWAY_PRESETS[0].id);
  const [awayLabelDraft, setAwayLabelDraft] = useState('');
  const [awayText, setAwayText] = useState('');
  const [saveAwayPreset, setSaveAwayPreset] = useState(false);
  const [isAutoAwayEnabled, setIsAutoAwayEnabled] = useState(true);
  const [autoAwayMinutes, setAutoAwayMinutes] = useState<number>(10);
  const [autoReturnOnActivity, setAutoReturnOnActivity] = useState(true);
  const [awaySinceAt, setAwaySinceAt] = useState<string | null>(null);
  const [awayModalError, setAwayModalError] = useState<string | null>(null);
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
  const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);

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
  const pendingRequestsRef = useRef<PendingRequest[]>([]);
  const temporaryChatAllowedIdsRef = useRef<Set<string>>(new Set());
  const userStatusRef = useRef(userStatus);
  const awayMessageRef = useRef(awayMessage);
  const screennameRef = useRef(screenname);
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
    pendingRequestsRef.current = pendingRequests;
  }, [pendingRequests]);

  useEffect(() => {
    temporaryChatAllowedIdsRef.current = new Set(temporaryChatAllowedIds);
  }, [temporaryChatAllowedIds]);

  useEffect(() => {
    userStatusRef.current = userStatus;
  }, [userStatus]);

  useEffect(() => {
    awayMessageRef.current = awayMessage;
  }, [awayMessage]);

  useEffect(() => {
    screennameRef.current = screenname;
  }, [screenname]);

  useEffect(() => {
    awayReplyCooldownRef.current = awayReplyCooldowns;
  }, [awayReplyCooldowns]);

  useEffect(() => {
    outboxItemsRef.current = outboxItems;
  }, [outboxItems]);

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
    const { data: profiles, error: profilesError } = await supabase
      .from('users')
      .select('id,screenname,status,away_message,status_msg')
      .in('id', buddyIds);

    if (profilesError) {
      console.error('Failed to load buddy profiles:', profilesError.message);
    }

    const profileMap = new Map(
      (((profiles as UserProfile[] | null) ?? []) as UserProfile[]).map((profile) => [
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
  }, []);

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
      const session = await getSessionOrNull();
      if (!session) {
        router.push('/');
        return;
      }

      const metaScreenname =
        typeof session.user.user_metadata?.screenname === 'string'
          ? session.user.user_metadata.screenname.trim()
          : '';
      const emailFallback = session.user.email?.split('@')[0] ?? 'Unknown User';
      const fallbackName = metaScreenname || emailFallback;

      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('id,email,screenname,status,away_message,status_msg')
        .eq('id', session.user.id)
        .maybeSingle();

      if (profileError) {
        console.error('Failed to fetch profile:', profileError.message);
      }

      const existingProfile = userProfile as UserProfile | null;
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
        router.push('/');
        return;
      }

      const { error: upsertError } = await supabase.from('users').upsert(
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
      );

      if (upsertError) {
        console.error('Failed to sync profile:', upsertError.message);
      }

      setUserId(session.user.id);
      setScreenname(resolvedScreenname);
      setStatusMsg(resolvedStatusState.statusMessage);
      setUserStatus(resolvedStatusState.status);
      setAwayMessage(resolvedStatusState.awayMessage);
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
        const adminResponse = await fetch('/api/admin/me', {
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
        router.push('/');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadBuddies, router, syncUnreadDirectFromServer]);

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

            return {
              ...buddy,
              screenname:
                typeof updated.screenname === 'string' && updated.screenname.trim()
                  ? updated.screenname
                  : buddy.screenname,
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
            };
          }),
        );

        if (updated.id !== userId && acceptedBuddyIdsRef.current.has(updated.id)) {
          if (buddyWentAway) {
            playSound(BUDDY_GOING_AWAY_SOUND);
          } else if (buddyCameBack) {
            playSound(BUDDY_SIGN_ON_SOUND);
          }
        }

        if (updated.id === userId) {
          if (typeof updated.screenname === 'string' && updated.screenname.trim()) {
            setScreenname(updated.screenname);
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
  }, [awayMessage, playSound, statusMsg, userId, userStatus]);

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
  }, [playSound, userId]);

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
      isOnline: true,
    };
  }, [activeChatBuddyId, buddies, pendingRequests, temporaryChatProfiles]);

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
      router.replace(`${BUDDY_LIST_PATH}?dm=${encodeURIComponent(buddyId)}`, { scroll: false });
      void loadConversation(buddyId);
    },
    [clearUnreadDirectMessages, loadConversation, router, unreadDirectMessages],
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
            const { data: senderProfile } = await supabase
              .from('users')
              .select('id,screenname,status,away_message,status_msg')
              .eq('id', senderId)
              .maybeSingle();

            const profile = senderProfile as UserProfile | null;
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
  }, [clearUnreadDirectMessages, playIncomingAlert, sendAutoAwayReply, userId]);

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
      router.push('/');
    } finally {
      if (!didCompleteSignOut) {
        isSigningOffRef.current = false;
      }
    }
  };

  const updateStatus = useCallback(
    async (newStatus: string, message: string | null) => {
      if (!userId) {
        return false;
      }

      const normalizedStatus = normalizeStatusLabel(newStatus);
      const wasAway = normalizeStatusLabel(userStatusRef.current) === AWAY_STATUS;
      const normalizedAwayMessage = (message ?? '').trim();
      const nextAwayMessage = normalizedStatus === AWAY_STATUS ? normalizedAwayMessage : '';
      const resolvedStatusAwayMessage =
        normalizedStatus === AWAY_STATUS
          ? resolveAwayTemplate(nextAwayMessage, screennameRef.current, screennameRef.current)
          : '';
      const nextStatusMessage = composeStatusMessage(normalizedStatus, resolvedStatusAwayMessage);

      const { error } = await supabase
        .from('users')
        .update({
          status: normalizedStatus,
          away_message: nextAwayMessage || null,
          status_msg: nextStatusMessage,
        })
        .eq('id', userId);

      if (error) {
        console.error('Failed to update status:', error.message);
        setAwayModalError(error.message);
        return false;
      }

      setUserStatus(normalizedStatus);
      setAwayMessage(nextAwayMessage);
      setStatusMsg(nextStatusMessage);
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
    [playSound, userId],
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
    setAwayModalError(null);
    setShowAwayModal(true);
  }, [awayMessage, awayPresets]);

  const handleSaveAwayMessage = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setAwayModalError(null);
      setIsSavingAwayMessage(true);

      const trimmedMessage = awayText.trim();
      const trimmedLabel = awayLabelDraft.trim();

      if (!trimmedMessage) {
        setAwayModalError('Enter an away message before saving.');
        setIsSavingAwayMessage(false);
        return;
      }

      if (saveAwayPreset && !trimmedLabel) {
        setAwayModalError('Enter a label to save this away message.');
        setIsSavingAwayMessage(false);
        return;
      }

      if (saveAwayPreset && trimmedLabel) {
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

      const success = await updateStatus(AWAY_STATUS, trimmedMessage);
      setIsSavingAwayMessage(false);

      if (!success) {
        return;
      }

      autoAwayTriggeredRef.current = false;
      setShowAwayModal(false);
    },
    [awayLabelDraft, awayText, saveAwayPreset, updateStatus],
  );

  const handleImBack = useCallback(() => {
    autoAwayTriggeredRef.current = false;
    setAwaySinceAt(null);
    void updateStatus(AVAILABLE_STATUS, null);
  }, [updateStatus]);

  useEffect(() => {
    if (!userId || !isAutoAwayEnabled || typeof window === 'undefined') {
      return;
    }

    let lastActivityAt = Date.now();

    const markActivity = () => {
      lastActivityAt = Date.now();
      if (autoReturnOnActivity && autoAwayTriggeredRef.current && userStatusRef.current === AWAY_STATUS) {
        autoAwayTriggeredRef.current = false;
        setAwaySinceAt(null);
        void updateStatus(AVAILABLE_STATUS, null);
      }
    };

    const activityEvents: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart', 'mousemove'];
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, markActivity, { passive: true });
    });

    const intervalId = window.setInterval(() => {
      if (userStatusRef.current !== AVAILABLE_STATUS) {
        return;
      }

      const elapsed = Date.now() - lastActivityAt;
      if (elapsed < autoAwayMinutes * 60 * 1000) {
        return;
      }

      autoAwayTriggeredRef.current = true;
      setAwaySinceAt(new Date().toISOString());
      const template = awayMessageRef.current.trim() || "I've stepped away for a bit. Back soon.";
      void updateStatus(AWAY_STATUS, template);
    }, 15000);

    return () => {
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, markActivity);
      });
      window.clearInterval(intervalId);
    };
  }, [autoAwayMinutes, autoReturnOnActivity, isAutoAwayEnabled, updateStatus, userId]);

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

    const response = await fetch('/api/auth/recovery/setup', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ recoveryCode: trimmed }),
    });

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

    const response = await fetch('/api/admin/password-reset-audit?limit=12', {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    });

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

    const response = await fetch('/api/admin/password-reset-ticket', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ screenname: target }),
    });

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

    const { data, error } = await supabase
      .from('users')
      .select('id,screenname,status,away_message,status_msg')
      .ilike('screenname', `%${query}%`)
      .neq('id', userId)
      .order('screenname', { ascending: true })
      .limit(15);

    setIsSearching(false);

    if (error) {
      setSearchError(error.message);
      return;
    }

    setSearchResults((data ?? []) as UserProfile[]);
  };

  const handleAddBuddy = async (profile: UserProfile) => {
    if (!userId) {
      return;
    }

    setIsAddingBuddyId(profile.id);
    setSearchError(null);

    const { error } = await supabase.from('buddies').upsert(
      {
        user_id: userId,
        buddy_id: profile.id,
        status: 'accepted',
      },
      { onConflict: 'user_id,buddy_id' },
    );

    setIsAddingBuddyId(null);

    if (error) {
      setSearchError(error.message);
      return;
    }

    setShowAddWindow(false);
    setSearchTerm('');
    setSearchResults([]);
    await loadBuddies(userId);
  };

  const handleAddBuddyFromPendingRequest = useCallback(
    async (senderId: string) => {
      if (!userId) {
        return;
      }

      setPendingRequestError(null);
      setIsProcessingRequestId(senderId);

      const { error } = await supabase.from('buddies').upsert(
        {
          user_id: userId,
          buddy_id: senderId,
          status: 'accepted',
        },
        { onConflict: 'user_id,buddy_id' },
      );

      setIsProcessingRequestId(null);

      if (error) {
        setPendingRequestError(error.message);
        return;
      }

      setPendingRequests((previous) => previous.filter((request) => request.senderId !== senderId));
      setTemporaryChatAllowedIds((previous) =>
        previous.includes(senderId) ? previous : [...previous, senderId],
      );
      await loadBuddies(userId);
      openChatWindowForId(senderId);
    },
    [loadBuddies, openChatWindowForId, userId],
  );

  const handleOpenChat = (buddyId: string) => {
    openChatWindowForId(buddyId);
  };

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
    } else if (allowCreate) {
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
      router.replace(`${BUDDY_LIST_PATH}?room=${encodeURIComponent(room.name)}`, { scroll: false });
    },
    [clearUnreads, getUnreadCountForRoom, joinRoom, router],
  );

  const handleOpenActiveRoom = useCallback(
    async (roomName: string) => {
      if (!roomName.trim()) {
        return;
      }

      setRoomJoinError(null);
      setIsJoiningRoom(true);

      try {
        const resolvedRoom = await resolveRoomByName(roomName, false);
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
    router.push(BUDDY_LIST_PATH);
  }, [router]);

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
        router.push(BUDDY_LIST_PATH);
      }
    },
    [activeRoom, leaveRoom, router],
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
      router.replace(BUDDY_LIST_PATH, { scroll: false });
      return;
    }

    let isCancelled = false;

    void (async () => {
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('id,screenname,status,away_message,status_msg')
        .eq('id', requestedDirectMessageUserId)
        .maybeSingle();

      if (isCancelled) {
        return;
      }

      if (profileError) {
        console.error('Failed to load direct message profile:', profileError.message);
      } else if (profileData) {
        const profile = profileData as UserProfile;
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
          },
        }));
      }

      setTemporaryChatAllowedIds((previous) =>
        previous.includes(requestedDirectMessageUserId)
          ? previous
          : [...previous, requestedDirectMessageUserId],
      );

      setSelectedBuddyId(requestedDirectMessageUserId);
      router.replace(BUDDY_LIST_PATH, { scroll: false });
    })();

    return () => {
      isCancelled = true;
    };
  }, [requestedDirectMessageUserId, requestedRoomName, router, userId]);

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
      router.replace(`${BUDDY_LIST_PATH}?room=${encodeURIComponent(activeRoom.name)}`, { scroll: false });
    } else {
      router.replace(BUDDY_LIST_PATH, { scroll: false });
    }
  };

  const isCurrentUserAway = normalizeStatusLabel(userStatus) === AWAY_STATUS;
  const activePendingRequest = pendingRequests[0] ?? null;
  const activeChatBuddyStatusMessage = activeChatBuddy
    ? resolveStatusFields({
        status: activeChatBuddy.status,
        awayMessage: activeChatBuddy.away_message,
        statusMessage: activeChatBuddy.status_msg,
      }).statusMessage
    : null;
  const xpRaisedButtonClass =
    'min-h-[34px] rounded-xl border border-white/65 bg-white/80 px-3 text-[12px] font-semibold text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.08)] transition hover:bg-white disabled:opacity-60';
  const xpGroupHeaderClass =
    'flex min-h-[38px] w-full items-center gap-2 border-y border-white/55 bg-white/45 px-3 py-2 text-left text-[12px] font-semibold text-slate-700';
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

  const renderDirectMessageRow = (buddy: (typeof acceptedBuddies)[number]) => {
    const unreadDirectCount = unreadDirectMessages[buddy.id] ?? 0;
    const isSelected = selectedBuddyId === buddy.id;
    const resolvedBuddyStatus = resolveStatusFields({
      status: buddy.status,
      awayMessage: buddy.away_message,
      statusMessage: buddy.status_msg,
    });
    const isBuddyAway = normalizeStatusLabel(resolvedBuddyStatus.status) === AWAY_STATUS;
    const awayLine = resolveAwayTemplate(
      resolvedBuddyStatus.awayMessage || 'Away',
      buddy.screenname,
      screenname,
    );

    return (
      <button
        key={buddy.id}
        type="button"
        onClick={() => handleOpenChat(buddy.id)}
        data-testid={`dm-row-${buddy.id}`}
        data-unread-dm={unreadDirectCount}
        data-screenname={buddy.screenname}
        className={`group flex min-h-[44px] w-full items-center justify-between border-b border-[#edf2f8] px-3 py-2 text-left transition ${
          isSelected
            ? 'bg-blue-600 text-white'
            : 'text-slate-700 hover:bg-blue-50 hover:text-slate-900'
        }`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="aim-list-kind-chip" aria-hidden="true">
              @
            </span>
            <span
              className={`inline-flex h-2.5 w-2.5 items-center justify-center border ${
                isSelected
                  ? 'border-white bg-white'
                  : isBuddyAway
                    ? 'border-[#8a8a8a] bg-[#f0d75d]'
                    : buddy.isOnline
                      ? 'border-[#2b8f3f] bg-[#35b556]'
                      : 'border-[#6f6f6f] bg-[#b9b9b9]'
              }`}
            />
            <span
              className={`truncate font-bold ${
                isBuddyAway && !isSelected ? 'italic text-gray-500 group-hover:text-white' : ''
              }`}
            >
              {buddy.screenname}
            </span>
          </div>
          {isBuddyAway ? (
            <p
              className={`w-full truncate pl-7 text-[10px] italic ${
                isSelected ? 'text-blue-100' : 'text-gray-500 group-hover:text-blue-100'
              }`}
              title={awayLine}
            >
              {awayLine}
            </p>
          ) : null}
        </div>
        {unreadDirectCount > 0 ? (
          <span
            data-testid={`dm-unread-${buddy.id}`}
            aria-label={`Unread from ${buddy.screenname}: ${unreadDirectCount}`}
            className={`ml-2 shrink-0 rounded-full border border-white bg-gradient-to-b from-red-400 to-red-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm shadow-black/50 ${
              isSelected ? '' : 'aim-unread-badge-pulse'
            }`}
          >
            {unreadDirectCount}
          </span>
        ) : null}
      </button>
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
    if (isAdminUser) {
      openAdminResetWindow();
      return;
    }

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
                  Set Away Message
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
                    onClick={handleSetupAction}
                    className="mt-0.5 block w-full rounded-xl border border-transparent px-3 py-2 text-left text-[12px] font-semibold text-slate-700 hover:bg-blue-50"
                  >
                    Admin Reset
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto pb-20">
            <div className="border-b border-white/55 bg-white/35 px-4 py-3">
              {!isCurrentUserAway ? (
                <>
                  <p className="truncate text-[11px] font-bold text-slate-700">{screenname}</p>
                  <p className="truncate text-[11px] italic text-[#5b708f]">{statusMsg || AVAILABLE_STATUS}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      disabled
                      className="min-h-[34px] rounded-xl border border-slate-200 bg-white/80 px-3 font-semibold text-slate-700"
                    >
                      Available
                    </button>
                    <button type="button" onClick={openAwayModal} className={xpRaisedButtonClass}>
                      Set Away Message
                    </button>
                  </div>
                </>
              ) : null}
              {awayModalError ? <p className="mt-2 font-semibold text-red-700">{awayModalError}</p> : null}
              <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 py-2 text-[11px] text-slate-600">
                <div className="min-w-0">
                  <p className="font-semibold uppercase tracking-wide text-slate-500">Room State</p>
                  <p className="truncate">{chatSyncSummary}</p>
                  <p className="truncate">{outboxSummary}</p>
                  {lastSyncError ? (
                    <p className="truncate font-semibold text-[#8b2020]" title={lastSyncError}>
                      {lastSyncError}
                    </p>
                  ) : null}
                  {latestOutboxError ? (
                    <p className="truncate font-semibold text-[#8b2020]" title={latestOutboxError}>
                      {latestOutboxError}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => void syncFromServer()}
                  disabled={isChatSyncBusy}
                  className="min-h-[30px] shrink-0 rounded-xl border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 disabled:opacity-60"
                >
                  {isChatSyncBusy ? 'Syncing...' : 'Sync Now'}
                </button>
              </div>
            </div>

            {isCurrentUserAway ? (
              <div className="mx-3 mt-2 flex flex-col items-center space-y-1.5 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-3 text-center">
                <p className="text-[12px] font-semibold text-[#4d5874]">You are currently Away.</p>
                <p className="w-full break-words text-[11px] italic text-gray-600">
                  {resolveAwayTemplate(awayMessage || 'Away from keyboard.', screenname, screenname)}
                </p>
                {awaySinceAt ? (
                  <p className="text-[10px] text-[#4d5874]">
                    Away since {new Date(awaySinceAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={handleImBack}
                  className={xpRaisedButtonClass}
                >
                  I&apos;m Back
                </button>
              </div>
            ) : null}

            <div className="bg-transparent">
              <div className="select-none">
                <button
                  type="button"
                  onClick={() => setIsBuddiesOpen((previous) => !previous)}
                  className={xpGroupHeaderClass}
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-slate-300 bg-white text-[11px] leading-none">
                    {isBuddiesOpen ? '-' : '+'}
                  </span>
                  <span>
                    {showSplitPresenceSections
                      ? `Direct Messages - Online (${onlineBuddies.length}/${acceptedBuddies.length})`
                      : `Direct Messages (${acceptedBuddies.length})`}
                  </span>
                </button>

                {isBuddiesOpen ? (
                  <div>
                    <div className="flex items-center justify-between border-b border-slate-200 bg-white/60 px-3 py-2">
                      <label htmlFor="buddy-sort-mode" className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Sort
                      </label>
                      <select
                        id="buddy-sort-mode"
                        title="Buddy Sort Mode"
                        value={buddySortMode}
                        onChange={(event) => setBuddySortMode(event.target.value as BuddySortMode)}
                        className="min-h-[30px] rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-700"
                      >
                        <option value="online_then_alpha">Online then A-Z</option>
                        <option value="alpha">A-Z</option>
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
                      <div className="border-b border-[#e5ecf5] px-3 py-2">
                        <p className="font-bold text-[#536b89]">Pending ({pendingBuddies.length})</p>
                        {pendingBuddies.map((buddy) => (
                          <p key={buddy.id} className="truncate italic text-slate-500">
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
                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-slate-300 bg-white text-[11px] leading-none">
                      {isOfflineOpen ? '-' : '+'}
                    </span>
                    <span>Direct Messages - Offline ({offlineBuddies.length}/{acceptedBuddies.length})</span>
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
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-md border border-slate-300 bg-white text-[11px] leading-none">
                    {isActiveChatsOpen ? '-' : '+'}
                  </span>
                  <span>Group Rooms ({activeRooms.length})</span>
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
                        <div key={roomName} className="flex items-stretch border-b border-[#edf2f8]">
                          <button
                            type="button"
                            onClick={() => void handleOpenActiveRoom(roomName)}
                            data-testid={`room-row-${normalizedRoomKey}`}
                            data-room-name={roomName}
                            data-room-unread={unreadCount}
                            className="group flex min-h-[44px] flex-1 items-center justify-between px-3 py-2 text-left text-slate-700 transition hover:bg-blue-50 hover:text-slate-900"
                          >
                            <div className="flex min-w-0 items-center gap-1.5">
                              <span className="aim-list-kind-chip" aria-hidden="true">
                                #
                              </span>
                              <span className="truncate font-bold">{roomName}</span>
                            </div>
                            {unreadCount > 0 ? (
                              <span
                                data-testid={`room-unread-${normalizedRoomKey}`}
                                aria-label={`Unread in ${roomName}: ${unreadCount}`}
                                className={`ml-2 shrink-0 rounded-full border border-white bg-gradient-to-b from-red-400 to-red-600 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm shadow-black/50 ${
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
                            className="my-1 mr-2 inline-flex min-h-[34px] min-w-[34px] items-center justify-center rounded-xl border border-red-200 bg-red-50 px-2 text-[11px] font-semibold text-red-700 transition hover:bg-red-100"
                            aria-label={`Leave ${roomName}`}
                            title="Leave room"
                          >
                            X
                          </button>
                        </div>
                      );
                    })
                  )
                ) : null}
              </div>
            </div>
          </div>

          <div className="fixed bottom-0 left-0 z-20 h-16 w-full border-t border-white/70 bg-white/65 backdrop-blur-xl shadow-[0_-6px_24px_rgba(15,23,42,0.1)]">
            <div className="grid h-full grid-cols-4 items-center gap-2 px-3 py-2">
              <button type="button" onClick={handleOpenImFromActionBar} className={xpRaisedButtonClass}>
                IM
              </button>
              <button type="button" onClick={openRoomsWindow} className={xpRaisedButtonClass}>
                Chat
              </button>
              <button type="button" onClick={openAddWindow} className={xpRaisedButtonClass}>
                Buddy
              </button>
              <button type="button" onClick={handleSetupAction} className={xpRaisedButtonClass}>
                Setup
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
                <p className="border border-[#b79f45] bg-[#fff4c5] px-2 py-1.5 text-[11px] text-amber-800">
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
                  <p className="border border-[#b95f5f] bg-[#ffe5e5] px-2 py-1.5 text-[11px] text-[#8b2020]">
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

                <label className="flex items-start gap-2 border border-[#d8c48b] bg-[#fff9e6] px-2 py-1.5 text-[11px] text-amber-800">
                  <input
                    type="checkbox"
                    checked={confirmAdminResetAction}
                    onChange={(event) => setConfirmAdminResetAction(event.target.checked)}
                    disabled={isIssuingAdminReset}
                    className="mt-[1px] h-3.5 w-3.5 accent-[#8b2020]"
                  />
                  <span>I confirm this is an authorized reset request and the ticket will be shared securely.</span>
                </label>

                {adminResetError && (
                  <p className="border border-[#b95f5f] bg-[#ffe5e5] px-2 py-1.5 text-[11px] text-[#8b2020]">
                    {adminResetError}
                  </p>
                )}

                {issuedAdminTicket && (
                  <div className="border border-[#b79f45] bg-[#fff4c5] px-2 py-1.5 text-[11px] text-amber-800">
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
                      className="mt-2 border border-slate-200 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-amber-800"
                    >
                      Copy Ticket
                    </button>
                  </div>
                )}

                <div className="border border-slate-200 bg-white/70 px-2 py-1.5 text-[11px] text-slate-700">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold">Recent Recovery Activity</p>
                    <button
                      type="button"
                      onClick={() => void fetchAdminAuditEntries()}
                      disabled={isLoadingAdminAudit}
                      className="border border-slate-200 rounded-lg bg-white px-2 py-1 text-[11px] font-bold text-slate-700 disabled:opacity-60"
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
                    <p className="mt-2 italic text-[#4c6182]">No recent events.</p>
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
                          <div key={entry.id} className="border border-[#d2deee] bg-white px-2 py-1.5">
                            <p className="font-bold text-[#2a4f82]">{formatAdminAuditEvent(entry.eventType)}</p>
                            <p className="text-[10px] text-[#4c6182]">{new Date(entry.createdAt).toLocaleString()}</p>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
          <div className="w-[22rem] max-w-[95%] rounded-xl border border-slate-200 bg-white/90 p-1 shadow-xl">
            <div className="mb-2 flex min-h-[28px] items-center bg-gradient-to-b from-blue-400 via-blue-500 to-blue-700 px-3">
              <p className="text-[13px] font-bold text-white [text-shadow:0_1px_0_rgba(0,0,0,0.35)]">
                Set Away Message
              </p>
            </div>

            <form onSubmit={handleSaveAwayMessage} className="space-y-3 px-2 pb-2 text-sm">
              <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                <label htmlFor="away-label-input" className="text-[12px] font-semibold text-slate-700">
                  Enter label:
                </label>
                <input
                  id="away-label-input"
                  value={awayLabelDraft}
                  onChange={(event) => setAwayLabelDraft(event.target.value)}
                  className="h-8 border border-[#7F9DB9] bg-white px-2 text-[12px] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.08)] focus:outline-none focus:ring-1 focus:ring-[#7F9DB9]"
                  placeholder="Simple Plan"
                  maxLength={40}
                />
              </div>

              <div className="grid grid-cols-[90px_1fr] items-center gap-2">
                <label htmlFor="away-preset-select" className="text-[12px] font-semibold text-slate-700">
                  Preset:
                </label>
                <select
                  id="away-preset-select"
                  value={selectedAwayPresetId}
                  onChange={(event) => {
                    const nextPresetId = event.target.value;
                    setSelectedAwayPresetId(nextPresetId);
                    const preset = awayPresets.find((item) => item.id === nextPresetId);
                    if (preset) {
                      setAwayLabelDraft(preset.label);
                      setAwayText(preset.message);
                    }
                  }}
                  className="h-8 border border-[#7F9DB9] bg-white px-2 text-[12px] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.08)] focus:outline-none focus:ring-1 focus:ring-[#7F9DB9]"
                >
                  {awayPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                  <option value="__custom__">Custom...</option>
                </select>
              </div>

              <div>
                <label htmlFor="away-message-input" className="mb-1 block text-[12px] font-semibold text-slate-700">
                  Enter new Away message:
                </label>
                <div className="mb-1 flex items-center gap-1 border border-[#b7b7b7] bg-white px-1 py-1">
                  <span className="inline-flex h-5 w-5 items-center justify-center border border-slate-200 rounded-lg bg-white text-[11px] font-bold text-slate-700">
                    A
                  </span>
                  <span className="inline-flex h-5 w-5 items-center justify-center border border-slate-200 rounded-lg bg-white text-[11px] font-bold text-slate-700">
                    B
                  </span>
                  <span className="inline-flex h-5 w-5 items-center justify-center border border-slate-200 rounded-lg bg-white text-[11px] font-bold text-slate-700">
                    I
                  </span>
                  <span className="inline-flex h-5 w-5 items-center justify-center border border-slate-200 rounded-lg bg-white text-[11px] font-bold text-slate-700 underline">
                    U
                  </span>
                </div>
              </div>

              <textarea
                id="away-message-input"
                value={awayText}
                onChange={(event) => setAwayText(event.target.value)}
                className="min-h-[110px] w-full resize-none border border-[#7F9DB9] bg-white p-2 text-[12px] shadow-inner focus:outline-none focus:ring-1 focus:ring-[#7F9DB9]"
                placeholder="Use %n for buddy name, %d for date, %t for time..."
                maxLength={320}
              />

              <div className="border border-[#5a5a5a] border-t-[#808080] border-l-[#808080] border-r-[#b6b6b6] border-b-[#b6b6b6] bg-black p-2">
                <p className="break-words text-[13px] text-[#ffc4d8]">{awayPreview}</p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#2f405c]">
                <label className="inline-flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={saveAwayPreset}
                    onChange={(event) => setSaveAwayPreset(event.target.checked)}
                    className="h-4 w-4 border border-[#7f7f7f]"
                  />
                  Save for later use
                </label>
                <span className="text-[10px]">%n = Buddy, %d = Date, %t = Time</span>
              </div>

              <div className="space-y-2 border border-[#c9d4e5] bg-[#f4f7fc] p-2">
                <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={isAutoAwayEnabled}
                    onChange={(event) => setIsAutoAwayEnabled(event.target.checked)}
                    className="h-4 w-4 border border-[#7f7f7f]"
                  />
                  Auto set Away when idle
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-700">Idle timeout:</span>
                  <select
                    value={autoAwayMinutes}
                    onChange={(event) => setAutoAwayMinutes(Number(event.target.value))}
                    className="h-7 border border-[#7F9DB9] bg-white px-2 text-[11px] shadow-[inset_1px_1px_2px_rgba(0,0,0,0.08)] focus:outline-none"
                    disabled={!isAutoAwayEnabled}
                  >
                    {AUTO_AWAY_MINUTE_OPTIONS.map((minutes) => (
                      <option key={minutes} value={minutes}>
                        {minutes} min
                      </option>
                    ))}
                  </select>
                </div>
                <label className="inline-flex items-center gap-2 text-[11px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={autoReturnOnActivity}
                    onChange={(event) => setAutoReturnOnActivity(event.target.checked)}
                    className="h-4 w-4 border border-[#7f7f7f]"
                    disabled={!isAutoAwayEnabled}
                  />
                  Return to Available when activity resumes
                </label>
              </div>

              {awayModalError ? (
                <p className="text-[12px] font-semibold text-red-700">{awayModalError}</p>
              ) : null}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowAwayModal(false);
                    setAwayModalError(null);
                  }}
                  className="min-h-[34px] rounded-xl border border-slate-200 bg-white/90 px-3 text-xs font-bold text-slate-700 shadow-[inset_1px_1px_0_rgba(255,255,255,0.8)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAwayMessage}
                  className="min-h-[34px] rounded-xl border border-slate-200 bg-white/90 px-4 text-xs font-bold text-slate-700 shadow-[inset_1px_1px_0_rgba(255,255,255,0.8)] disabled:opacity-60"
                >
                  {isSavingAwayMessage ? 'Saving...' : "I'm Away"}
                </button>
              </div>
            </form>
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
                  <p className="border border-[#b95f5f] bg-[#ffe5e5] px-2 py-1.5 text-[11px] text-[#8b2020]">
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
                  <p className="border border-[#b95f5f] bg-[#ffe5e5] px-2 py-1.5 text-[11px] text-[#8b2020]">
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

      {activeChatBuddy && userId && (
        <>
          <ChatWindow
            key={activeChatBuddy.id}
            buddyScreenname={activeChatBuddy.screenname}
            buddyStatusMessage={activeChatBuddyStatusMessage || AVAILABLE_STATUS}
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
