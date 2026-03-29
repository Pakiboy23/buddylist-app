import { getVersionedData, setVersionedData } from '@/lib/clientStorage';

export type OutboxItemType = 'dm' | 'room';
export type OutboxItemStatus = 'queued' | 'sending' | 'failed';
export type OutboxPreviewType = 'text' | 'attachment' | 'forwarded' | 'voice_note';

interface OutboxEnvelopeData {
  items: OutboxItem[];
}

export interface OutboxItem {
  id: string;
  type: OutboxItemType;
  targetId: string;
  content: string;
  expiresAt: string | null;
  replyToMessageId: number | null;
  forwardSourceMessageId: number | null;
  forwardSourceSenderId: string | null;
  previewType: OutboxPreviewType;
  createdAt: string;
  status: OutboxItemStatus;
  attempts: number;
  nextAttemptAt: string;
  lastError: string | null;
}

export interface NewOutboxItem {
  type: OutboxItemType;
  targetId: string;
  content: string;
  clientMessageId?: string;
  status?: OutboxItemStatus;
  expiresAt?: string | null;
  replyToMessageId?: number | null;
  forwardSourceMessageId?: number | null;
  forwardSourceSenderId?: string | null;
  previewType?: OutboxPreviewType;
}

const OUTBOX_STORAGE_KEY_PREFIX = 'buddylist:outbox:v1:';
const OUTBOX_VERSION = 1;
const OUTBOX_MAX_ITEMS = 160;
const OUTBOX_MAX_CONTENT_CHARS = 4000;
const OUTBOX_BACKOFF_STEPS_MS = [1500, 4000, 10000, 30000, 120000];

export function getOutboxStorageKey(userId: string) {
  return `${OUTBOX_STORAGE_KEY_PREFIX}${userId}`;
}

function nowIsoString() {
  return new Date().toISOString();
}

export function createClientMessageId() {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
}

function computeNextAttemptIso(attempts: number) {
  const stepIndex = Math.max(0, Math.min(OUTBOX_BACKOFF_STEPS_MS.length - 1, attempts));
  const nextAttemptMs = Date.now() + OUTBOX_BACKOFF_STEPS_MS[stepIndex];
  return new Date(nextAttemptMs).toISOString();
}

function normalizeItem(value: unknown): OutboxItem | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<OutboxItem>;
  const type = candidate.type === 'dm' || candidate.type === 'room' ? candidate.type : null;
  const targetId = typeof candidate.targetId === 'string' ? candidate.targetId.trim() : '';
  const content = typeof candidate.content === 'string' ? candidate.content.trim() : '';
  const id = typeof candidate.id === 'string' && candidate.id.trim() ? candidate.id : '';
  const createdAt = typeof candidate.createdAt === 'string' ? candidate.createdAt : nowIsoString();
  const expiresAt = typeof candidate.expiresAt === 'string' && candidate.expiresAt.trim() ? candidate.expiresAt : null;
  const replyToMessageId =
    typeof candidate.replyToMessageId === 'number' && Number.isFinite(candidate.replyToMessageId)
      ? Math.floor(candidate.replyToMessageId)
      : null;
  const forwardSourceMessageId =
    typeof candidate.forwardSourceMessageId === 'number' && Number.isFinite(candidate.forwardSourceMessageId)
      ? Math.floor(candidate.forwardSourceMessageId)
      : null;
  const forwardSourceSenderId =
    typeof candidate.forwardSourceSenderId === 'string' && candidate.forwardSourceSenderId.trim()
      ? candidate.forwardSourceSenderId.trim()
      : null;
  const previewType: OutboxPreviewType =
    candidate.previewType === 'attachment' ||
    candidate.previewType === 'forwarded' ||
    candidate.previewType === 'voice_note'
      ? candidate.previewType
      : 'text';
  const status =
    candidate.status === 'queued' || candidate.status === 'sending' || candidate.status === 'failed'
      ? candidate.status
      : typeof candidate.lastError === 'string'
        ? 'failed'
        : 'queued';
  const attempts =
    typeof candidate.attempts === 'number' && Number.isFinite(candidate.attempts) && candidate.attempts >= 0
      ? Math.floor(candidate.attempts)
      : 0;
  const nextAttemptAt =
    typeof candidate.nextAttemptAt === 'string' ? candidate.nextAttemptAt : computeNextAttemptIso(attempts);
  const lastError = typeof candidate.lastError === 'string' ? candidate.lastError : null;

  if (!type || !targetId || !content || !id) {
    return null;
  }

  return {
    id,
    type,
    targetId,
    content: content.slice(0, OUTBOX_MAX_CONTENT_CHARS),
    expiresAt,
    replyToMessageId,
    forwardSourceMessageId,
    forwardSourceSenderId,
    previewType,
    createdAt,
    status,
    attempts,
    nextAttemptAt,
    lastError,
  };
}

