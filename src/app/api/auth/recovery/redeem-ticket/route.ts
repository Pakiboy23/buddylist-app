import { NextResponse } from 'next/server';
import {
  findUserByScreenname,
  generateRecoveryCode,
  insertPasswordRecoveryAudit,
  isStrongEnoughPassword,
  normalizeScreennameKey,
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

  try {
    const admin = createSupabaseAdminClient();
    const user = await findUserByScreenname(admin, screennameKey);

    if (!user) {
      return NextResponse.json({ error: INVALID_TICKET_MESSAGE }, { status: 401 });
    }

    const redeemedTicketId = await redeemAdminResetTicket(admin, user.id, ticket);
    if (!redeemedTicketId) {
      return NextResponse.json({ error: INVALID_TICKET_MESSAGE }, { status: 401 });
    }

    await updateAuthPassword(admin, user.id, newPassword);
    const nextRecoveryCode = generateRecoveryCode();
    await upsertRecoveryCodeForUser(admin, user.id, nextRecoveryCode, true);
    await insertPasswordRecoveryAudit(admin, 'ticket_redeemed', null, user.id, {
      ticketId: redeemedTicketId,
    });

    return NextResponse.json({ ok: true, nextRecoveryCode });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to redeem ticket.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
