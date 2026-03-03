'use client';

import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabase';

const ONESIGNAL_APP_ID = 'a3c7e63e-311b-4acd-8b4c-b7fff89f011b';

interface PushSubscriptionChangedState {
  current?: {
    id?: string | null;
  };
}

export function useOneSignal(userId: string | null) {
  const hasInitializedRef = useRef(false);
  const lastSyncedSubscriptionRef = useRef<string | null>(null);

  useEffect(() => {
    lastSyncedSubscriptionRef.current = null;
  }, [userId]);

  useEffect(() => {
    if (!userId || !Capacitor.isNativePlatform() || typeof window === 'undefined') {
      return;
    }

    let isCancelled = false;
    let removeSubscriptionListener: (() => void) | null = null;

    const syncSubscriptionId = async (subscriptionId: string | null | undefined) => {
      const normalizedSubscriptionId =
        typeof subscriptionId === 'string' ? subscriptionId.trim() : '';

      if (!normalizedSubscriptionId || isCancelled) {
        return;
      }

      if (lastSyncedSubscriptionRef.current === normalizedSubscriptionId) {
        return;
      }

      const { error } = await supabase
        .from('users')
        .update({ onesignal_id: normalizedSubscriptionId })
        .eq('id', userId);

      if (error) {
        console.error('Failed syncing OneSignal subscription ID:', error.message);
        return;
      }

      lastSyncedSubscriptionRef.current = normalizedSubscriptionId;
    };

    const handleSubscriptionChange = (event: PushSubscriptionChangedState) => {
      void syncSubscriptionId(event.current?.id);
    };

    const initializeOneSignal = async () => {
      const { default: OneSignal } = await import('onesignal-cordova-plugin');

      if (isCancelled) {
        return;
      }

      if (!hasInitializedRef.current) {
        OneSignal.initialize(ONESIGNAL_APP_ID);
        hasInitializedRef.current = true;
      }

      try {
        await OneSignal.Notifications.requestPermission(true);
      } catch (error) {
        console.error('Failed requesting OneSignal notification permission:', error);
      }

      try {
        const subscriptionId = await OneSignal.User.pushSubscription.getIdAsync();
        await syncSubscriptionId(subscriptionId);
      } catch (error) {
        console.error('Failed retrieving OneSignal subscription ID:', error);
      }

      OneSignal.User.pushSubscription.addEventListener('change', handleSubscriptionChange);
      removeSubscriptionListener = () => {
        OneSignal.User.pushSubscription.removeEventListener('change', handleSubscriptionChange);
      };
    };

    void initializeOneSignal();

    return () => {
      isCancelled = true;
      removeSubscriptionListener?.();
    };
  }, [userId]);
}
