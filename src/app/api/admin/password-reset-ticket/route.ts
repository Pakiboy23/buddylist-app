import { NextResponse } from 'next/server';
import {
  assertAdminUser,
  findUserByScreenname,
  insertPasswordRecoveryAudit,
  issueAdminResetTicket,
  normalizeScreennameKey,
} from '@/lib/passwordRecovery';
import { createSupabaseAdminClient, getRequestUser } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

interface TicketIssueBody {
  screenname?: string;
}

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

  try {
    const admin = createSupabaseAdminClient();
    const isAdmin = await assertAdminUser(admin, actor.id);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const targetUser = await findUserByScreenname(admin, screennameKey);
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const { ticket, expiresAt } = await issueAdminResetTicket(admin, targetUser.id, actor.id);

    await insertPasswordRecoveryAudit(admin, 'admin_ticket_issued', actor.id, targetUser.id, {
      expiresAt,
    });

    return NextResponse.json({ ok: true, ticket, expiresAt });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to issue reset ticket.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
