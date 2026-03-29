import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatRecoveryCodeFromBytes } from '@/lib/recoveryCode';

export const PASSWORD_RESET_MAX_ATTEMPTS = 5;
export const PASSWORD_RESET_WINDOW_MINUTES = 15;
export const ADMIN_TICKET_TTL_MINUTES = 30;

type SupabaseAdminClient = SupabaseClient;

interface UserLookup {
  id: string;
  screenname: string | null;
}

interface RecoveryCodeRow {
  code_hash: string;
  code_salt: string;
}

interface ResetAttemptRow {
  screenname_key: string;
  ip_hash: string;
  attempt_count: number;
  window_started_at: string;
  locked_until: string | null;
}

interface TicketRow {
  id: string;
  ticket_hash: string;
  ticket_salt: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
}

export function normalizeScreennameKey(screenname: string) {
  return screenname.trim().toLowerCase();
}

function normalizeSecret(secret: string) {
  return secret.trim().toUpperCase().replace(/[\s-]/g, '');
}

function makeSalt() {
  return randomBytes(16).toString('hex');
}

function hashSecret(secret: string, salt: string) {
  return scryptSync(normalizeSecret(secret), salt, 64).toString('hex');
}

function verifySecret(secret: string, salt: string, expectedHash: string) {
  const computed = Buffer.from(hashSecret(secret, salt), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  if (computed.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(computed, expected);
}

export function generateRecoveryCode() {
  return formatRecoveryCodeFromBytes(randomBytes(12));
}

export function generateAdminResetTicket() {
  const raw = randomBytes(16).toString('hex').toUpperCase();
  const segmented = raw.match(/.{1,4}/g)?.join('-') ?? raw;
  return `TKT-${segmented}`;
}

export function isStrongEnoughPassword(password: string) {
  return password.length >= 8 && password.length <= 128;
}

export function extractClientIp(request: Request) {
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) {
    return cfIp.trim();
  }

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0]?.trim() || 'unknown';
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  return 'unknown';
}

export function hashIp(ip: string) {
  return createHash('sha256').update(ip).digest('hex');
}

function minutesFromNow(minutes: number) {
  const date = new Date(Date.now() + minutes * 60 * 1000);
  return date.toISOString();
}

function isWindowExpired(windowStartedAtIso: string, windowMinutes: number) {
  const startedAt = new Date(windowStartedAtIso).getTime();
  if (Number.isNaN(startedAt)) {
    return true;
  }
  const windowMs = windowMinutes * 60 * 1000;
  return Date.now() - startedAt >= windowMs;
}

export async function findUserByScreenname(
  admin: SupabaseAdminClient,
  screennameKey: string,
): Promise<UserLookup | null> {
  const { data, error } = await admin
    .from('users')
    .select('id,screenname')
    .ilike('screenname', screennameKey)
    .limit(5);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as UserLookup[];
  const exact = rows.find((row) => normalizeScreennameKey(row.screenname ?? '') === screennameKey);
  return exact ?? null;
}

export async function upsertRecoveryCodeForUser(
  admin: SupabaseAdminClient,
  userId: string,
  plainCode: string,
  rotated: boolean,
) {
  const salt = makeSalt();
  const hash = hashSecret(plainCode, salt);
  const nowIso = new Date().toISOString();

  const { error } = await admin.from('account_recovery_codes').upsert(
    {
      user_id: userId,
      code_hash: hash,
      code_salt: salt,
      updated_at: nowIso,
      rotated_at: rotated ? nowIso : null,
    },
    { onConflict: 'user_id' },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function verifyRecoveryCodeForUser(
  admin: SupabaseAdminClient,
  userId: string,
  providedCode: string,
) {
  const { data, error } = await admin
    .from('account_recovery_codes')
    .select('code_hash,code_salt')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return false;
  }

  const row = data as RecoveryCodeRow;
  return verifySecret(providedCode, row.code_salt, row.code_hash);
}

export async function clearFailedResetAttempts(
  admin: SupabaseAdminClient,
  screennameKey: string,
  ipHash: string,
) {
  const { error } = await admin
    .from('password_reset_attempts')
    .delete()
    .eq('screenname_key', screennameKey)
    .eq('ip_hash', ipHash);

  if (error) {
    throw new Error(error.message);
  }
}

export async function checkResetAttemptAllowed(
  admin: SupabaseAdminClient,
  screennameKey: string,
  ipHash: string,
): Promise<{ allowed: true } | { allowed: false; retryAfterSeconds: number }> {
  const { data, error } = await admin
    .from('password_reset_attempts')
    .select('screenname_key,ip_hash,attempt_count,window_started_at,locked_until')
    .eq('screenname_key', screennameKey)
    .eq('ip_hash', ipHash)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return { allowed: true };
  }

  const row = data as ResetAttemptRow;
  if (row.locked_until) {
    const lockedUntilMs = new Date(row.locked_until).getTime();
    if (!Number.isNaN(lockedUntilMs) && lockedUntilMs > Date.now()) {
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil((lockedUntilMs - Date.now()) / 1000)),
      };
    }
  }

  if (isWindowExpired(row.window_started_at, PASSWORD_RESET_WINDOW_MINUTES)) {
    const nowIso = new Date().toISOString();
    const { error: resetError } = await admin.from('password_reset_attempts').upsert(
      {
        screenname_key: screennameKey,
        ip_hash: ipHash,
        attempt_count: 0,
        window_started_at: nowIso,
        locked_until: null,
        updated_at: nowIso,
      },
      { onConflict: 'screenname_key,ip_hash' },
    );

    if (resetError) {
      throw new Error(resetError.message);
    }
  }

  return { allowed: true };
}

