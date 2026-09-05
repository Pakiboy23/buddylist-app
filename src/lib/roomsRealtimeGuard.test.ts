import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const MIGRATIONS_DIR = path.resolve(__dirname, '..', '..', 'supabase', 'migrations');

const ROOMS_V2_LAUNCH = '20260509184623_rooms_v2_launch_schema.sql';

function readMigrationsAfterRoomsV2(): string {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith('.sql') && name > ROOMS_V2_LAUNCH)
    .sort()
    .map((name) => readFileSync(path.join(MIGRATIONS_DIR, name), 'utf-8'))
    .join('\n');
}

describe('rooms v2 realtime publication', () => {
  it('re-publishes room_memberships after the v2 rename, so invites reach an open app', () => {
    const sql = readMigrationsAfterRoomsV2();
    expect(sql).toMatch(/alter publication supabase_realtime add table public\.room_memberships/);
  });

  it('re-publishes rooms-v2 room_messages after the archive rename', () => {
    const sql = readMigrationsAfterRoomsV2();
    expect(sql).toMatch(/alter publication supabase_realtime add table public\.room_messages/);
  });
});