export function normalizeOutboxItems(items: OutboxItem[]) {
  const dedupedById = new Map<string, OutboxItem>();
  for (const rawItem of items) {
    const normalized = normalizeItem(rawItem);
    if (!normalized) {
      continue;
    }
    dedupedById.set(normalized.id, normalized);
  }

  return Array.from(dedupedById.values())
    .sort((left, right) => {
      const leftTime = Date.parse(left.createdAt);
      const rightTime = Date.parse(right.createdAt);
      if (Number.isNaN(leftTime) || Number.isNaN(rightTime)) {
        return 0;
      }
      return leftTime - rightTime;
    })
    .slice(-OUTBOX_MAX_ITEMS);
}

export function loadOutbox(userId: string): OutboxItem[] {
  const key = getOutboxStorageKey(userId);
  const payload = getVersionedData<OutboxEnvelopeData>(key, {
    version: OUTBOX_VERSION,
    fallback: { items: [] },
    guard: (value): value is OutboxEnvelopeData =>
      Boolean(value && typeof value === 'object' && Array.isArray((value as { items?: unknown }).items)),
    migrate: (legacy) => {
      if (legacy && typeof legacy === 'object' && Array.isArray((legacy as { items?: unknown }).items)) {
        return {
          items: normalizeOutboxItems((legacy as { items: OutboxItem[] }).items),
        };
      }
      if (Array.isArray(legacy)) {
        return {
          items: normalizeOutboxItems(legacy as OutboxItem[]),
        };
      }
      return null;
    },
  });

  return normalizeOutboxItems(payload.items);
}

export function saveOutbox(userId: string, items: OutboxItem[]) {
  const normalized = normalizeOutboxItems(items);
  return setVersionedData<OutboxEnvelopeData>(getOutboxStorageKey(userId), OUTBOX_VERSION, { items: normalized }, {
    maxBytes: 96 * 1024,
    compact: (envelope) => ({
      ...envelope,
      data: {
        items: normalizeOutboxItems(envelope.data.items),
      },
    }),
  });
}

export function createOutboxItem(input: NewOutboxItem): OutboxItem {
  const id = input.clientMessageId?.trim() || createClientMessageId();
  const createdAt = nowIsoString();
  return {
    id,
    type: input.type,
    targetId: input.targetId,
    content: input.content.trim().slice(0, OUTBOX_MAX_CONTENT_CHARS),
    expiresAt: typeof input.expiresAt === 'string' && input.expiresAt.trim() ? input.expiresAt.trim() : null,
    replyToMessageId:
      typeof input.replyToMessageId === 'number' && Number.isFinite(input.replyToMessageId)
        ? Math.floor(input.replyToMessageId)
        : null,
    forwardSourceMessageId:
      typeof input.forwardSourceMessageId === 'number' && Number.isFinite(input.forwardSourceMessageId)
        ? Math.floor(input.forwardSourceMessageId)
        : null,
    forwardSourceSenderId:
      typeof input.forwardSourceSenderId === 'string' && input.forwardSourceSenderId.trim()
        ? input.forwardSourceSenderId.trim()
        : null,
    previewType:
      input.previewType === 'attachment' || input.previewType === 'forwarded' || input.previewType === 'voice_note'
        ? input.previewType
        : 'text',
    createdAt,
    status: input.status ?? 'queued',
    attempts: 0,
    nextAttemptAt: createdAt,
    lastError: null,
  };
}

export function markOutboxSending(item: OutboxItem) {
  return {
    ...item,
    status: 'sending' as const,
    nextAttemptAt: nowIsoString(),
    lastError: null,
  };
}

export function scheduleOutboxRetryNow(item: OutboxItem) {
  return {
    ...item,
    status: 'queued' as const,
    nextAttemptAt: nowIsoString(),
    lastError: null,
  };
}

export function markOutboxAttemptFailure(item: OutboxItem, errorMessage: string) {
  const nextAttempts = item.attempts + 1;
  return {
    ...item,
    status: 'failed' as const,
    attempts: nextAttempts,
    nextAttemptAt: computeNextAttemptIso(nextAttempts),
    lastError: errorMessage,
  };
}

export function isOutboxItemDue(item: OutboxItem, nowMs = Date.now()) {
  const nextAttemptMs = Date.parse(item.nextAttemptAt);
  if (Number.isNaN(nextAttemptMs)) {
    return true;
  }
  return nowMs >= nextAttemptMs;
}
