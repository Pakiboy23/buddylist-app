import { NextResponse } from 'next/server';
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
import { createSupabaseAdminClient } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

interface ResetBody {
  screenname?: string;
  recoveryCode?: string;
  newPassword?: string;
}

const INVALID_RECOVERY_MESSAGE = 'Invalid screen name or recovery code.';

export async function POST(request: Request) {
  let body: ResetBody;
  try {
    body = (await request.json()) as ResetBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const screennameKey = normalizeScreennameKey(typeof body.screenname === 'string' ? body.screenname : '');
  const recoveryCode = typeof body.recoveryCode === 'string' ? body.recoveryCode.trim() : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!screennameKey || !recoveryCode || !newPassword) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
  }

  if (!isStrongEnoughPassword(newPassword)) {
    return NextResponse.json({ error: 'Password must be between 8 and 128 characters.' }, { status: 400 });
  }

  const clientIp = extractClientIp(request);
  const ipHash = hashIp(clientIp);

  try {
    const admin = createSupabaseAdminClient();

    const rateLimitStatus = await checkResetAttemptAllowed(admin, screennameKey, ipHash);
    if (!rateLimitStatus.allowed) {
      return NextResponse.json(
        { error: 'Too many attempts. Try again shortly.', retryAfterSeconds: rateLimitStatus.retryAfterSeconds },
        { status: 429 },
      );
    }

    const user = await findUserByScreenname(admin, screennameKey);
    if (!user) {
      await registerFailedResetAttempt(admin, screennameKey, ipHash);
      return NextResponse.json({ error: INVALID_RECOVERY_MESSAGE }, { status: 401 });
    }

    const isValidRecoveryCode = await verifyRecoveryCodeForUser(admin, user.id, recoveryCode);
    if (!isValidRecoveryCode) {
      await registerFailedResetAttempt(admin, screennameKey, ipHash);
      return NextResponse.json({ error: INVALID_RECOVERY_MESSAGE }, { status: 401 });
    }

    await clearFailedResetAttempts(admin, screennameKey, ipHash);
    await updateAuthPassword(admin, user.id, newPassword);

    const nextRecoveryCode = generateRecoveryCode();
    await upsertRecoveryCodeForUser(admin, user.id, nextRecoveryCode, true);
    await insertPasswordRecoveryAudit(admin, 'recovery_reset_success', null, user.id, {
      flow: 'self_serve_recovery_code',
      ipHash,
    });

    return NextResponse.json({ ok: true, nextRecoveryCode });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reset password.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
