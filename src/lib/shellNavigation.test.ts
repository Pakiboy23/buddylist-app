import { describe, expect, it } from 'vitest';
import { buildHiItsMePath, normalizeShellSection } from '@/lib/shellNavigation';

describe('normalizeShellSection', () => {
  it('defaults unknown and missing tabs to the presence-first buddy list', () => {
    expect(normalizeShellSection(null)).toBe('im');
    expect(normalizeShellSection(undefined)).toBe('im');
    expect(normalizeShellSection('unknown')).toBe('im');
  });

  it.each(['im', 'chat', 'buddy', 'profile'] as const)('keeps the %s tab', (section) => {
    expect(normalizeShellSection(section)).toBe(section);
  });
});

describe('buildHiItsMePath', () => {
  it('uses the buddy list as the clean root route', () => {
    expect(buildHiItsMePath()).toBe('/hi-its-me');
    expect(buildHiItsMePath({ section: 'im' })).toBe('/hi-its-me');
  });

  it('keeps secondary destinations explicit and deep-linkable', () => {
    expect(buildHiItsMePath({ section: 'chat' })).toBe('/hi-its-me?tab=chat');
    expect(buildHiItsMePath({ section: 'buddy' })).toBe('/hi-its-me?tab=buddy');
    expect(buildHiItsMePath({ section: 'profile' })).toBe('/hi-its-me?tab=profile');
  });

  it('preserves room and direct-message deep links', () => {
    expect(buildHiItsMePath({ section: 'chat', roomName: 'south-asian-creatives' })).toBe(
      '/hi-its-me?tab=chat&room=south-asian-creatives',
    );
    expect(buildHiItsMePath({ section: 'im', dmBuddyId: 'buddy-123' })).toBe('/hi-its-me?dm=buddy-123');
  });
});
