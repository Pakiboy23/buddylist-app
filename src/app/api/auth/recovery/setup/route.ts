import { createCorsPreflightResponse, jsonWithCors } from '@/lib/apiCors';
import {
  insertPasswordRecoveryAudit,
  upsertRecoveryCodeForUser,
} from '@/lib/passwordRecovery';
import { RECOVERY_CODE_MIN_LENGTH } from '@/lib/recoveryCode';
import { createSupabaseAdminClient, getRequestUser } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
const RECOVERY_SETUP_METHODS = ['POST'];

interface SetupBody {
  recoveryCode?: string;
}

export function OPTIONS(request: Request) {
  return createCorsPreflightResponse(request, RECOVERY_SETUP_METHODS);
}

export async function POST(request: Request) {
  const user = await getRequestUser(request);
  if (!user) {
    return jsonWithCors(request, { error: 'Unauthorized.' }, { status: 401 }, RECOVERY_SETUP_METHODS);
  }

  let body: SetupBody;
  try {
    body = (await request.json()) as SetupBody;
  } catch {
    return jsonWithCors(request, { error: 'Invalid request body.' }, { status: 400 }, RECOVERY_SETUP_METHODS);
  }

  const recoveryCode = typeof body.recoveryCode === 'string' ? body.recoveryCode.trim() : '';
  if (recoveryCode.length < RECOVERY_CODE_MIN_LENGTH) {
    return jsonWithCors(
      request,
      { error: `Recovery code must be at least ${RECOVERY_CODE_MIN_LENGTH} characters.` },
      { status: 400 },
      RECOVERY_SETUP_METHODS,
    );
  }

  try {
    const admin = createSupabaseAdminClient();
    await upsertRecoveryCodeForUser(admin, user.id, recoveryCode, false);
    await insertPasswordRecoveryAudit(admin, 'recovery_code_set', user.id, user.id, {});
    return jsonWithCors(request, { ok: true }, undefined, RECOVERY_SETUP_METHODS);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to set recovery code.';
    return jsonWithCors(request, { error: message }, { status: 500 }, RECOVERY_SETUP_METHODS);
  }
}
