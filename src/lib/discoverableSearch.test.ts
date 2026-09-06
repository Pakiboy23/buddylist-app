import { describe, expect, it } from 'vitest';
import { applyDiscoverablePeopleGate, DISCOVERABLE_COLUMN } from '@/lib/discoverableSearch';

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
