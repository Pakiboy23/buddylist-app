export const HI_ITS_ME_PATH = '/hi-its-me';
export const SHELL_SECTION_QUERY_KEY = 'tab';

export type ShellSection = 'im' | 'chat' | 'buddy' | 'profile';

export function normalizeShellSection(value: string | null | undefined): ShellSection {
  return value === 'im' || value === 'chat' || value === 'buddy' || value === 'profile' ? value : 'im';
}

export function buildHiItsMePath(options: {
  section?: ShellSection;
  roomName?: string | null;
  dmBuddyId?: string | null;
} = {}) {
  const params = new URLSearchParams();
  const section = options.section ?? 'im';

  if (section !== 'im') {
    params.set(SHELL_SECTION_QUERY_KEY, section);
  }
  if (options.roomName) {
    params.set('room', options.roomName);
  }
  if (options.dmBuddyId) {
    params.set('dm', options.dmBuddyId);
  }

  const query = params.toString();
  return query ? `${HI_ITS_ME_PATH}?${query}` : HI_ITS_ME_PATH;
}
