export const APP_STORE_URL = 'https://apps.apple.com/app/id6761863631';
export const FOUNDER_SCREENNAME = 'Pakiboy24';

export const PORCH_HEADLINE = 'Friends, not dates.';
export const PORCH_LEDE =
  'Your screenname, your status, your people. Seven rooms. A quiet place to talk.';
export const PORCH_ADD_ME = `After you sign in, add ${FOUNDER_SCREENNAME}.`;

export const PORCH_ROOMS: ReadonlyArray<{ name: string; blurb: string }> = [
  { name: 'New York City', blurb: 'The city that never sleeps.' },
  { name: 'Los Angeles', blurb: 'West Coast, sun and screens.' },
  { name: 'Chicago', blurb: 'Chi-town. Our kind of town.' },
  { name: 'Atlanta', blurb: 'ATL forever.' },
  { name: 'Everywhere Else', blurb: 'Not those four? This is your room.' },
  { name: 'Late Night', blurb: 'For the night owls. No judgment.' },
  { name: 'Sunday Reset', blurb: 'Prep, reflect, recharge.' },
];

const FORBIDDEN_PUBLIC_COPY =
  /\b(match|swipe|singles|nearby|flirt|hookup|hot\b|AOL|AIM|buddy list as dating)\b/i;

export function publicCopyIsClean(text: string): boolean {
  return !FORBIDDEN_PUBLIC_COPY.test(text);
}

export function shouldShowWebPorch(input: {
  native: boolean;
  pathname: string;
  search: string;
}): boolean {
  if (input.native) return false;
  const path = (input.pathname.replace(/\/+$/, '') || '/') as string;
  if (path === '/signin') return false;
  if (path !== '/') return false;
  const raw = input.search.startsWith('?') ? input.search.slice(1) : input.search;
  const params = new URLSearchParams(raw);
  if (params.get('signin') === '1') return false;
  return true;
}
