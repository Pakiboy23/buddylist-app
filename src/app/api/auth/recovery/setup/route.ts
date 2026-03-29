import { NextResponse } from 'next/server';
import {
  insertPasswordRecoveryAudit,
  upsertRecoveryCodeForUser,
} from '@/lib/passwordRecovery';
import { RECOVERY_CODE_MIN_LENGTH } from '@/lib/recoveryCode';
import { createSupabaseAdminClient, getRequestUser } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

interface SetupBody {
  recoveryCode?: string;
}

export async function POST(request: Request) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: SetupBody;
  try {
    body = (await request.json()) as SetupBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const recoveryCode = typeof body.recoveryCode === 'string' ? body.recoveryCode.trim() : '';
  if (recoveryCode.length < RECOVERY_CODE_MIN_LENGTH) {
    return NextResponse.json(
      { error: `Recovery code must be at least ${RECOVERY_CODE_MIN_LENGTH} characters.` },
      { status: 400 },
    );
  }

  try {
    const admin = createSupabaseAdminClient();
    await upsertRecoveryCodeForUser(admin, user.id, recoveryCode, false);
    await insertPasswordRecoveryAudit(admin, 'recovery_code_set', user.id, user.id, {});
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to set recovery code.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
