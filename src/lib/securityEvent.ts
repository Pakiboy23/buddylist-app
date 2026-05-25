import { supabase } from '@/lib/supabase';

interface SecurityEventPayload {
  event_type: string;
  user_id?: string | null;
  outcome: 'success' | 'failure' | 'partial';
  metadata?: Record<string, unknown>;
}

// Fire-and-forget — never blocks or throws so auth flows aren't affected.
export function logSecurityEvent(payload: SecurityEventPayload): void {
  void supabase
    .from('security_events')
    .insert({
      event_type: payload.event_type,
      user_id: payload.user_id ?? null,
      outcome: payload.outcome,
      metadata: payload.metadata ?? {},
    })
    .then(({ error }) => {
      if (error) console.warn('[security_event]', payload.event_type, error.message);
    });
}
