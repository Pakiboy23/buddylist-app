export function missingOrPlaceholder(value: string | undefined) {
  if (!value) {
    return true;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.startsWith('your-') || normalized.includes('changeme');
}

export function getRequiredEnvValue(name: string) {
  const value = process.env[name];
  return missingOrPlaceholder(value) ? null : value ?? null;
}

export function readNamedEnv<const TEnvMap extends Record<string, string>>(envMap: TEnvMap) {
  const values = Object.fromEntries(
    Object.entries(envMap).map(([key, envName]) => [key, getRequiredEnvValue(envName)]),
  ) as { [TKey in keyof TEnvMap]: string | null };

  const missing = Object.entries(envMap)
    .filter(([key]) => !values[key as keyof TEnvMap])
    .map(([, envName]) => envName);

  return {
    values,
    missing,
  };
}

export const SEEDED_E2E_ENV = {
  supabaseUrl: 'NEXT_PUBLIC_SUPABASE_URL',
  supabaseAnonKey: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  userAScreenname: 'PLAYWRIGHT_USER_A_SCREENNAME',
  userAPassword: 'PLAYWRIGHT_USER_A_PASSWORD',
  userBScreenname: 'PLAYWRIGHT_USER_B_SCREENNAME',
  userBPassword: 'PLAYWRIGHT_USER_B_PASSWORD',
} as const;

export function warnAboutMissingE2EEnv(
  envMap: Record<string, string>,
  {
    label = 'Credential-backed E2E specs will be skipped until these env vars are set',
    logger = console.warn,
  }: {
    label?: string;
    logger?: (message: string) => void;
  } = {},
) {
  const { missing } = readNamedEnv(envMap);
  if (missing.length === 0) {
    return;
  }

  logger(`[playwright] ${label}: ${missing.join(', ')}`);
}
