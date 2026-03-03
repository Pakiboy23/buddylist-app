import { NextResponse } from 'next/server';
import { assertAdminUser } from '@/lib/passwordRecovery';
import { createSupabaseAdminClient, getRequestUser } from '@/lib/supabaseServer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface PasswordResetAuditRow {
  id: number;
  event_type: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface UserScreennameRow {
  id: string;
  screenname: string | null;
}

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 50;

function parseLimit(rawLimit: string | null) {
  if (!rawLimit) {
    return DEFAULT_LIMIT;
  }

  const parsed = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }

  return Math.min(parsed, MAX_LIMIT);
}

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store',
};

export async function GET(request: Request) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const limit = parseLimit(new URL(request.url).searchParams.get('limit'));

  try {
    const admin = createSupabaseAdminClient();
    const isAdmin = await assertAdminUser(admin, user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403, headers: NO_STORE_HEADERS });
    }

    const { data, error } = await admin
      .from('password_reset_audit')
      .select('id,event_type,actor_user_id,target_user_id,metadata,created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as PasswordResetAuditRow[];
    const userIds = Array.from(
      new Set(
        rows
          .flatMap((row) => [row.actor_user_id, row.target_user_id])
          .filter((value): value is string => Boolean(value)),
      ),
    );

    let screennameById = new Map<string, string>();
    if (userIds.length > 0) {
      const { data: userData, error: userError } = await admin.from('users').select('id,screenname').in('id', userIds);
      if (userError) {
        throw new Error(userError.message);
      }

      screennameById = new Map(
        ((userData ?? []) as UserScreennameRow[]).map((row) => [row.id, row.screenname?.trim() || 'Unknown User']),
      );
    }

    const entries = rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      actorUserId: row.actor_user_id,
      actorScreenname: row.actor_user_id ? (screennameById.get(row.actor_user_id) ?? null) : null,
      targetUserId: row.target_user_id,
      targetScreenname: row.target_user_id ? (screennameById.get(row.target_user_id) ?? null) : null,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
    }));

    return NextResponse.json({ entries }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load password reset audit.';
    return NextResponse.json({ error: message }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
