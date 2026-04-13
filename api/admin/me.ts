import { createCorsPreflightResponse, jsonWithCors } from '@/lib/apiCors';
import { assertAdminUser } from '@/lib/passwordRecovery';
import { createSupabaseAdminClient, getRequestUser } from '@/lib/supabaseServer';

const ALLOWED_METHODS = ['GET'];

async function handleGet(request: Request): Promise<Response> {
  const user = await getRequestUser(request);
  if (!user) {
    return jsonWithCors(
      request,
      { error: 'Unauthorized.' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } },
      ALLOWED_METHODS,
    );
  }

  try {
    const admin = createSupabaseAdminClient();
    const isAdmin = await assertAdminUser(admin, user.id);
    return jsonWithCors(
      request,
      { isAdmin },
      { headers: { 'Cache-Control': 'no-store' } },
      ALLOWED_METHODS,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to check admin status.';
    return jsonWithCors(
      request,
      { error: message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
      ALLOWED_METHODS,
    );
  }
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return createCorsPreflightResponse(request, ALLOWED_METHODS);
  }
  if (request.method === 'GET') {
    return handleGet(request);
  }
  return new Response('Method Not Allowed', { status: 405 });
}
