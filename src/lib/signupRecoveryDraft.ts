'use client';

import { getVersionedData, removeValue, setVersionedData } from '@/lib/clientStorage';

const SIGNUP_RECOVERY_DRAFT_KEY = 'buddylist:signup-recovery-draft:v1';
const SIGNUP_RECOVERY_DRAFT_VERSION = 1;
const SIGNUP_RECOVERY_DRAFT_TTL_MS = 48 * 60 * 60 * 1000;

interface PendingSignupRecoveryDraft {
  screennameKey: string;
  recoveryCode: string;
}

function normalizeScreennameKey(screenname: string) {
  return screenname.trim().toLowerCase();
}

export function savePendingSignupRecoveryDraft(screenname: string, recoveryCode: string) {
  const screennameKey = normalizeScreennameKey(screenname);
  const normalizedRecoveryCode = recoveryCode.trim();
  if (!screennameKey || !normalizedRecoveryCode) {
    return false;
  }

  return setVersionedData<PendingSignupRecoveryDraft>(
    SIGNUP_RECOVERY_DRAFT_KEY,
    SIGNUP_RECOVERY_DRAFT_VERSION,
    {
      screennameKey,
      recoveryCode: normalizedRecoveryCode,
    },
  );
}

export function readPendingSignupRecoveryDraft(screenname: string) {
  const screennameKey = normalizeScreennameKey(screenname);
  if (!screennameKey) {
    return null;
  }

  const draft = getVersionedData<PendingSignupRecoveryDraft | null>(SIGNUP_RECOVERY_DRAFT_KEY, {
    version: SIGNUP_RECOVERY_DRAFT_VERSION,
    fallback: null,
    maxAgeMs: SIGNUP_RECOVERY_DRAFT_TTL_MS,
  });

  if (!draft || draft.screennameKey !== screennameKey || !draft.recoveryCode.trim()) {
    return null;
  }

  return draft.recoveryCode.trim();
}

export function clearPendingSignupRecoveryDraft(screenname?: string | null) {
  if (screenname) {
    const draft = getVersionedData<PendingSignupRecoveryDraft | null>(SIGNUP_RECOVERY_DRAFT_KEY, {
      version: SIGNUP_RECOVERY_DRAFT_VERSION,
      fallback: null,
      maxAgeMs: SIGNUP_RECOVERY_DRAFT_TTL_MS,
    });

    if (draft && draft.screennameKey !== normalizeScreennameKey(screenname)) {
      return;
    }
  }

  removeValue(SIGNUP_RECOVERY_DRAFT_KEY);
}
