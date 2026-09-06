import { describe, expect, it } from 'vitest';
import {
  applyBrowseAwayMessageRequired,
  applyDiscoverablePeopleGate,
  AWAY_MESSAGE_COLUMN,
  DISCOVERABLE_COLUMN,
} from '@/lib/discoverableSearch';

describe('applyDiscoverablePeopleGate', () => {
  it('requires discoverable=true on every global people lookup', () => {
    const calls: Array<{ column: string; value: unknown }> = [];
    const query = {
      eq(column: string, value: boolean) {
        calls.push({ column, value });
        return this;
      },
    };

    expect(applyDiscoverablePeopleGate(query)).toBe(query);
    expect(calls).toEqual([{ column: DISCOVERABLE_COLUMN, value: true }]);
  });
});

describe('applyBrowseAwayMessageRequired', () => {
  it('is the Browse-only away-message gate — Search does not use it', () => {
    const calls: Array<{ method: string; column: string; operator?: string; value: unknown }> = [];
    const query = {
      not(column: string, operator: string, value: null) {
        calls.push({ method: 'not', column, operator, value });
        return this;
      },
      neq(column: string, value: string) {
        calls.push({ method: 'neq', column, value });
        return this;
      },
    };

    expect(applyBrowseAwayMessageRequired(query)).toBe(query);
    expect(calls).toEqual([
      { method: 'not', column: AWAY_MESSAGE_COLUMN, operator: 'is', value: null },
      { method: 'neq', column: AWAY_MESSAGE_COLUMN, value: '' },
    ]);
  });
});
