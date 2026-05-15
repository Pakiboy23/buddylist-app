import { describe, expect, it } from 'vitest';
import {
  MESSAGE_HIDDEN_PLACEHOLDER,
  displayBodyForMessage,
  isObjectionable,
} from './contentModeration';

describe('isObjectionable', () => {
  it('returns false for clean text', () => {
    expect(isObjectionable('hello there, how are you?')).toBe(false);
    expect(isObjectionable('see you tomorrow')).toBe(false);
    expect(isObjectionable('I love bagels')).toBe(false);
  });

  it('returns false for empty / nullish input', () => {
    expect(isObjectionable('')).toBe(false);
    expect(isObjectionable(null)).toBe(false);
    expect(isObjectionable(undefined)).toBe(false);
  });

  it('flags a known slur surrounded by spaces', () => {
    // 'asshole' is in the bad-words list
    expect(isObjectionable('you are an asshole')).toBe(true);
  });

  it('flags case-insensitively', () => {
    expect(isObjectionable('FUCK')).toBe(true);
    expect(isObjectionable('Fuck')).toBe(true);
  });

  it('flags inside rich-text HTML', () => {
    expect(isObjectionable('<b>fuck</b>')).toBe(true);
    expect(isObjectionable('<span style="color:red">shit</span> happens')).toBe(true);
  });

  it('does not match substrings that are not at word boundaries', () => {
    // 'shitake' contains 'shit' as a prefix; word-boundary regex should reject.
    expect(isObjectionable('I love shitake mushrooms')).toBe(false);
    // 'assemble' contains 'ass' as a prefix; reject.
    expect(isObjectionable('Please assemble the team')).toBe(false);
    // 'classic' contains 'ass' internally; reject.
    expect(isObjectionable('a classic move')).toBe(false);
  });

  it('flags when separated by punctuation that still leaves word boundaries', () => {
    expect(isObjectionable('what the fuck.')).toBe(true);
    expect(isObjectionable('go (fuck) yourself')).toBe(true);
  });
});

describe('displayBodyForMessage', () => {
  it('returns the original body when not flagged', () => {
    expect(displayBodyForMessage({ flagged_at: null }, 'hello', false)).toBe('hello');
    expect(displayBodyForMessage({ flagged_at: null }, 'hello', true)).toBe('hello');
  });

  it('returns the placeholder for recipients of flagged messages', () => {
    expect(
      displayBodyForMessage({ flagged_at: '2026-05-15T00:00:00Z' }, 'naughty', false),
    ).toBe(MESSAGE_HIDDEN_PLACEHOLDER);
  });

  it('still shows the original body to the author of a flagged message', () => {
    expect(
      displayBodyForMessage({ flagged_at: '2026-05-15T00:00:00Z' }, 'naughty', true),
    ).toBe('naughty');
  });

  it('treats undefined flagged_at as not flagged', () => {
    expect(displayBodyForMessage({}, 'hello', false)).toBe('hello');
  });
});
