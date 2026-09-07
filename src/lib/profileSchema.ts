export const SHOW_ONLINE_STATUS_COLUMN = 'show_online_status' as const;
export const EXTENDED_USER_PROFILE_SELECT_FIELDS =
  'id,screenname,status,away_message,status_msg,profile_bio,buddy_icon_path,idle_since,last_active_at,show_online_status';
export const EXTENDED_USER_PROFILE_WITH_EMAIL_SELECT_FIELDS =
  'id,email,screenname,status,away_message,status_msg,profile_bio,buddy_icon_path,idle_since,last_active_at,show_online_status';
export const LEGACY_USER_PROFILE_SELECT_FIELDS = 'id,screenname,status,away_message,status_msg';
export const LEGACY_USER_PROFILE_WITH_EMAIL_SELECT_FIELDS = 'id,email,screenname,status,away_message,status_msg';
export const EXTENDED_ROOM_PROFILE_SELECT_FIELDS = 'id,screenname,buddy_icon_path';
export const LEGACY_ROOM_PROFILE_SELECT_FIELDS = 'id,screenname';

const PROFILE_SCHEMA_MIGRATION_PATH = 'supabase/migrations/20260320000011_presence_profiles.sql';
const PROFILE_SCHEMA_COLUMNS = ['profile_bio', 'buddy_icon_path', 'idle_since', 'last_active_at'] as const;

interface SupabaseLikeError {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message?: string | null;
}

interface ProfileSchemaFields {
  buddy_icon_path: string | null;
  idle_since: string | null;
  last_active_at: string | null;
  profile_bio: string | null;
  show_online_status: boolean;
}

function toNullableString(value: unknown) {
  return typeof value === 'string' ? value : null;
}

export function isProfileSchemaMissingError(error: SupabaseLikeError | null | undefined) {
  if (!error) {
    return false;
  }

  const combinedMessage = [error.code, error.message, error.details, error.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!combinedMessage.includes("column of 'users'") || !combinedMessage.includes('schema cache')) {
    return false;
  }

  return PROFILE_SCHEMA_COLUMNS.some((column) => combinedMessage.includes(`'${column}'`));
}

export function isShowOnlineStatusColumnMissingError(error: SupabaseLikeError | null | undefined) {
  if (!error) {
    return false;
  }

  const combinedMessage = [error.code, error.message, error.details, error.hint]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return combinedMessage.includes(SHOW_ONLINE_STATUS_COLUMN);
}

export function stripShowOnlineStatusSelect(fields: string) {
  return fields
    .split(',')
    .map((field) => field.trim())
    .filter((field) => field && field !== SHOW_ONLINE_STATUS_COLUMN)
    .join(',');
}

export function getProfileSchemaMigrationMessage(feature = 'Profile upgrades') {
  return `${feature} need the database migration in ${PROFILE_SCHEMA_MIGRATION_PATH}. Buddy icons, bios, and idle sync stay off until it is applied.`;
}

export function withProfileSchemaDefaults<T extends object>(
  profile: T | null | undefined,
): (T & ProfileSchemaFields) | null {
  if (!profile) {
    return null;
  }

  const candidate = profile as T & Partial<ProfileSchemaFields>;
  return {
    ...profile,
    profile_bio: toNullableString(candidate.profile_bio),
    buddy_icon_path: toNullableString(candidate.buddy_icon_path),
    idle_since: toNullableString(candidate.idle_since),
    last_active_at: toNullableString(candidate.last_active_at),
    show_online_status: candidate.show_online_status !== false,
  };
}

export function withProfileSchemaDefaultsList<T extends object>(profiles: T[] | null | undefined) {
  return (profiles ?? [])
    .map((profile) => withProfileSchemaDefaults(profile))
    .filter((profile): profile is T & ProfileSchemaFields => profile !== null);
}
