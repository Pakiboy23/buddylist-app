export type AbuseReportCategory = 'harassment' | 'spam' | 'impersonation' | 'self_harm' | 'other';

export interface BlockedUserRow {
  blocked_id?: string | null;
  blockedId?: string | null;
}

export interface ExpiringMessage {
  expires_at?: string | null;
}

export const ABUSE_REPORT_CATEGORY_OPTIONS: Array<{
  value: AbuseReportCategory;
  label: string;
  helper: string;
}> = [
  { value: 'harassment', label: 'Harassment', helper: 'Threats, bullying, or repeated unwanted contact.' },
  { value: 'spam', label: 'Spam', helper: 'Scammy, repetitive, or mass-sent messages.' },
  { value: 'impersonation', label: 'Impersonation', helper: 'Pretending to be someone else.' },
  { value: 'self_harm', label: 'Self-harm', helper: 'Content suggesting imminent self-harm risk.' },
  { value: 'other', label: 'Other', helper: 'Anything else that feels unsafe or abusive.' },
];

export const DISAPPEARING_TIMER_OPTIONS = [null, 300, 3600, 86400, 604800] as const;

export function normalizeBlockedUserIds(rows: BlockedUserRow[] | null | undefined) {
  const blockedIds = new Set<string>();
  for (const row of rows ?? []) {
    const blockedId =
      (typeof row.blocked_id === 'string' && row.blocked_id.trim()) ||
      (typeof row.blockedId === 'string' && row.blockedId.trim()) ||
      '';
    if (blockedId) {
      blockedIds.add(blockedId);
    }
  }

  return Array.from(blockedIds);
}

export function formatDisappearingTimerLabel(seconds: number | null | undefined, options?: { short?: boolean }) {
  if (!seconds || seconds <= 0) {
    return options?.short ? 'Off' : 'Disappearing messages off';
  }

  if (seconds < 3600) {
    const minutes = Math.round(seconds / 60);
    return options?.short ? `${minutes}m` : `${minutes} minute${minutes === 1 ? '' : 's'}`;
  }

  if (seconds < 86400) {
    const hours = Math.round(seconds / 3600);
    return options?.short ? `${hours}h` : `${hours} hour${hours === 1 ? '' : 's'}`;
  }

  const days = Math.round(seconds / 86400);
  return options?.short ? `${days}d` : `${days} day${days === 1 ? '' : 's'}`;
}

export function getMessageExpiresAt(timerSeconds: number | null | undefined, baseTimeMs = Date.now()) {
  if (!timerSeconds || timerSeconds <= 0) {
    return null;
  }

  return new Date(baseTimeMs + timerSeconds * 1000).toISOString();
}

export function isMessageExpired(message: ExpiringMessage, nowMs = Date.now()) {
  const expiresAt = typeof message.expires_at === 'string' ? message.expires_at : '';
  if (!expiresAt) {
    return false;
  }

  const expiresAtMs = Date.parse(expiresAt);
  if (Number.isNaN(expiresAtMs)) {
    return false;
  }

  return expiresAtMs <= nowMs;
}

export function filterExpiredMessages<T extends ExpiringMessage>(messages: T[], nowMs = Date.now()) {
  return messages.filter((message) => !isMessageExpired(message, nowMs));
}

export function isTrustSafetySchemaMissingError(
  error: { message?: string | null; code?: string | null } | null | undefined,
) {
  if (!error) {
    return false;
  }

  const combined = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase();
  return ['blocked_users', 'abuse_reports'].some((token) => combined.includes(token));
}
