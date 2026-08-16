import { describe, expect, it } from 'vitest';
import { screennameConfirmationMatches } from './accountDeletion';

describe('screennameConfirmationMatches', () => {
  it('matches exact equality', () => {
    expect(screennameConfirmationMatches('alice', 'alice')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(screennameConfirmationMatches('ALICE', 'alice')).toBe(true);
    expect(screennameConfirmationMatches('Alice', 'aliCE')).toBe(true);
  });

  it('tolerates surrounding whitespace', () => {
    expect(screennameConfirmationMatches('  alice  ', 'alice')).toBe(true);
  });

  it('rejects empty typed input', () => {
    expect(screennameConfirmationMatches('', 'alice')).toBe(false);
    expect(screennameConfirmationMatches('   ', 'alice')).toBe(false);
  });

  it('rejects when expected is missing', () => {
    expect(screennameConfirmationMatches('alice', '')).toBe(false);
    expect(screennameConfirmationMatches('alice', null)).toBe(false);
    expect(screennameConfirmationMatches('alice', undefined)).toBe(false);
  });

  it('rejects mismatched values', () => {
    expect(screennameConfirmationMatches('alic', 'alice')).toBe(false);
    expect(screennameConfirmationMatches('alicee', 'alice')).toBe(false);
    expect(screennameConfirmationMatches('bob', 'alice')).toBe(false);
  });

  it('does not collapse internal whitespace (mismatch stays a mismatch)', () => {
    expect(screennameConfirmationMatches('al ice', 'alice')).toBe(false);
  });

  it('handles null and undefined typed input', () => {
    expect(screennameConfirmationMatches(null, 'alice')).toBe(false);
    expect(screennameConfirmationMatches(undefined, 'alice')).toBe(false);
  });
});
