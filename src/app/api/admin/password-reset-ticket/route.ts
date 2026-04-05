import {
  assertAdminUser,
  checkResetAttemptAllowed,
  clearFailedResetAttempts,
  extractClientIp,
  findUserByScreenname,
  hashIp,
  insertPasswordRecoveryAudit,
  issueAdminResetTicket,
  normalizeScreennameKey,
  registerFailedResetAttempt,
} from '@/lib/passwordRecovery';
import { createCorsPreflightResponse, jsonWithCors } from '@/lib/apiCors';
import { createSupabaseAdminClient, getRequestUser } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
const PASSWORD_RESET_TICKET_METHODS = ['POST'];

interface TicketIssueBody {
  screenname?: string;
}

const ADMIN_TICKET_RATE_LIMIT_PREFIX = 'admin_ticket_issue';
const TOO_MANY_ATTEMPTS_MESSAGE = 'Too many attempts. Try again shortly.';

export function OPTIONS(request: Request) {
  return createCorsPreflightResponse(request, PASSWORD_RESET_TICKET_METHODS);
}

export async function POST(request: Request) {
  const actor = await getRequestUser(request);
  if (!actor) {
    return jsonWithCors(request, { error: 'Unauthorized.' }, { status: 401 }, PASSWORD_RESET_TICKET_METHODS);
  }

  let body: TicketIssueBody;
  try {
    body = (await request.json()) as TicketIssueBody;
  } catch {
    return jsonWithCors(
      request,
      { error: 'Invalid request body.' },
      { status: 400 },
      PASSWORD_RESET_TICKET_METHODS,
    );
  }

  const screennameKey = normalizeScreennameKey(typeof body.screenname === 'string' ? body.screenname : '');
  if (!screennameKey) {
    return jsonWithCors(
      request,
      { error: 'Screen name is required.' },
      { status: 400 },
      PASSWORD_RESET_TICKET_METHODS,
    );
  }

  const ipHash = hashIp(extractClientIp(request));

  try {
    const admin = createSupabaseAdminClient();
    const isAdmin = await assertAdminUser(admin, actor.id);
    if (!isAdmin) {
      return jsonWithCors(request, { error: 'Forbidden.' }, { status: 403 }, PASSWORD_RESET_TICKET_METHODS);
    }

    const attemptScopeKey = `${ADMIN_TICKET_RATE_LIMIT_PREFIX}:${actor.id}:${screennameKey}`;
    const rateLimitStatus = await checkResetAttemptAllowed(admin, attemptScopeKey, ipHash);
    if (!rateLimitStatus.allowed) {
      await insertPasswordRecoveryAudit(admin, 'admin_ticket_issue_rate_limited', actor.id, null, {
        screennameKey,
        ipHash,
        retryAfterSeconds: rateLimitStatus.retryAfterSeconds,
      });
      return jsonWithCors(
        request,
        { error: TOO_MANY_ATTEMPTS_MESSAGE, retryAfterSeconds: rateLimitStatus.retryAfterSeconds },
        { status: 429 },
        PASSWORD_RESET_TICKET_METHODS,
      );
    }

    const targetUser = await findUserByScreenname(admin, screennameKey);
    if (!targetUser) {
      await registerFailedResetAttempt(admin, attemptScopeKey, ipHash);
      await insertPasswordRecoveryAudit(admin, 'admin_ticket_issue_failed', actor.id, null, {
        reason: 'user_not_found',
        screennameKey,
        ipHash,
      });
      return jsonWithCors(request, { error: 'User not found.' }, { status: 404 }, PASSWORD_RESET_TICKET_METHODS);
    }

    await clearFailedResetAttempts(admin, attemptScopeKey, ipHash);
    const { ticket, expiresAt } = await issueAdminResetTicket(admin, targetUser.id, actor.id);

    await insertPasswordRecoveryAudit(admin, 'admin_ticket_issued', actor.id, targetUser.id, {
      expiresAt,
      ipHash,
    });

    return jsonWithCors(request, { ok: true, ticket, expiresAt }, undefined, PASSWORD_RESET_TICKET_METHODS);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to issue reset ticket.';
    return jsonWithCors(request, { error: message }, { status: 500 }, PASSWORD_RESET_TICKET_METHODS);
  }
}
