'use client';

import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

function isInvalidRefreshTokenError(message: string | undefined) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return normalized.includes('invalid refresh token') || normalized.includes('refresh token not found');
}

export async function getSessionOrNull(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    if (isInvalidRefreshTokenError(error.message)) {
      await supabase.auth.signOut({ scope: 'local' });
      return null;
    }

    console.error('Failed to get auth session:', error.message);
    return null;
  }

  return data.session ?? null;
}

export async function getAccessTokenOrNull() {
  const session = await getSessionOrNull();
  return session?.access_token ?? null;
}