export async function registerFailedResetAttempt(
  admin: SupabaseAdminClient,
  screennameKey: string,
  ipHash: string,
) {
  const { data, error } = await admin
    .from('password_reset_attempts')
    .select('screenname_key,ip_hash,attempt_count,window_started_at,locked_until')
    .eq('screenname_key', screennameKey)
    .eq('ip_hash', ipHash)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const nowIso = new Date().toISOString();
  let nextAttemptCount = 1;
  let windowStartedAt = nowIso;

  if (data) {
    const row = data as ResetAttemptRow;
    if (!isWindowExpired(row.window_started_at, PASSWORD_RESET_WINDOW_MINUTES)) {
      nextAttemptCount = (row.attempt_count ?? 0) + 1;
      windowStartedAt = row.window_started_at;
    }
  }

  const shouldLock = nextAttemptCount >= PASSWORD_RESET_MAX_ATTEMPTS;
  const lockedUntil = shouldLock ? minutesFromNow(PASSWORD_RESET_WINDOW_MINUTES) : null;

  const { error: upsertError } = await admin.from('password_reset_attempts').upsert(
    {
      screenname_key: screennameKey,
      ip_hash: ipHash,
      attempt_count: nextAttemptCount,
      window_started_at: windowStartedAt,
      locked_until: lockedUntil,
      updated_at: nowIso,
    },
    { onConflict: 'screenname_key,ip_hash' },
  );

  if (upsertError) {
    throw new Error(upsertError.message);
  }
}

export async function assertAdminUser(admin: SupabaseAdminClient, userId: string) {
  const { data, error } = await admin.from('admin_users').select('user_id').eq('user_id', userId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function issueAdminResetTicket(
  admin: SupabaseAdminClient,
  userId: string,
  issuedByUserId: string,
) {
  const ticket = generateAdminResetTicket();
  const ticketSalt = makeSalt();
  const ticketHash = hashSecret(ticket, ticketSalt);
  const nowIso = new Date().toISOString();
  const expiresAt = minutesFromNow(ADMIN_TICKET_TTL_MINUTES);

  const { error: revokeError } = await admin
    .from('password_reset_tickets')
    .update({ revoked_at: nowIso })
    .eq('user_id', userId)
    .is('used_at', null)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .select('id');

  if (revokeError) {
    throw new Error(revokeError.message);
  }

  const { error } = await admin.from('password_reset_tickets').insert({
    user_id: userId,
    issued_by: issuedByUserId,
    ticket_hash: ticketHash,
    ticket_salt: ticketSalt,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(error.message);
  }

  return { ticket, expiresAt };
}

export async function redeemAdminResetTicket(
  admin: SupabaseAdminClient,
  userId: string,
  providedTicket: string,
) {
  const nowIso = new Date().toISOString();
  const { data, error } = await admin
    .from('password_reset_tickets')
    .select('id,ticket_hash,ticket_salt,expires_at,used_at,revoked_at')
    .eq('user_id', userId)
    .is('used_at', null)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .limit(20);

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as TicketRow[];
  const matched = rows.find((row) => verifySecret(providedTicket, row.ticket_salt, row.ticket_hash));
  if (!matched) {
    return null;
  }

  const { data: consumedRow, error: consumeError } = await admin
    .from('password_reset_tickets')
    .update({ used_at: nowIso })
    .eq('id', matched.id)
    .is('used_at', null)
    .is('revoked_at', null)
    .gt('expires_at', nowIso)
    .select('id');

  if (consumeError) {
    throw new Error(consumeError.message);
  }

  if (!Array.isArray(consumedRow) || consumedRow.length === 0) {
    return null;
  }

  return matched.id;
}

export async function updateAuthPassword(admin: SupabaseAdminClient, userId: string, newPassword: string) {
  const { error } = await admin.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) {
    throw new Error(error.message);
  }
}

export async function insertPasswordRecoveryAudit(
  admin: SupabaseAdminClient,
  eventType: string,
  actorUserId: string | null,
  targetUserId: string | null,
  metadata: Record<string, unknown>,
) {
  const { error } = await admin.from('password_reset_audit').insert({
    event_type: eventType,
    actor_user_id: actorUserId,
    target_user_id: targetUserId,
    metadata,
  });

  if (error) {
    console.error('Failed to write password_reset_audit:', error.message);
  }
}
