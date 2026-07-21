import { beforeEach, describe, expect, it, vi } from 'vitest';

const { upsertMock, rpcMock } = vi.hoisted(() => ({
  upsertMock: vi.fn(),
  rpcMock: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({ upsert: upsertMock }),
    rpc: rpcMock,
  },
}));

import { upsertOwnProfileWithRepair } from '@/lib/profileRepair';

const PAYLOAD = { id: 'user-1', screenname: 'Pakiboy24' };
const FK_ERROR = { message: 'violates foreign key constraint', code: '23503' };

describe('upsertOwnProfileWithRepair', () => {
  beforeEach(() => {
    upsertMock.mockReset();
    rpcMock.mockReset();
  });

  it('returns success without invoking repair when the upsert works', async () => {
    upsertMock.mockResolvedValueOnce({ error: null });

    const result = await upsertOwnProfileWithRepair(PAYLOAD);

    expect(result).toEqual({ error: null, repaired: false });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('repairs and retries once when the upsert fails', async () => {
    upsertMock.mockResolvedValueOnce({ error: FK_ERROR }).mockResolvedValueOnce({ error: null });
    rpcMock.mockResolvedValueOnce({ error: null });

    const result = await upsertOwnProfileWithRepair(PAYLOAD);

    expect(rpcMock).toHaveBeenCalledWith('repair_own_profile');
    expect(upsertMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ error: null, repaired: true });
  });

  it('retries without the unique identity fields so the RPC-chosen screenname survives', async () => {
    upsertMock.mockResolvedValueOnce({ error: FK_ERROR }).mockResolvedValueOnce({ error: null });
    rpcMock.mockResolvedValueOnce({ error: null });

    await upsertOwnProfileWithRepair({ ...PAYLOAD, email: 'pakiboy24@hiitsme.app', status: 'available' });

    const retryPayload = upsertMock.mock.calls[1][0];
    expect(retryPayload).not.toHaveProperty('screenname');
    expect(retryPayload).not.toHaveProperty('email');
    expect(retryPayload).toMatchObject({ id: 'user-1', status: 'available' });
  });

  it('reports the original error when the repair RPC is unavailable', async () => {
    upsertMock.mockResolvedValueOnce({ error: FK_ERROR });
    rpcMock.mockResolvedValueOnce({ error: { message: 'function does not exist' } });

    const result = await upsertOwnProfileWithRepair(PAYLOAD);

    expect(upsertMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ error: FK_ERROR, repaired: false });
  });

  it('reports the retry error when repair succeeds but the upsert still fails', async () => {
    const retryError = { message: 'duplicate key value violates unique constraint', code: '23505' };
    upsertMock.mockResolvedValueOnce({ error: FK_ERROR }).mockResolvedValueOnce({ error: retryError });
    rpcMock.mockResolvedValueOnce({ error: null });

    const result = await upsertOwnProfileWithRepair(PAYLOAD);

    expect(result).toEqual({ error: retryError, repaired: false });
  });
});
