import { describe, expect, it } from 'vitest';
import { isPushEnvironmentSchemaMissingError } from '@/lib/pushEnvironmentSchema';

describe('isPushEnvironmentSchemaMissingError', () => {
  it('matches PostgREST schema cache errors for push_environment', () => {
    expect(
      isPushEnvironmentSchemaMissingError({
        code: 'PGRST204',
        message: "Could not find the 'push_environment' column of 'user_push_tokens' in the schema cache",
      }),
    ).toBe(true);
  });

  it('matches relation column missing errors', () => {
    expect(
      isPushEnvironmentSchemaMissingError({
        message: 'column "push_environment" of relation "user_push_tokens" does not exist',
      }),
    ).toBe(true);
  });

  it('ignores unrelated errors', () => {
    expect(
      isPushEnvironmentSchemaMissingError({
        code: 'PGRST116',
        message: 'The result contains 0 rows',
      }),
    ).toBe(false);
  });
});
