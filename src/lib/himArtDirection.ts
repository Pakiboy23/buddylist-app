import { normalizeRoomKey } from '@/lib/roomName';

export type AwayMoodId = 'honest' | 'chaotic' | 'busy' | 'cozy' | 'out';

export interface AwayMoodOption {
  id: AwayMoodId;
  label: string;
  symbol: string;
  tone: 'rose' | 'gold' | 'lavender' | 'green';
  hint: string;
}

export const AWAY_MOOD_OPTIONS: AwayMoodOption[] = [
  { id: 'honest', label: 'honest', symbol: '≈', tone: 'rose', hint: 'keep it honest' },
  { id: 'chaotic', label: 'chaotic', symbol: '!', tone: 'lavender', hint: 'a little unhinged is fine' },
  { id: 'busy', label: 'busy', symbol: '//', tone: 'gold', hint: 'short, clear, unavailable' },
  { id: 'cozy', label: 'cozy', symbol: '•', tone: 'green', hint: 'soft, homebody, low-stakes' },
  { id: 'out', label: 'out', symbol: '→', tone: 'gold', hint: 'out in the world for a minute' },
];

export const DEFAULT_AWAY_MOOD_ID: AwayMoodId = 'honest';

export function isAwayMoodId(value: string | null | undefined): value is AwayMoodId {
  return AWAY_MOOD_OPTIONS.some((option) => option.id === value);
}

export function getAwayMoodOption(moodId: AwayMoodId | null | undefined) {
  return AWAY_MOOD_OPTIONS.find((option) => option.id === moodId) ?? AWAY_MOOD_OPTIONS[0];
}

export type HimRoomTone = 'rose' | 'gold' | 'lavender' | 'green' | 'ghost';

export interface HimRoomTag {
  key: string;
  label: string;
  tone: HimRoomTone;
}

export interface HimRoomMeta {
  blurb: string;
  tags: HimRoomTag[];
  liveCount: number;
}

export interface HimRoomFilterOption {
  key: string;
  label: string;
  tone: HimRoomTone;
}

const ROOM_FILTER_ORDER = [
  'city',
  '30s',
  'single',
  'divorced',
  'food',
  'film',
  'books',
  'work',
  'cozy',
  'chaotic',
  'general',
] as const;

const CITY_LABELS = [
  'orlando',
  'miami',
  'tampa',
  'atlanta',
  'chicago',
  'brooklyn',
  'nyc',
  'new york',
  'austin',
  'la',
  'los angeles',
] as const;

const ROOM_META_OVERRIDES: Record<string, Omit<HimRoomMeta, 'liveCount'>> = {
  'late night cooking': {
    blurb: 'food, flirting, and dinner decisions',
    tags: [
      { key: 'food', label: 'food', tone: 'rose' },
      { key: 'general', label: 'all ages', tone: 'ghost' },
    ],
  },
  'movies we pretend to have seen': {
    blurb: 'movie opinions without the homework',
    tags: [
      { key: 'film', label: 'film', tone: 'lavender' },
      { key: 'chaotic', label: 'chaotic', tone: 'rose' },
    ],
  },
  'orlando gays': {
    blurb: 'local plans, local gossip, local chaos',
    tags: [
      { key: 'city', label: 'orlando', tone: 'lavender' },
      { key: 'general', label: 'local', tone: 'ghost' },
    ],
  },
  'working from couch club': {
    blurb: 'career ambition from the sofa',
    tags: [
      { key: 'work', label: 'work', tone: 'gold' },
      { key: 'cozy', label: 'cozy', tone: 'green' },
    ],
  },
  '30s club no explaining required': {
    blurb: 'grown enough to skip the exposition',
    tags: [
      { key: '30s', label: '30s', tone: 'gold' },
      { key: 'single', label: 'single', tone: 'rose' },
    ],
  },
  'divorced and thriving theoretically': {
    blurb: 'starting over with very strong opinions',
    tags: [
      { key: 'divorced', label: 'divorced', tone: 'lavender' },
      { key: '30s', label: '30s', tone: 'gold' },
    ],
  },
  'gay men who actually cook': {
    blurb: 'recipes, spice levels, and kitchen bragging',
    tags: [{ key: 'food', label: 'food', tone: 'rose' }],
  },
};

