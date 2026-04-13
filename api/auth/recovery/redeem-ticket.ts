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
import { createCorsPreflightResponse, jsonWithCors } from '@/lib/apiCors';
import { createSupabaseAdminClient } from '@/lib/supabaseServer';

const ALLOWED_METHODS = ['POST'];
const INVALID_TICKET_MESSAGE =
  'Invalid screen name or reset ticket. If a newer admin ticket was issued, older tickets are revoked.';
const TICKET_FLOW_RATE_LIMIT_PREFIX = 'ticket_redeem';
const TOO_MANY_ATTEMPTS_MESSAGE = 'Too many attempts. Try again shortly.';

interface RedeemTicketBody {
  screenname?: string;
  ticket?: string;
  newPassword?: string;
}

async function handlePost(request: Request): Promise<Response> {
  let body: RedeemTicketBody;
  try {
    body = (await request.json()) as RedeemTicketBody;
  } catch {
    return jsonWithCors(request, { error: 'Invalid request body.' }, { status: 400 }, ALLOWED_METHODS);
  }

  const screennameKey = normalizeScreennameKey(typeof body.screenname === 'string' ? body.screenname : '');
  const ticket = typeof body.ticket === 'string' ? body.ticket.trim() : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!screennameKey || !ticket || !newPassword) {
    return jsonWithCors(request, { error: 'Missing required fields.' }, { status: 400 }, ALLOWED_METHODS);
  }

  if (!isStrongEnoughPassword(newPassword)) {
    return jsonWithCors(
      request,
      { error: 'Password must be between 8 and 128 characters.' },
      { status: 400 },
      ALLOWED_METHODS,
    );
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
      return jsonWithCors(
        request,
        { error: TOO_MANY_ATTEMPTS_MESSAGE, retryAfterSeconds: rateLimitStatus.retryAfterSeconds },
        { status: 429 },
        ALLOWED_METHODS,
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
      return jsonWithCors(request, { error: INVALID_TICKET_MESSAGE }, { status: 401 }, ALLOWED_METHODS);
    }

    const redeemedTicketId = await redeemAdminResetTicket(admin, user.id, ticket);
    if (!redeemedTicketId) {
      await registerFailedResetAttempt(admin, attemptScopeKey, ipHash);
      await insertPasswordRecoveryAudit(admin, 'ticket_redeem_failed', null, user.id, {
        reason: 'invalid_ticket',
        ipHash,
      });
      return jsonWithCors(request, { error: INVALID_TICKET_MESSAGE }, { status: 401 }, ALLOWED_METHODS);
    }

    await clearFailedResetAttempts(admin, attemptScopeKey, ipHash);
    await updateAuthPassword(admin, user.id, newPassword);
    const nextRecoveryCode = generateRecoveryCode();
    await upsertRecoveryCodeForUser(admin, user.id, nextRecoveryCode, true);
    await insertPasswordRecoveryAudit(admin, 'ticket_redeemed', null, user.id, {
      ticketId: redeemedTicketId,
      ipHash,
    });

    return jsonWithCors(request, { ok: true, nextRecoveryCode }, undefined, ALLOWED_METHODS);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to redeem ticket.';
    return jsonWithCors(request, { error: message }, { status: 500 }, ALLOWED_METHODS);
  }
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return createCorsPreflightResponse(request, ALLOWED_METHODS);
  if (request.method === 'POST') return handlePost(request);
  return new Response('Method Not Allowed', { status: 405 });
}
