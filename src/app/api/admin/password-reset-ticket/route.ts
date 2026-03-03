import { NextResponse } from 'next/server';
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
import { createSupabaseAdminClient, getRequestUser } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

interface TicketIssueBody {
  screenname?: string;
}

const ADMIN_TICKET_RATE_LIMIT_PREFIX = 'admin_ticket_issue';
const TOO_MANY_ATTEMPTS_MESSAGE = 'Too many attempts. Try again shortly.';

export async function POST(request: Request) {
  const actor = await getRequestUser(request);
  if (!actor) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  let body: TicketIssueBody;
  try {
    body = (await request.json()) as TicketIssueBody;
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 });
  }

  const screennameKey = normalizeScreennameKey(typeof body.screenname === 'string' ? body.screenname : '');
  if (!screennameKey) {
    return NextResponse.json({ error: 'Screen name is required.' }, { status: 400 });
  }

  const ipHash = hashIp(extractClientIp(request));

  try {
    const admin = createSupabaseAdminClient();
    const isAdmin = await assertAdminUser(admin, actor.id);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const attemptScopeKey = `${ADMIN_TICKET_RATE_LIMIT_PREFIX}:${actor.id}:${screennameKey}`;
    const rateLimitStatus = await checkResetAttemptAllowed(admin, attemptScopeKey, ipHash);
    if (!rateLimitStatus.allowed) {
      await insertPasswordRecoveryAudit(admin, 'admin_ticket_issue_rate_limited', actor.id, null, {
        screennameKey,
        ipHash,
        retryAfterSeconds: rateLimitStatus.retryAfterSeconds,
      });
      return NextResponse.json(
        { error: TOO_MANY_ATTEMPTS_MESSAGE, retryAfterSeconds: rateLimitStatus.retryAfterSeconds },
        { status: 429 },
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
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    await clearFailedResetAttempts(admin, attemptScopeKey, ipHash);
    const { ticket, expiresAt } = await issueAdminResetTicket(admin, targetUser.id, actor.id);

    await insertPasswordRecoveryAudit(admin, 'admin_ticket_issued', actor.id, targetUser.id, {
      expiresAt,
      ipHash,
    });

    return NextResponse.json({ ok: true, ticket, expiresAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to issue reset ticket.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
