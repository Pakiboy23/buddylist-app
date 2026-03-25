import { describe, expect, it } from 'vitest';
import {
  getProfileSchemaMigrationMessage,
  isProfileSchemaMissingError,
  withProfileSchemaDefaults,
} from '@/lib/profileSchema';

describe('isProfileSchemaMissingError', () => {
  it('matches schema cache errors for new profile columns', () => {
    expect(
      isProfileSchemaMissingError({
        code: 'PGRST204',
        message: "Could not find the 'buddy_icon_path' column of 'users' in the schema cache",
      }),
    ).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(
      isProfileSchemaMissingError({
        code: '23505',
        message: 'duplicate key value violates unique constraint',
      }),
    ).toBe(false);
  });
});

describe('getProfileSchemaMigrationMessage', () => {
  it('references the migration file', () => {
    expect(getProfileSchemaMigrationMessage()).toContain('supabase/presence_profiles.sql');
  });
});

describe('withProfileSchemaDefaults', () => {
  it('fills missing profile schema fields with null', () => {
    expect(
      withProfileSchemaDefaults({
        id: 'user-1',
        screenname: 'Pakiboy23',
      }),
    ).toEqual({
      id: 'user-1',
      screenname: 'Pakiboy23',
      profile_bio: null,
      buddy_icon_path: null,
      idle_since: null,
      last_active_at: null,
    });
  });
});
