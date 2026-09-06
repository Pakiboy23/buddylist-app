import {
  AWAY_MOOD_OPTIONS,
  getAwayMoodOption,
  isAwayMoodId,
  type AwayMoodId,
} from '@/lib/himArtDirection';
import { isAwayStatus } from '@/lib/presence';

export type BrowsePresenceFilter = 'all' | 'away' | 'available';

export interface BrowseActivityPreset {
  id: string;
  label: string;
}

/** Built-in Go Away presets — reused as Browse activity chips, not a new status system. */
export const BROWSE_ACTIVITY_PRESETS: readonly BrowseActivityPreset[] = [
  { id: 'gym-regret', label: 'Gym' },
  { id: 'emotionally-elsewhere', label: 'Elsewhere' },
  { id: 'cooking', label: 'Cooking' },
  { id: 'snacks', label: 'Snacks' },
] as const;

const PRESET_MESSAGE_BY_ID: Record<string, string> = {
  'gym-regret': 'at the gym, probably regretting this decision',
  'emotionally-elsewhere': 'technically available, emotionally somewhere else',
  cooking: "cooking. don't talk to me until there is food",
  snacks: 'do not disturb unless you are bringing snacks',
};

const CUSTOM_ACTIVITY: BrowseActivityPreset = { id: 'custom', label: 'Custom' };

const MOOD_KEYWORDS: Record<AwayMoodId, string[]> = {
  busy: ['busy', 'gym', 'working', 'do not disturb', "don't talk", 'dnd'],
  cozy: ['cozy', 'cooking', 'snacks', 'home', 'food'],
  chaotic: ['chaotic', 'regretting', 'unhinged', 'elsewhere', 'technically available'],
  out: ['out in the world', 'out for', 'heading out'],
  honest: ['honest', 'keep it honest'],
};

function normalizeAwayLine(value: string | null | undefined): string {
  return (value ?? '').trim().replace(/\s+/g, ' ');
}

export function formatBrowseRelativeTime(isoString: string | null | undefined, now = Date.now()): string {
  if (!isoString) {
    return '';
  }

  const timestamp = Date.parse(isoString);
  if (Number.isNaN(timestamp)) {
    return '';
  }

  const diffMs = now - timestamp;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export function matchBrowseActivity(awayMessage: string | null | undefined): BrowseActivityPreset {
  const normalized = normalizeAwayLine(awayMessage).toLowerCase();
  if (!normalized) {
    return CUSTOM_ACTIVITY;
  }

  const matchedId = Object.entries(PRESET_MESSAGE_BY_ID).find(([, message]) => message === normalized)?.[0];
  const preset = BROWSE_ACTIVITY_PRESETS.find((item) => item.id === matchedId);
  return preset ?? CUSTOM_ACTIVITY;
}

export function inferBrowseMood(awayMessage: string | null | undefined): AwayMoodId | null {
  const normalized = normalizeAwayLine(awayMessage).toLowerCase();
  if (!normalized) {
    return null;
  }

  const ranked = (Object.keys(MOOD_KEYWORDS) as AwayMoodId[])
    .map((id) => ({
      id,
      hits: MOOD_KEYWORDS[id].filter((keyword) => normalized.includes(keyword)).length,
    }))
    .filter((entry) => entry.hits > 0)
    .sort((left, right) => right.hits - left.hits);

  return ranked[0]?.id ?? null;
}

export function getBrowseMoodChip(moodId: AwayMoodId | null | undefined) {
  if (!isAwayMoodId(moodId)) {
    return null;
  }
  return getAwayMoodOption(moodId);
}

export function getBrowsePresenceFilter(status: string | null | undefined): Exclude<BrowsePresenceFilter, 'all'> {
  return isAwayStatus(status) ? 'away' : 'available';
}

export interface BrowseCardFields {
  presence: Exclude<BrowsePresenceFilter, 'all'>;
  moodId: AwayMoodId | null;
  activity: BrowseActivityPreset;
  relativeTime: string;
}

export function describeBrowseCard(input: {
  status?: string | null;
  awayMessage?: string | null;
  lastActiveAt?: string | null;
  now?: number;
}): BrowseCardFields {
  return {
    presence: getBrowsePresenceFilter(input.status),
    moodId: inferBrowseMood(input.awayMessage),
    activity: matchBrowseActivity(input.awayMessage),
    relativeTime: formatBrowseRelativeTime(input.lastActiveAt, input.now),
  };
}

export function matchesBrowseFilters(
  card: BrowseCardFields,
  filters: {
    presence: BrowsePresenceFilter;
    moodIds: readonly AwayMoodId[];
    activityIds: readonly string[];
  },
): boolean {
  if (filters.presence !== 'all' && card.presence !== filters.presence) {
    return false;
  }

  if (filters.moodIds.length > 0) {
    if (!card.moodId || !filters.moodIds.includes(card.moodId)) {
      return false;
    }
  }

  if (filters.activityIds.length > 0 && !filters.activityIds.includes(card.activity.id)) {
    return false;
  }

  return true;
}

export const BROWSE_MOOD_FILTERS = AWAY_MOOD_OPTIONS.map((option) => ({
  id: option.id,
  label: option.label,
  tone: option.tone,
}));
