import { describe, expect, it } from 'vitest';
import { RECOVERY_CODE_MIN_LENGTH, formatRecoveryCodeFromBytes } from '@/lib/recoveryCode';

describe('formatRecoveryCodeFromBytes', () => {
  it('formats uppercase segmented recovery codes', () => {
    expect(formatRecoveryCodeFromBytes(Uint8Array.from([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]))).toBe(
      '000102-030405-060708-090A0B',
    );
  });
});

describe('RECOVERY_CODE_MIN_LENGTH', () => {
  it('keeps recovery codes at a minimum usable length', () => {
    expect(RECOVERY_CODE_MIN_LENGTH).toBe(8);
  });
});
