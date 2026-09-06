import { describe, expect, it } from 'vitest';
import {
  BROWSE_ACTIVITY_PRESETS,
  describeBrowseCard,
  formatBrowseRelativeTime,
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

describe('matchesBrowseFilters', () => {
  const awayGym = describeBrowseCard({
    status: 'Away',
    awayMessage: 'at the gym, probably regretting this decision',
    lastActiveAt: '2026-09-06T19:50:00.000Z',
    now: Date.parse('2026-09-06T20:00:00.000Z'),
  });

  it('keeps All / Away now / Available as presence-only', () => {
    expect(matchesBrowseFilters(awayGym, { presence: 'all', moodIds: [], activityIds: [] })).toBe(true);
    expect(matchesBrowseFilters(awayGym, { presence: 'away', moodIds: [], activityIds: [] })).toBe(true);
    expect(matchesBrowseFilters(awayGym, { presence: 'available', moodIds: [], activityIds: [] })).toBe(false);
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
