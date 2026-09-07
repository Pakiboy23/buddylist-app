import { describe, expect, it } from 'vitest';
import {
  BROWSE_ACTIVITY_PRESETS,
  describeBrowseCard,
  formatBrowseRelativeTime,
  getBrowsePresenceChip,
  inferBrowseMood,
  matchBrowseActivity,
  matchesBrowseFilters,
  shouldFillBrowseFilterPages,
} from '@/lib/browsePresence';

describe('formatBrowseRelativeTime', () => {
  const now = Date.parse('2026-09-06T20:00:00.000Z');

  it('returns empty for missing or invalid timestamps', () => {
    expect(formatBrowseRelativeTime(null, now)).toBe('');
    expect(formatBrowseRelativeTime('not-a-date', now)).toBe('');
  });

  it('uses short relative copy', () => {
    expect(formatBrowseRelativeTime('2026-09-06T19:59:30.000Z', now)).toBe('just now');
    expect(formatBrowseRelativeTime('2026-09-06T19:40:00.000Z', now)).toBe('20m ago');
    expect(formatBrowseRelativeTime('2026-09-06T17:00:00.000Z', now)).toBe('3h ago');
    expect(formatBrowseRelativeTime('2026-09-04T20:00:00.000Z', now)).toBe('2d ago');
  });
});

describe('matchBrowseActivity', () => {
  it('matches built-in Go Away presets by exact message', () => {
    expect(matchBrowseActivity('at the gym, probably regretting this decision')).toEqual(
      BROWSE_ACTIVITY_PRESETS[0],
    );
    expect(matchBrowseActivity("  cooking. don't talk to me until there is food  ")).toEqual(
      BROWSE_ACTIVITY_PRESETS[2],
    );
  });

  it('labels unmatched authored lines as Custom', () => {
    expect(matchBrowseActivity('window seat at the cafe')).toEqual({ id: 'custom', label: 'Custom' });
  });
});

describe('inferBrowseMood', () => {
  it('derives mood from the existing away line, not a new status field', () => {
    expect(inferBrowseMood('at the gym, probably regretting this decision')).toBe('busy');
    expect(inferBrowseMood('technically available, emotionally somewhere else')).toBe('chaotic');
    expect(inferBrowseMood("cooking. don't talk to me until there is food")).toBe('cozy');
  });

  it('returns null when the line has no mood vocabulary', () => {
    expect(inferBrowseMood('back after the movie')).toBeNull();
    expect(inferBrowseMood('')).toBeNull();
  });
});

describe('describeBrowseCard', () => {
  const now = Date.parse('2026-09-07T12:00:00.000Z');

  it('does not show Available next to a multi-day-old last_active_at', () => {
    const stale = describeBrowseCard({
      status: 'Available',
      awayMessage: 'away from keyboard, brb',
      lastActiveAt: '2026-08-26T12:00:00.000Z',
      now,
    });
    expect(stale.presence).toBe('offline');
    expect(stale.presenceLabel).toBe('Offline');
    expect(stale.relativeTime).toBe('12d ago');
  });

  it('keeps Away now only while last_active_at is still inside the window', () => {
    const awayNow = describeBrowseCard({
      status: 'Away',
      awayMessage: 'at the gym, probably regretting this decision',
      lastActiveAt: '2026-09-07T11:50:00.000Z',
      now,
    });
    expect(awayNow.presence).toBe('away');
    expect(awayNow.relativeTime).toBe('10m ago');
  });

  it('hides chips and relative time when the subject turned activity off', () => {
    const hidden = describeBrowseCard({
      status: 'Available',
      awayMessage: 'window seat at the cafe',
      lastActiveAt: '2026-09-07T11:55:00.000Z',
      showOnlineStatus: false,
      now,
    });
    expect(hidden.presence).toBe('hidden');
    expect(hidden.presenceLabel).toBeNull();
    expect(hidden.relativeTime).toBe('');
    expect(hidden.activity.label).toBe('Custom');
  });

  it('still shows the owner the truth when their own toggle is off', () => {
    const own = describeBrowseCard({
      status: 'Available',
      lastActiveAt: '2026-09-07T11:55:00.000Z',
      showOnlineStatus: false,
      isSelf: true,
      now,
    });
    expect(own.presence).toBe('available');
    expect(own.relativeTime).toBe('5m ago');
  });

  it('keeps a recently active Available row with idle_since out of Available', () => {
    const idle = describeBrowseCard({
      status: 'Available',
      lastActiveAt: '2026-09-07T11:55:00.000Z',
      idleSince: '2026-09-07T11:50:00.000Z',
      now,
    });
    expect(idle.presence).toBe('idle');
    expect(idle.presenceLabel).toBe('Idle');
    expect(matchesBrowseFilters(idle, { presence: 'available', moodIds: [], activityIds: [] })).toBe(false);
    expect(matchesBrowseFilters(idle, { presence: 'all', moodIds: [], activityIds: [] })).toBe(true);
  });

  it('maps derived presence to the same chip labels the filters use', () => {
    expect(getBrowsePresenceChip('available')).toEqual({ label: 'Available', tone: 'green' });
    expect(getBrowsePresenceChip('away')).toEqual({ label: 'Away now', tone: 'gold' });
    expect(getBrowsePresenceChip('idle')).toEqual({ label: 'Idle', tone: 'lavender' });
    expect(getBrowsePresenceChip('offline')).toEqual({ label: 'Offline', tone: 'muted' });
    expect(getBrowsePresenceChip('hidden')).toBeNull();
  });
});

