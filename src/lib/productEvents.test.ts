import { beforeEach, describe, expect, it, vi } from 'vitest';

const { track } = vi.hoisted(() => ({
  track: vi.fn(),
}));

vi.mock('@vercel/analytics', () => ({
  track,
}));

import { PRODUCT_EVENTS, trackProductEvent } from '@/lib/productEvents';

describe('trackProductEvent', () => {
  beforeEach(() => {
    track.mockReset();
  });

  it('forwards named events to the existing Vercel Analytics hook', () => {
    trackProductEvent(PRODUCT_EVENTS.awayMessageSet, { first_session: true });
    expect(track).toHaveBeenCalledWith(PRODUCT_EVENTS.awayMessageSet, { first_session: true });
  });

  it('swallows tracker failures', () => {
    track.mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => trackProductEvent(PRODUCT_EVENTS.firstSessionAwayNudgeShown)).not.toThrow();
  });
});
