export const RECOVERY_CODE_MIN_LENGTH = 8;

export function formatRecoveryCodeFromBytes(bytes: ArrayLike<number>) {
  const raw = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  return raw.match(/.{1,6}/g)?.join('-') ?? raw;
}

export function generateClientRecoveryCode() {
  const bytes = new Uint8Array(12);

  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(bytes);
    return formatRecoveryCodeFromBytes(bytes);
  }

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Math.floor(Math.random() * 256);
  }

  return formatRecoveryCodeFromBytes(bytes);
}
