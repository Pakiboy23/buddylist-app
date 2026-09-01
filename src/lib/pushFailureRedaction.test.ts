import { describe, expect, it } from 'vitest';
import { redactPushTokens } from './pushFailureRedaction';

const APNS_TOKEN = '740f4707bebcf74f9b7c25d48e3358945f6aa01da5ddb387462c7eaf61bb78ad';
const FCM_TOKEN = `cXyz9SampleToken:APA91bH${'q'.repeat(120)}`;

describe('redactPushTokens', () => {
  it('removes the device token from an APNs transport error', () => {
    // Shape of a Deno fetch failure: the URL it failed on carries the token.
    const raw = `error sending request for url (https://api.push.apple.com/3/device/${APNS_TOKEN}): connection closed`;
    const out = redactPushTokens(raw);
    expect(out).not.toContain(APNS_TOKEN);
    expect(out).toContain('/3/device/[redacted]');
  });

  it('removes the device token from the sandbox host too', () => {
    const raw = `error sending request for url (https://api.sandbox.push.apple.com/3/device/${APNS_TOKEN})`;
    expect(redactPushTokens(raw)).not.toContain(APNS_TOKEN);
  });

  it('removes an FCM registration token echoed in an error body', () => {
    const raw = JSON.stringify({
      error: { status: 'INVALID_ARGUMENT', message: `The registration token ${FCM_TOKEN} is not valid.` },
    });
    const out = redactPushTokens(raw);
    expect(out).not.toContain(FCM_TOKEN);
    expect(out).toContain('INVALID_ARGUMENT');
  });

  it('leaves an ordinary APNs reason untouched', () => {
    expect(redactPushTokens('BadDeviceToken')).toBe('BadDeviceToken');
  });

  it('leaves uuids readable — they are shorter than a device token', () => {
    const raw = 'row 9f8f18e1-44d3-4708-aa24-cfbf12542a25 not found';
    expect(redactPushTokens(raw)).toBe(raw);
  });
});
