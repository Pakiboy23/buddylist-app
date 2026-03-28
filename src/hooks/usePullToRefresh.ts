'use client';

import { useCallback, useRef, useState } from 'react';
import { hapticMedium } from '@/lib/haptics';

const PULL_THRESHOLD = 70;

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<void>;
  enabled?: boolean;
}

/**
 * Detects a pull-down gesture at the top of a scrollable container
 * and triggers a refresh callback.
 *
 * Returns touch handlers to spread on the scrollable container,
 * plus `isRefreshing` and `pullDistance` for rendering a pull indicator.
 */
export function usePullToRefresh({ onRefresh, enabled = true }: UsePullToRefreshOptions) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const touchStartYRef = useRef<number | null>(null);
  const scrollTopRef = useRef<number>(0);

  const onTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (!enabled || isRefreshing) return;
      const target = event.currentTarget;
      scrollTopRef.current = target.scrollTop;

      // Only allow pull when scrolled to top
      if (scrollTopRef.current <= 0) {
        const touch = event.touches[0];
        if (touch) {
          touchStartYRef.current = touch.clientY;
        }
      }
    },
    [enabled, isRefreshing],
  );

  const onTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (!enabled || isRefreshing || touchStartYRef.current === null) return;
      const touch = event.touches[0];
      if (!touch) return;

      const delta = touch.clientY - touchStartYRef.current;
      if (delta > 0) {
        setPullDistance(Math.min(delta * 0.5, 100));
      }
    },
    [enabled, isRefreshing],
  );

  const onTouchEnd = useCallback(async () => {
    if (!enabled || touchStartYRef.current === null) {
      setPullDistance(0);
      return;
    }

    touchStartYRef.current = null;

    if (pullDistance >= PULL_THRESHOLD) {
      void hapticMedium();
      setIsRefreshing(true);
      setPullDistance(0);
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
      }
    } else {
      setPullDistance(0);
    }
  }, [enabled, onRefresh, pullDistance]);

  return { onTouchStart, onTouchMove, onTouchEnd, isRefreshing, pullDistance };
}
