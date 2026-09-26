import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AWAY_MOOD_OPTIONS, getAwayMoodOption, isAwayMoodId } from '@/lib/himArtDirection';

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const IM_PAGE = path.join(REPO_ROOT, 'src', 'app', 'hi-its-me', 'page.tsx');
const JOINED_ROOM_CARD = path.join(REPO_ROOT, 'src', 'components', 'JoinedRoomCard.tsx');
const ART_DIRECTION = path.join(REPO_ROOT, 'src', 'lib', 'himArtDirection.ts');
const CHAT_CONTEXT = path.join(REPO_ROOT, 'src', 'context', 'ChatContext.tsx');
const GLOBALS = path.join(REPO_ROOT, 'src', 'app', 'globals.css');
const ROOMS_V2_LAUNCH = path.join(
  REPO_ROOT,
  'supabase',
  'migrations',
  '20260509184623_rooms_v2_launch_schema.sql',
);

const LATE_NIGHT_DESCRIPTION = 'For the night owls. No judgment.';

describe('joined room cards use seeded catalog copy', () => {
  it('keeps the Late Night launch description distinct from Los Angeles', () => {
    const seed = readFileSync(ROOMS_V2_LAUNCH, 'utf8');
    expect(seed).toMatch(
      new RegExp(
        `\\('late-night',\\s+'Late Night',\\s+'${LATE_NIGHT_DESCRIPTION.replace(/[.]/g, '\\.')}',\\s+'vibe'`,
      ),
    );
    expect(seed).toMatch(/\('la',\s+'Los Angeles',\s+'West Coast vibes, sun and screens\.'/);
  });

  it('renders room.name and room.description and does not guess tags or a live count', () => {
    const page = readFileSync(IM_PAGE, 'utf8');
    const card = readFileSync(JOINED_ROOM_CARD, 'utf8');
    expect(page).toContain('<JoinedRoomCard');
    expect(page).toContain("select('id, slug, name, description')");
    expect(card).toContain('{room.name}');
    expect(card).toContain('const description = room.description.trim()');
    expect(card).toContain('{description}');
    expect(card).toContain('data-room-description={description}');
    const sources = `${page}\n${card}`;
    expect(sources).not.toMatch(/getHimRoomMeta|buildRoomFilterOptions|ui-room-live-pill|ui-room-tag|data-live|active right now|roomFilterTag/);
  });

  it('loads description with joined memberships', () => {
    const chat = readFileSync(CHAT_CONTEXT, 'utf8');
    expect(chat).toContain(".select('room_id, joined_at, rooms(slug, name, description)')");
    expect(chat).toContain('description: room.roomDescription');
  });

  it('deletes the override table, city heuristic, and live-pill styles', () => {
    const art = readFileSync(ART_DIRECTION, 'utf8');
    const css = readFileSync(GLOBALS, 'utf8');

    expect(art).not.toMatch(
      /ROOM_META_OVERRIDES|CITY_LABELS|detectCityLabel|buildHeuristic|getHimRoomMeta|liveCount|includes\(city\)/,
    );
    expect(css).not.toMatch(/ui-room-live-pill|ui-room-live-dot|ui-room-live-blink|ui-room-tag|ui-room-filter-row|data-live/);
    expect(css).toContain('.ui-room-card');
    expect(css).toContain('.ui-room-filter-chip');
  });

  it('keeps away-mood helpers', () => {
    expect(AWAY_MOOD_OPTIONS.map((option) => option.id)).toEqual(['honest', 'chaotic', 'busy', 'cozy', 'out']);
    expect(isAwayMoodId('cozy')).toBe(true);
    expect(isAwayMoodId('late-night')).toBe(false);
    expect(getAwayMoodOption('busy').label).toBe('busy');
    expect(getAwayMoodOption(null).id).toBe('honest');
    expect(getAwayMoodOption(undefined).id).toBe('honest');
  });
});
