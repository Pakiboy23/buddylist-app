import {
  checkResetAttemptAllowed,
  clearFailedResetAttempts,
  extractClientIp,
  findUserByScreenname,
  generateRecoveryCode,
  hashIp,
  insertPasswordRecoveryAudit,
  isStrongEnoughPassword,
  normalizeScreennameKey,
  registerFailedResetAttempt,
  upsertRecoveryCodeForUser,
  updateAuthPassword,
  verifyRecoveryCodeForUser,
} from '@/lib/passwordRecovery';
import { createCorsPreflightResponse, jsonWithCors } from '@/lib/apiCors';
import { createSupabaseAdminClient } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
const RECOVERY_RESET_METHODS = ['POST'];

interface ResetBody {
  screenname?: string;
  recoveryCode?: string;
  newPassword?: string;
}

const INVALID_RECOVERY_MESSAGE = 'Invalid screen name or recovery code.';
const TOO_MANY_ATTEMPTS_MESSAGE = 'Too many attempts. Try again shortly.';

export function OPTIONS(request: Request) {
  return createCorsPreflightResponse(request, RECOVERY_RESET_METHODS);
}

export async function POST(request: Request) {
  let body: ResetBody;
  try {
    body = (await request.json()) as ResetBody;
  } catch {
    return jsonWithCors(request, { error: 'Invalid request body.' }, { status: 400 }, RECOVERY_RESET_METHODS);
  }

  const screennameKey = normalizeScreennameKey(typeof body.screenname === 'string' ? body.screenname : '');
  const recoveryCode = typeof body.recoveryCode === 'string' ? body.recoveryCode.trim() : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!screennameKey || !recoveryCode || !newPassword) {
    return jsonWithCors(request, { error: 'Missing required fields.' }, { status: 400 }, RECOVERY_RESET_METHODS);
  }

  if (!isStrongEnoughPassword(newPassword)) {
    return jsonWithCors(
      request,
      { error: 'Password must be between 8 and 128 characters.' },
      { status: 400 },
      RECOVERY_RESET_METHODS,
    );
  }

  const clientIp = extractClientIp(request);
  const ipHash = hashIp(clientIp);

  try {
    const admin = createSupabaseAdminClient();

    const rateLimitStatus = await checkResetAttemptAllowed(admin, screennameKey, ipHash);
    if (!rateLimitStatus.allowed) {
      await insertPasswordRecoveryAudit(admin, 'recovery_reset_rate_limited', null, null, {
        screennameKey,
        ipHash,
        retryAfterSeconds: rateLimitStatus.retryAfterSeconds,
      });
      return jsonWithCors(
        request,
        { error: TOO_MANY_ATTEMPTS_MESSAGE, retryAfterSeconds: rateLimitStatus.retryAfterSeconds },
        { status: 429 },
        RECOVERY_RESET_METHODS,
      );
    }

    const user = await findUserByScreenname(admin, screennameKey);
    if (!user) {
      await registerFailedResetAttempt(admin, screennameKey, ipHash);
      await insertPasswordRecoveryAudit(admin, 'recovery_reset_failed', null, null, {
        reason: 'user_not_found',
        screennameKey,
        ipHash,
      });
      return jsonWithCors(request, { error: INVALID_RECOVERY_MESSAGE }, { status: 401 }, RECOVERY_RESET_METHODS);
    }

    const isValidRecoveryCode = await verifyRecoveryCodeForUser(admin, user.id, recoveryCode);
    if (!isValidRecoveryCode) {
      await registerFailedResetAttempt(admin, screennameKey, ipHash);
      await insertPasswordRecoveryAudit(admin, 'recovery_reset_failed', null, user.id, {
        reason: 'invalid_recovery_code',
        ipHash,
      });
      return jsonWithCors(request, { error: INVALID_RECOVERY_MESSAGE }, { status: 401 }, RECOVERY_RESET_METHODS);
    }

    await clearFailedResetAttempts(admin, screennameKey, ipHash);
    await updateAuthPassword(admin, user.id, newPassword);

    const nextRecoveryCode = generateRecoveryCode();
    await upsertRecoveryCodeForUser(admin, user.id, nextRecoveryCode, true);
    await insertPasswordRecoveryAudit(admin, 'recovery_reset_success', null, user.id, {
      flow: 'self_serve_recovery_code',
      ipHash,
    });

    return jsonWithCors(request, { ok: true, nextRecoveryCode }, undefined, RECOVERY_RESET_METHODS);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reset password.';
    return jsonWithCors(request, { error: message }, { status: 500 }, RECOVERY_RESET_METHODS);
  }
}
