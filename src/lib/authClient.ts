'use client';

import { Capacitor } from '@capacitor/core';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { logSecurityEvent } from '@/lib/securityEvent';

export { shouldBounceToSignedOutRoute } from '@/lib/authSessionPolicy';

const NATIVE_SESSION_RETRY_COUNT = 12;
const NATIVE_SESSION_RETRY_DELAY_MS = 250;

let pendingSessionLookup: Promise<Session | null> | null = null;
let didSubscribeToAuthInvalidation = false;

function isInvalidRefreshTokenError(message: string | undefined) {
  if (!message) {
    return false;
  }

  const normalized = message.toLowerCase();
  return normalized.includes('invalid refresh token') || normalized.includes('refresh token not found');
}

function invalidatePendingSessionLookup() {
  pendingSessionLookup = null;
}

function subscribeToAuthInvalidation() {
  if (didSubscribeToAuthInvalidation) {
    return;
  }
  didSubscribeToAuthInvalidation = true;
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
      invalidatePendingSessionLookup();
    }
  });
}

subscribeToAuthInvalidation();

export async function getSessionOrNull(): Promise<Session | null> {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    if (isInvalidRefreshTokenError(error.message)) {
      // Do not call signOut here. A coalesced native lookup can still be
      // retrying when the reviewer signs in; a local sign-out would wipe the
      // fresh session and bounce them back to the login UI.
      logSecurityEvent({
        event_type: 'auth.session.forced_signout',
        outcome: 'failure',
        metadata: { reason: 'invalid_refresh_token', signed_out: false },
      });
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
    setTimeout(resolve, delayMs);
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
    const lookup = resolveSessionOrNullWithRetries().finally(() => {
      if (pendingSessionLookup === lookup) {
        pendingSessionLookup = null;
      }
    });
    pendingSessionLookup = lookup;
  }

  return pendingSessionLookup;
}

export async function getAccessTokenOrNull() {
  const session = await waitForSessionOrNull();
  return session?.access_token ?? null;
}
