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
  redeemAdminResetTicket,
  upsertRecoveryCodeForUser,
  updateAuthPassword,
} from '@/lib/passwordRecovery';
import { createSupabaseAdminClient } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

interface RedeemTicketBody {
  screenname?: string;
  ticket?: string;
  newPassword?: string;
}

const INVALID_TICKET_MESSAGE = 'Invalid screen name or reset ticket.';
const TICKET_FLOW_RATE_LIMIT_PREFIX = 'ticket_redeem';
const TOO_MANY_ATTEMPTS_MESSAGE = 'Too many attempts. Try again shortly.';

export async function POST(request: Request) {
  let body: RedeemTicketBody;
  try {
    body = (await request.json()) as RedeemTicketBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const screennameKey = normalizeScreennameKey(typeof body.screenname === 'string' ? body.screenname : '');
  const ticket = typeof body.ticket === 'string' ? body.ticket.trim() : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!screennameKey || !ticket || !newPassword) {
    return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
  }

  if (!isStrongEnoughPassword(newPassword)) {
    return NextResponse.json({ error: 'Password must be between 8 and 128 characters.' }, { status: 400 });
  }

  const ipHash = hashIp(extractClientIp(request));
  const attemptScopeKey = `${TICKET_FLOW_RATE_LIMIT_PREFIX}:${screennameKey}`;

  try {
    const admin = createSupabaseAdminClient();

    const rateLimitStatus = await checkResetAttemptAllowed(admin, attemptScopeKey, ipHash);
    if (!rateLimitStatus.allowed) {
      await insertPasswordRecoveryAudit(admin, 'ticket_redeem_rate_limited', null, null, {
        screennameKey,
        ipHash,
        retryAfterSeconds: rateLimitStatus.retryAfterSeconds,
      });
      return NextResponse.json(
        { error: TOO_MANY_ATTEMPTS_MESSAGE, retryAfterSeconds: rateLimitStatus.retryAfterSeconds },
        { status: 429 },
      );
    }

    const user = await findUserByScreenname(admin, screennameKey);

    if (!user) {
      await registerFailedResetAttempt(admin, attemptScopeKey, ipHash);
      await insertPasswordRecoveryAudit(admin, 'ticket_redeem_failed', null, null, {
        reason: 'user_not_found',
        screennameKey,
        ipHash,
      });
      return NextResponse.json({ error: INVALID_TICKET_MESSAGE }, { status: 401 });
    }

    const redeemedTicketId = await redeemAdminResetTicket(admin, user.id, ticket);
    if (!redeemedTicketId) {
      await registerFailedResetAttempt(admin, attemptScopeKey, ipHash);
      await insertPasswordRecoveryAudit(admin, 'ticket_redeem_failed', null, user.id, {
        reason: 'invalid_ticket',
        ipHash,
      });
      return NextResponse.json({ error: INVALID_TICKET_MESSAGE }, { status: 401 });
    }

    await clearFailedResetAttempts(admin, attemptScopeKey, ipHash);
    await updateAuthPassword(admin, user.id, newPassword);
    const nextRecoveryCode = generateRecoveryCode();
    await upsertRecoveryCodeForUser(admin, user.id, nextRecoveryCode, true);
    await insertPasswordRecoveryAudit(admin, 'ticket_redeemed', null, user.id, {
      ticketId: redeemedTicketId,
      ipHash,
    });

    return NextResponse.json({ ok: true, nextRecoveryCode });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to redeem ticket.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