describe('matchesBrowseFilters', () => {
  const now = Date.parse('2026-09-07T12:00:00.000Z');
  const awayGym = describeBrowseCard({
    status: 'Away',
    awayMessage: 'at the gym, probably regretting this decision',
    lastActiveAt: '2026-09-07T11:50:00.000Z',
    now,
  });

  it('keeps All / Away now / Available on the same derived presence', () => {
    expect(matchesBrowseFilters(awayGym, { presence: 'all', moodIds: [], activityIds: [] })).toBe(true);
    expect(matchesBrowseFilters(awayGym, { presence: 'away', moodIds: [], activityIds: [] })).toBe(true);
    expect(matchesBrowseFilters(awayGym, { presence: 'available', moodIds: [], activityIds: [] })).toBe(false);
  });

  it('keeps stale Available and hidden activity off the named filters', () => {
    const staleAvailable = describeBrowseCard({
      status: 'Available',
      lastActiveAt: '2026-08-26T12:00:00.000Z',
      now,
    });
    const hidden = describeBrowseCard({
      status: 'Away',
      lastActiveAt: '2026-09-07T11:50:00.000Z',
      showOnlineStatus: false,
      now,
    });
    expect(matchesBrowseFilters(staleAvailable, { presence: 'available', moodIds: [], activityIds: [] })).toBe(false);
    expect(matchesBrowseFilters(staleAvailable, { presence: 'all', moodIds: [], activityIds: [] })).toBe(true);
    expect(matchesBrowseFilters(hidden, { presence: 'away', moodIds: [], activityIds: [] })).toBe(false);
    expect(matchesBrowseFilters(hidden, { presence: 'available', moodIds: [], activityIds: [] })).toBe(false);
    expect(matchesBrowseFilters(hidden, { presence: 'all', moodIds: [], activityIds: [] })).toBe(true);
  });

  it('applies mood and activity as multi-selects', () => {
    expect(matchesBrowseFilters(awayGym, { presence: 'all', moodIds: ['busy'], activityIds: [] })).toBe(true);
    expect(matchesBrowseFilters(awayGym, { presence: 'all', moodIds: ['cozy'], activityIds: [] })).toBe(false);
    expect(matchesBrowseFilters(awayGym, { presence: 'all', moodIds: [], activityIds: ['gym-regret'] })).toBe(true);
    expect(matchesBrowseFilters(awayGym, { presence: 'all', moodIds: [], activityIds: ['snacks'] })).toBe(false);
  });
});

describe('shouldFillBrowseFilterPages', () => {
  it('keeps loading later pages when filters hide the current page', () => {
    expect(shouldFillBrowseFilterPages({
      filtersActive: true,
      visibleCount: 0,
      hasMore: true,
      busy: false,
    })).toBe(true);
  });

  it('stops when a page already matches, paging is done, or a fetch is in flight', () => {
    expect(shouldFillBrowseFilterPages({
      filtersActive: true,
      visibleCount: 2,
      hasMore: true,
      busy: false,
    })).toBe(false);
    expect(shouldFillBrowseFilterPages({
      filtersActive: true,
      visibleCount: 0,
      hasMore: false,
      busy: false,
    })).toBe(false);
    expect(shouldFillBrowseFilterPages({
      filtersActive: true,
      visibleCount: 0,
      hasMore: true,
      busy: true,
    })).toBe(false);
    expect(shouldFillBrowseFilterPages({
      filtersActive: false,
      visibleCount: 0,
      hasMore: true,
      busy: false,
    })).toBe(false);
  });
});
