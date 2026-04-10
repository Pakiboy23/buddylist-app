'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { waitForSessionOrNull } from '@/lib/authClient';

type RawStatus = 'following' | 'pending' | 'mutual' | 'blocked' | null;
export type ConnectionStatus = 'loading' | 'none' | 'following' | 'pending' | 'mutual' | 'blocked';

export interface ConnectionState {
  status: ConnectionStatus;
  /** True when the viewer can see the subject's presence and away message. */
  canSeePresence: boolean;
  /** True when can_add_from_room returns true and status allows a buddy request. */
  canAddBuddy: boolean;
  /** True only for mutual connections. */
  canMessage: boolean;
}

const INACTIVE: ConnectionState = {
  status: 'none',
  canSeePresence: false,
  canAddBuddy: false,
  canMessage: false,
};

/**
 * Tracks the user_connections status between the current user and targetUserId.
 * Subscribes to realtime updates so the UI reflects changes without a page refresh.
 *
 * Pass an empty string to skip all fetching (returns 'none' immediately).
 */
export function useConnectionStatus(targetUserId: string): ConnectionState {
  const [status, setStatus] = useState<ConnectionStatus>('loading');
  const [canAddBuddy, setCanAddBuddy] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Initial fetch
  useEffect(() => {
    if (!targetUserId) {
      setStatus('none');
      setCanAddBuddy(false);
      return;
    }

    let cancelled = false;
    setStatus('loading');

    async function fetchState() {
      const session = await waitForSessionOrNull();
      const uid = session?.user.id ?? null;
      if (!uid || cancelled) return;

      setCurrentUserId(uid);

      const [statusResult, roomResult] = await Promise.all([
        supabase.rpc('get_connection_status', {
          p_user_id: uid,
          p_other_id: targetUserId,
        }),
        supabase.rpc('can_add_from_room', {
          p_user_id: uid,
          p_target_id: targetUserId,
        }),
      ]);

      if (cancelled) return;

      const raw = (statusResult.data as RawStatus) ?? null;
      setStatus(raw === null ? 'none' : raw);
      setCanAddBuddy(Boolean(roomResult.data));
    }

    void fetchState();
    return () => { cancelled = true; };
  }, [targetUserId]);

  // Realtime subscription for this pair
  useEffect(() => {
    if (!targetUserId || !currentUserId) return;

    const ua = currentUserId < targetUserId ? currentUserId : targetUserId;
    const channelName = `uc_${ua}_${currentUserId < targetUserId ? targetUserId : currentUserId}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_connections',
          filter: `user_a=eq.${ua}`,
        },
        () => {
          // Re-query when any row for user_a changes (covers this pair)
          void supabase
            .rpc('get_connection_status', {
              p_user_id: currentUserId,
              p_other_id: targetUserId,
            })
            .then(({ data }) => {
              const raw = (data as RawStatus) ?? null;
              setStatus(raw === null ? 'none' : raw);
            });
        },
      )
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [targetUserId, currentUserId]);

  if (!targetUserId) return INACTIVE;

  return {
    status,
    canSeePresence: status === 'following' || status === 'mutual',
    canAddBuddy: (status === 'none' || status === 'following') && canAddBuddy,
    canMessage: status === 'mutual',
  };
}
