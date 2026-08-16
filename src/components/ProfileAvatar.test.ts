import { describe, expect, it } from 'vitest';

import { getPresenceRingClass } from '@/components/ProfileAvatar';

describe('getPresenceRingClass', () => {
  it('maps each known presence state to its ring class', () => {
    expect(getPresenceRingClass('available')).toBe('presence-ring-available');
    expect(getPresenceRingClass('away')).toBe('presence-ring-away');
    expect(getPresenceRingClass('idle')).toBe('presence-ring-idle');
    expect(getPresenceRingClass('offline')).toBe('presence-ring-offline');
  });

  it('renders a neutral ring when presence is unknown', () => {
    // Regression: unknown presence used to fall through to the green
    // "available" pulse, so every room-message avatar glowed as if online.
    expect(getPresenceRingClass(null)).toBe('presence-ring-unknown');
    expect(getPresenceRingClass(undefined)).toBe('presence-ring-unknown');
  });
});
