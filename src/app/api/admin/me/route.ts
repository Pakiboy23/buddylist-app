import { createCorsPreflightResponse, jsonWithCors } from '@/lib/apiCors';
import { assertAdminUser } from '@/lib/passwordRecovery';
import { createSupabaseAdminClient, getRequestUser } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const ADMIN_ME_METHODS = ['GET'];

export function OPTIONS(request: Request) {
  return createCorsPreflightResponse(request, ADMIN_ME_METHODS);
}

export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user) {
    return jsonWithCors(
      request,
      { error: 'Unauthorized.' },
      {
        status: 401,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
      ADMIN_ME_METHODS,
    );
  }

  try {
    const admin = createSupabaseAdminClient();
    const isAdmin = await assertAdminUser(admin, user.id);
    return jsonWithCors(
      request,
      { isAdmin },
      {
        headers: {
          'Cache-Control': 'no-store',
        },
      },
      ADMIN_ME_METHODS,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to check admin status.';
    return jsonWithCors(
      request,
      { error: message },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store',
        },
      },
      ADMIN_ME_METHODS,
    );
  }
}