function hashString(input: string) {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function dedupeTags(tags: HimRoomTag[]) {
  const unique = new Map<string, HimRoomTag>();
  tags.forEach((tag) => {
    if (!unique.has(tag.key)) {
      unique.set(tag.key, tag);
    }
  });
  return Array.from(unique.values());
}

function makeTag(key: string, label: string, tone: HimRoomTone): HimRoomTag {
  return { key, label, tone };
}

function detectCityLabel(roomName: string) {
  const lowerName = roomName.toLowerCase();
  const match = CITY_LABELS.find((city) => lowerName.includes(city));
  return match ? (match === 'nyc' ? 'nyc' : match) : null;
}

function buildHeuristicTags(roomName: string) {
  const lowerName = roomName.toLowerCase();
  const tags: HimRoomTag[] = [];
  const cityLabel = detectCityLabel(roomName);

  if (cityLabel) {
    tags.push(makeTag('city', cityLabel, 'lavender'));
  }
  if (/\b30s\b|thirties/.test(lowerName)) {
    tags.push(makeTag('30s', '30s', 'gold'));
  }
  if (/\bsingle\b|solo/.test(lowerName)) {
    tags.push(makeTag('single', 'single', 'rose'));
  }
  if (/divorc|starting over/.test(lowerName)) {
    tags.push(makeTag('divorced', 'divorced', 'lavender'));
  }
  if (/cook|food|kitchen|dinner|brunch|snack|recipe/.test(lowerName)) {
    tags.push(makeTag('food', 'food', 'rose'));
  }
  if (/film|movie|cinema|letterboxd|tv|watch/.test(lowerName)) {
    tags.push(makeTag('film', 'film', 'lavender'));
  }
  if (/book|read|poetry|novel/.test(lowerName)) {
    tags.push(makeTag('books', 'books', 'green'));
  }
  if (/work|office|career|desk|couch/.test(lowerName)) {
    tags.push(makeTag('work', 'work', 'gold'));
  }
  if (/cozy|homebody|soft/.test(lowerName)) {
    tags.push(makeTag('cozy', 'cozy', 'green'));
  }
  if (/chaos|chaotic|mess|unhinged/.test(lowerName)) {
    tags.push(makeTag('chaotic', 'chaotic', 'rose'));
  }

  return dedupeTags(tags);
}

function buildHeuristicBlurb(roomName: string, tags: HimRoomTag[]) {
  const tagKeys = new Set(tags.map((tag) => tag.key));

  if (tagKeys.has('city')) {
    return 'local plans & people who already get it';
  }
  if (tagKeys.has('food')) {
    return 'recipes, cravings, and a little flirting';
  }
  if (tagKeys.has('film')) {
    return 'movie opinions with zero shame';
  }
  if (tagKeys.has('books')) {
    return 'reading lists, voice notes, and side quests';
  }
  if (tagKeys.has('30s')) {
    return 'grown energy without the small talk';
  }
  if (tagKeys.has('divorced')) {
    return 'starting over, but hotter and funnier';
  }
  if (tagKeys.has('work')) {
    return 'trying to look productive from the couch';
  }
  if (tagKeys.has('chaotic')) {
    return 'lightly unhinged but emotionally available';
  }

  return `${roomName} is active right now`;
}

export function getHimRoomMeta(roomName: string): HimRoomMeta {
  const normalizedName = normalizeRoomKey(roomName);
  const override = ROOM_META_OVERRIDES[normalizedName];
  const liveCount = 8 + (hashString(normalizedName || roomName) % 37);

  if (override) {
    return {
      ...override,
      tags: dedupeTags(override.tags).slice(0, 3),
      liveCount,
    };
  }

  const tags = buildHeuristicTags(roomName);

  return {
    blurb: buildHeuristicBlurb(roomName, tags),
    tags: (tags.length > 0 ? tags : [makeTag('general', 'all ages', 'ghost')]).slice(0, 3),
    liveCount,
  };
}

export function buildRoomFilterOptions(roomNames: string[]): HimRoomFilterOption[] {
  const byKey = new Map<string, HimRoomFilterOption>();

  roomNames.forEach((roomName) => {
    getHimRoomMeta(roomName).tags.forEach((tag) => {
      byKey.set(tag.key, {
        key: tag.key,
        label: tag.label,
        tone: tag.tone,
      });
    });
  });

  const ordered = Array.from(byKey.values()).sort((left, right) => {
    const leftRank = ROOM_FILTER_ORDER.indexOf(left.key as (typeof ROOM_FILTER_ORDER)[number]);
    const rightRank = ROOM_FILTER_ORDER.indexOf(right.key as (typeof ROOM_FILTER_ORDER)[number]);

    if (leftRank !== -1 || rightRank !== -1) {
      return (leftRank === -1 ? ROOM_FILTER_ORDER.length : leftRank) - (rightRank === -1 ? ROOM_FILTER_ORDER.length : rightRank);
    }

    return left.label.localeCompare(right.label);
  });

  return [{ key: 'all', label: 'all', tone: 'ghost' }, ...ordered];
}
