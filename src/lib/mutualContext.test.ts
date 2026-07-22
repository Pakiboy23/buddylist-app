import { describe, expect, it } from 'vitest';
import { createEmptyMutualContext, normalizeMutualContext } from '@/lib/mutualContext';

describe('normalizeMutualContext', () => {
  it('normalizes shared rooms and mutual buddies', () => {
    expect(normalizeMutualContext({
      sharedRooms: [
        { id: 'room-1', slug: 'lobby', name: 'The Lobby' },
        { id: 'room-1', slug: 'duplicate', name: 'Duplicate' },
      ],
      mutualBuddies: [
        { id: 'buddy-1', screenname: 'coffeehound' },
        { id: 'buddy-2', screenname: 'nightowl' },
      ],
      mutualBuddyCount: 5,
    })).toEqual({
      sharedRooms: [{ id: 'room-1', slug: 'lobby', name: 'The Lobby' }],
      mutualBuddies: [
        { id: 'buddy-1', screenname: 'coffeehound' },
        { id: 'buddy-2', screenname: 'nightowl' },
      ],
      mutualBuddyCount: 5,
    });
  });

  it('drops malformed context without lowering the total below displayed buddies', () => {
    expect(normalizeMutualContext({
      sharedRooms: [{ id: '', slug: 'bad', name: 'Bad' }, null],
      mutualBuddies: [{ id: 'buddy-1', screenname: 'valid' }, { id: 2, screenname: 'bad' }],
      mutualBuddyCount: -4,
    })).toEqual({
      sharedRooms: [],
      mutualBuddies: [{ id: 'buddy-1', screenname: 'valid' }],
      mutualBuddyCount: 1,
    });
  });

  it('returns an empty context for non-object payloads', () => {
    expect(normalizeMutualContext(null)).toEqual(createEmptyMutualContext());
  });
});
