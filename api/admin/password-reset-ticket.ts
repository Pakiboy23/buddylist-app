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

const ALLOWED_METHODS = ['POST'];
const ADMIN_TICKET_RATE_LIMIT_PREFIX = 'admin_ticket_issue';
const TOO_MANY_ATTEMPTS_MESSAGE = 'Too many attempts. Try again shortly.';

interface TicketIssueBody {
  screenname?: string;
}

async function handlePost(request: Request): Promise<Response> {
  const actor = await getRequestUser(request);
  if (!actor) {
    return jsonWithCors(request, { error: 'Unauthorized.' }, { status: 401 }, ALLOWED_METHODS);
  }

  let body: TicketIssueBody;
  try {
    body = (await request.json()) as TicketIssueBody;
  } catch {
    return jsonWithCors(request, { error: 'Invalid request body.' }, { status: 400 }, ALLOWED_METHODS);
  }

  const screennameKey = normalizeScreennameKey(typeof body.screenname === 'string' ? body.screenname : '');
  if (!screennameKey) {
    return jsonWithCors(request, { error: 'Screen name is required.' }, { status: 400 }, ALLOWED_METHODS);
  }

  const ipHash = hashIp(extractClientIp(request));

  try {
    const admin = createSupabaseAdminClient();
    const isAdmin = await assertAdminUser(admin, actor.id);
    if (!isAdmin) {
      return jsonWithCors(request, { error: 'Forbidden.' }, { status: 403 }, ALLOWED_METHODS);
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
        ALLOWED_METHODS,
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
      return jsonWithCors(request, { error: 'User not found.' }, { status: 404 }, ALLOWED_METHODS);
    }

    await clearFailedResetAttempts(admin, attemptScopeKey, ipHash);
    const { ticket, expiresAt } = await issueAdminResetTicket(admin, targetUser.id, actor.id);

    await insertPasswordRecoveryAudit(admin, 'admin_ticket_issued', actor.id, targetUser.id, {
      expiresAt,
      ipHash,
    });

    return jsonWithCors(request, { ok: true, ticket, expiresAt }, undefined, ALLOWED_METHODS);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to issue reset ticket.';
    return jsonWithCors(request, { error: message }, { status: 500 }, ALLOWED_METHODS);
  }
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return createCorsPreflightResponse(request, ALLOWED_METHODS);
  if (request.method === 'POST') return handlePost(request);
  return new Response('Method Not Allowed', { status: 405 });
}
