import { describe, expect, it } from 'vitest';
import { normalizeApplePushPrivateKey } from '@/lib/apnsKey';

describe('normalizeApplePushPrivateKey', () => {
  it('accepts quoted single-line env strings with escaped newlines', () => {
    const input =
      "'-----BEGIN PRIVATE KEY-----\\nabc123\\ndef456\\n-----END PRIVATE KEY-----'";

    expect(normalizeApplePushPrivateKey(input)).toBe(
      '-----BEGIN PRIVATE KEY-----\nabc123\ndef456\n-----END PRIVATE KEY-----',
    );
  });

  it('preserves raw multiline pem values', () => {
    const input = `-----BEGIN PRIVATE KEY-----
abc123
def456
-----END PRIVATE KEY-----`;

    expect(normalizeApplePushPrivateKey(input)).toBe(input);
  });

  it('trims surrounding whitespace', () => {
    const input = `  "-----BEGIN PRIVATE KEY-----\\nabc123\\n-----END PRIVATE KEY-----"  `;

    expect(normalizeApplePushPrivateKey(input)).toBe(
      '-----BEGIN PRIVATE KEY-----\nabc123\n-----END PRIVATE KEY-----',
    );
  });
});
