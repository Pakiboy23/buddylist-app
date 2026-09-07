import { describe, expect, it } from 'vitest';
import {
  getProfileSchemaMigrationMessage,
  isProfileSchemaMissingError,
  isShowOnlineStatusColumnMissingError,
  stripShowOnlineStatusSelect,
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

describe('show_online_status column helpers', () => {
  it('detects a missing activity-visibility column without treating it as the old profile schema', () => {
    const error = {
      code: 'PGRST204',
      message: "Could not find the 'show_online_status' column of 'users' in the schema cache",
    };
    expect(isShowOnlineStatusColumnMissingError(error)).toBe(true);
    expect(isProfileSchemaMissingError(error)).toBe(false);
  });

  it('strips only the activity-visibility column from a select list', () => {
    expect(stripShowOnlineStatusSelect('id,screenname,show_online_status,last_active_at')).toBe(
      'id,screenname,last_active_at',
    );
  });
});

describe('getProfileSchemaMigrationMessage', () => {
  it('references the migration file', () => {
    expect(getProfileSchemaMigrationMessage()).toContain('supabase/migrations/20260320000011_presence_profiles.sql');
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
      show_online_status: true,
    });
  });

  it('keeps an explicit activity hide', () => {
    expect(
      withProfileSchemaDefaults({
        id: 'user-2',
        screenname: 'appreviewer2026',
        show_online_status: false,
      }),
    ).toMatchObject({
      show_online_status: false,
    });
  });
});
