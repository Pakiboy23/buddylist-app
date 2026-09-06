import { beforeEach, describe, expect, it } from 'vitest';
import { removeValue } from '@/lib/clientStorage';
import {
  BROWSE_ADD_COOLDOWN_MS,
  BROWSE_ADD_HOURLY_LIMIT,
  browseAddRateLimitCopy,
  evaluateBrowseAddRate,
  recordBrowseAdd,
} from '@/lib/browseAddRateLimit';

const STORAGE_KEY = 'him.browseAdd.timestamps';

describe('browseAddRateLimit', () => {
  beforeEach(() => {
    removeValue(STORAGE_KEY);
  });

  it('allows the first add', () => {
    expect(evaluateBrowseAddRate(1_000)).toEqual({ ok: true });
  });

  it('enforces a short cooldown between Browse adds', () => {
    recordBrowseAdd(1_000);
    const blocked = evaluateBrowseAddRate(1_000 + 5_000);
    expect(blocked.ok).toBe(false);
    if (blocked.ok) {
      throw new Error('expected cooldown');
    }
    expect(blocked.reason).toBe('cooldown');
    expect(blocked.retryAfterMs).toBe(BROWSE_ADD_COOLDOWN_MS - 5_000);
    expect(browseAddRateLimitCopy(blocked)).toMatch(/paced/);
  });

  it('caps Browse adds per rolling hour', () => {
    const start = 10_000;
    for (let index = 0; index < BROWSE_ADD_HOURLY_LIMIT; index += 1) {
      recordBrowseAdd(start + index * BROWSE_ADD_COOLDOWN_MS);
    }

    const afterCooldown = start + BROWSE_ADD_HOURLY_LIMIT * BROWSE_ADD_COOLDOWN_MS;
    const blocked = evaluateBrowseAddRate(afterCooldown);
    expect(blocked.ok).toBe(false);
    if (blocked.ok) {
      throw new Error('expected hourly limit');
    }
    expect(blocked.reason).toBe('hourly');
    expect(browseAddRateLimitCopy(blocked)).toMatch(/enough adds/);
  });
});
