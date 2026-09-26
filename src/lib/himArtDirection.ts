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
