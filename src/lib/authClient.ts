'use client';

import { Capacitor } from '@capacitor/core';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

const NATIVE_SESSION_RETRY_COUNT = 12;
const NATIVE_SESSION_RETRY_DELAY_MS = 250;

let pendingSessionLookup: Promise<Session | null> | null = null;

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

function isNativePlatform() {
  return typeof window !== 'undefined' && Capacitor.isNativePlatform();
}

function wait(delayMs: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, delayMs);
  });
}

async function resolveSessionOrNullWithRetries() {
  const initialSession = await getSessionOrNull();
  if (initialSession || !isNativePlatform()) {
    return initialSession;
  }

  for (let attempt = 0; attempt < NATIVE_SESSION_RETRY_COUNT; attempt += 1) {
    await wait(NATIVE_SESSION_RETRY_DELAY_MS);
    const nextSession = await getSessionOrNull();
    if (nextSession) {
      return nextSession;
    }
  }

  return null;
}

export async function waitForSessionOrNull() {
  if (!pendingSessionLookup) {
    pendingSessionLookup = resolveSessionOrNullWithRetries().finally(() => {
      pendingSessionLookup = null;
    });
  }

  return pendingSessionLookup;
}

export async function getAccessTokenOrNull() {
  const session = await waitForSessionOrNull();
  return session?.access_token ?? null;
}
