import { NextResponse } from 'next/server';
import { assertAdminUser } from '@/lib/passwordRecovery';
import { createSupabaseAdminClient, getRequestUser } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized.' },
      {
        status: 401,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }

  try {
    const admin = createSupabaseAdminClient();
    const isAdmin = await assertAdminUser(admin, user.id);
    return NextResponse.json(
      { isAdmin },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to check admin status.';
    return NextResponse.json(
      { error: message },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
    );
  }
}
