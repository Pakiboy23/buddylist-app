import { beforeEach, describe, expect, it, vi } from 'vitest';

const { upsertMock, updateMock, updateEqMock, rpcMock } = vi.hoisted(() => ({
  upsertMock: vi.fn(),
  updateMock: vi.fn(),
  updateEqMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({ upsert: upsertMock, update: updateMock }),
    rpc: rpcMock,
  },
}));

import { upsertOwnProfileWithRepair } from '@/lib/profileRepair';

const PAYLOAD = { id: 'user-1', screenname: 'Pakiboy24', email: 'pakiboy24@hiitsme.app', status: 'available' };
const FK_ERROR = { message: 'violates foreign key constraint', code: '23503' };

describe('upsertOwnProfileWithRepair', () => {
  beforeEach(() => {
    upsertMock.mockReset();
    updateMock.mockReset();
    updateEqMock.mockReset();
    rpcMock.mockReset();
    updateMock.mockImplementation((payload: unknown) => ({
      eq: (column: string, value: unknown) => updateEqMock(payload, column, value),
    }));
  });

  it('returns success without invoking repair when the upsert works', async () => {
    upsertMock.mockResolvedValueOnce({ error: null });

    const result = await upsertOwnProfileWithRepair(PAYLOAD);

    expect(result).toEqual({ error: null, repaired: false });
    expect(rpcMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('repairs and retries as a plain update when the upsert fails', async () => {
    upsertMock.mockResolvedValueOnce({ error: FK_ERROR });
    rpcMock.mockResolvedValueOnce({ error: null });
    updateEqMock.mockResolvedValueOnce({ error: null });

    const result = await upsertOwnProfileWithRepair(PAYLOAD);

    expect(rpcMock).toHaveBeenCalledWith('repair_own_profile');
    expect(result).toEqual({ error: null, repaired: true });
  });

  it('retries without the identity fields so the RPC-chosen screenname survives', async () => {
    // Regression (seen in prod): retrying via UPSERT without email failed with
    // a not-null violation because PostgREST evaluates the INSERT arm first.
    // The retry must be an UPDATE scoped to the caller's id, minus the unique
    // identity fields the RPC now owns.
    upsertMock.mockResolvedValueOnce({ error: FK_ERROR });
    rpcMock.mockResolvedValueOnce({ error: null });
    updateEqMock.mockResolvedValueOnce({ error: null });

    await upsertOwnProfileWithRepair(PAYLOAD);

    const [updatePayload, column, value] = updateEqMock.mock.calls[0];
    expect(updatePayload).not.toHaveProperty('screenname');
    expect(updatePayload).not.toHaveProperty('email');
    expect(updatePayload).not.toHaveProperty('id');
    expect(updatePayload).toMatchObject({ status: 'available' });
    expect(column).toBe('id');
    expect(value).toBe('user-1');
  });

  it('reports the original error when the repair RPC is unavailable', async () => {
    upsertMock.mockResolvedValueOnce({ error: FK_ERROR });
    rpcMock.mockResolvedValueOnce({ error: { message: 'function does not exist' } });

    const result = await upsertOwnProfileWithRepair(PAYLOAD);

    expect(updateMock).not.toHaveBeenCalled();
    expect(result).toEqual({ error: FK_ERROR, repaired: false });
  });

  it('reports the retry error when repair succeeds but the update still fails', async () => {
    const retryError = { message: 'permission denied', code: '42501' };
    upsertMock.mockResolvedValueOnce({ error: FK_ERROR });
    rpcMock.mockResolvedValueOnce({ error: null });
    updateEqMock.mockResolvedValueOnce({ error: retryError });

    const result = await upsertOwnProfileWithRepair(PAYLOAD);

    expect(result).toEqual({ error: retryError, repaired: false });
  });
});
