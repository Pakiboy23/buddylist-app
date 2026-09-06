import { getJSON, setJSON } from '@/lib/clientStorage';

const STORAGE_KEY = 'him.browseAdd.timestamps';
export const BROWSE_ADD_HOURLY_LIMIT = 8;
export const BROWSE_ADD_COOLDOWN_MS = 20_000;
const WINDOW_MS = 60 * 60 * 1000;

interface BrowseAddStore {
  timestamps: number[];
}

function isBrowseAddStore(value: unknown): value is BrowseAddStore {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const timestamps = (value as { timestamps?: unknown }).timestamps;
  return Array.isArray(timestamps) && timestamps.every((item) => typeof item === 'number' && Number.isFinite(item));
}

function readStore(): number[] {
  const stored = getJSON<BrowseAddStore>(STORAGE_KEY, {
    fallback: { timestamps: [] },
    guard: isBrowseAddStore,
  });
  return stored.timestamps;
}

function prune(timestamps: number[], now: number): number[] {
  return timestamps.filter((timestamp) => now - timestamp < WINDOW_MS).sort((left, right) => left - right);
}

export type BrowseAddRateLimitReason = 'cooldown' | 'hourly';

export type BrowseAddRateLimitResult =
  | { ok: true }
  | { ok: false; reason: BrowseAddRateLimitReason; retryAfterMs: number };

export function evaluateBrowseAddRate(now = Date.now()): BrowseAddRateLimitResult {
  const recent = prune(readStore(), now);
  const last = recent[recent.length - 1];
  if (typeof last === 'number' && now - last < BROWSE_ADD_COOLDOWN_MS) {
    return {
      ok: false,
      reason: 'cooldown',
      retryAfterMs: BROWSE_ADD_COOLDOWN_MS - (now - last),
    };
  }

  if (recent.length >= BROWSE_ADD_HOURLY_LIMIT) {
    const oldest = recent[0] ?? now;
    return {
      ok: false,
      reason: 'hourly',
      retryAfterMs: Math.max(1, WINDOW_MS - (now - oldest)),
    };
  }

  return { ok: true };
}

export function recordBrowseAdd(now = Date.now()): void {
  const next = prune([...readStore(), now], now);
  setJSON(STORAGE_KEY, { timestamps: next });
}

export function browseAddRateLimitCopy(result: Extract<BrowseAddRateLimitResult, { ok: false }>): string {
  switch (result.reason) {
    case 'cooldown':
      return 'Give it a second — add from Browse is paced so it stays a conversation, not a spray.';
    case 'hourly':
      return 'That is enough adds from Browse for now. Come back in a bit.';
    default: {
      const exhaustive: never = result.reason;
      return exhaustive;
    }
  }
}
