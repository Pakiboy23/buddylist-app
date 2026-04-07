const PRIMARY_AUTH_DOMAIN = 'hiitsme.app';
const LEGACY_AUTH_DOMAINS = ['buddylist.com'];

function normalizeScreenname(screenname: string) {
  return screenname.trim().toLowerCase();
}

function buildDomainAuthEmail(screenname: string, domain: string) {
  return `${normalizeScreenname(screenname)}@${domain}`;
}

export function getPrimaryAuthEmail(screenname: string) {
  const normalized = normalizeScreenname(screenname);
  if (!normalized) {
    return '';
  }

  if (normalized.includes('@')) {
    return normalized;
  }

  return buildDomainAuthEmail(normalized, PRIMARY_AUTH_DOMAIN);
}

export function getSignInAuthEmailCandidates(screenname: string) {
  const normalized = normalizeScreenname(screenname);
  if (!normalized) {
    return [];
  }

  if (normalized.includes('@')) {
    return [normalized];
  }

  return [PRIMARY_AUTH_DOMAIN, ...LEGACY_AUTH_DOMAINS].map((domain) => buildDomainAuthEmail(normalized, domain));
}

export function isInvalidCredentialsError(message: string) {
  return message.toLowerCase().includes('invalid login credentials');
}
