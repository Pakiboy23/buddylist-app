import { afterEach, describe, expect, it, vi } from 'vitest';
import { isEuTimezone } from './euTimezone';

function mockTimezone(tz: string) {
  vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
    resolvedOptions: () => ({ timeZone: tz, locale: 'en' }),
    format: () => '',
    formatRange: () => '',
    formatRangeToParts: () => [],
    formatToParts: () => [],
  } as unknown as Intl.DateTimeFormat);
}

describe('isEuTimezone', () => {
  afterEach(() => vi.restoreAllMocks());

  it('returns true for EU capital timezones', () => {
    const cases = [
      'Europe/Berlin',
      'Europe/Paris',
      'Europe/Warsaw',
      'Europe/Rome',
      'Europe/Amsterdam',
      'Europe/Madrid',
      'Europe/Stockholm',
      'Europe/Athens',
      'Europe/Vienna',
      'Europe/Zagreb',
    ];
    for (const tz of cases) {
      mockTimezone(tz);
      expect(isEuTimezone(), `${tz} should be EU`).toBe(true);
    }
  });

  it('returns true for EEA non-EU members', () => {
    for (const tz of ['Europe/Oslo', 'Europe/Reykjavik', 'Europe/Vaduz']) {
      mockTimezone(tz);
      expect(isEuTimezone(), `${tz} should be EEA`).toBe(true);
    }
  });

  it('returns true for UK', () => {
    mockTimezone('Europe/London');
    expect(isEuTimezone()).toBe(true);
  });

  it('returns true for EU overseas territories', () => {
    for (const tz of ['Atlantic/Azores', 'Atlantic/Canary', 'Atlantic/Madeira', 'Africa/Ceuta']) {
      mockTimezone(tz);
      expect(isEuTimezone(), `${tz} should be EU territory`).toBe(true);
    }
  });

  it('returns true for Switzerland (nFADP)', () => {
    mockTimezone('Europe/Zurich');
    expect(isEuTimezone()).toBe(true);
  });

  it('returns false for US timezones', () => {
    for (const tz of ['America/New_York', 'America/Los_Angeles', 'America/Chicago', 'America/Denver']) {
      mockTimezone(tz);
      expect(isEuTimezone(), `${tz} should not trigger banner`).toBe(false);
    }
  });

  it('returns false for Asian timezones', () => {
    for (const tz of ['Asia/Tokyo', 'Asia/Kolkata', 'Asia/Shanghai', 'Asia/Singapore']) {
      mockTimezone(tz);
      expect(isEuTimezone(), `${tz} should not trigger banner`).toBe(false);
    }
  });

  it('returns false for non-EEA European countries', () => {
    for (const tz of ['Europe/Moscow', 'Europe/Kiev', 'Europe/Minsk', 'Europe/Istanbul']) {
      mockTimezone(tz);
      expect(isEuTimezone(), `${tz} should not trigger banner`).toBe(false);
    }
  });

  it('returns false for other non-EU regions', () => {
    for (const tz of ['Australia/Sydney', 'America/Toronto', 'Pacific/Auckland', 'Africa/Cairo']) {
      mockTimezone(tz);
      expect(isEuTimezone(), `${tz} should not trigger banner`).toBe(false);
    }
  });

  it('returns false when Intl throws', () => {
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
      throw new Error('Intl unavailable');
    });
    expect(isEuTimezone()).toBe(false);
  });
});
