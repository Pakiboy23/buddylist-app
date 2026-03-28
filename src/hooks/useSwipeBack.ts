'use client';

import { useCallback, useRef } from 'react';
import { hapticLight } from '@/lib/haptics';

const SWIPE_THRESHOLD = 80;
const EDGE_ZONE = 30;

interface UseSwipeBackOptions {
  onSwipeBack: () => void;
  enabled?: boolean;
}

/**
 * Detects a left-to-right swipe from the left edge of the screen
 * and calls the callback (e.g. close a chat window).
 *
 * Returns touch handlers to spread on the container element.
 */
export function useSwipeBack({ onSwipeBack, enabled = true }: UseSwipeBackOptions) {
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const isSwipingRef = useRef(false);

  const onTouchStart = useCallback(
    (event: React.TouchEvent) => {
      if (!enabled) return;
      const touch = event.touches[0];
      if (!touch) return;

      // Only activate if the touch starts near the left edge
      if (touch.clientX <= EDGE_ZONE) {
        touchStartXRef.current = touch.clientX;
        touchStartYRef.current = touch.clientY;
        isSwipingRef.current = false;
      }
    },
    [enabled],
  );

  const onTouchMove = useCallback(
    (event: React.TouchEvent) => {
      if (!enabled || touchStartXRef.current === null || touchStartYRef.current === null) return;
      const touch = event.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - touchStartXRef.current;
      const deltaY = Math.abs(touch.clientY - touchStartYRef.current);

      // Cancel if scrolling vertically more than horizontally
      if (deltaY > deltaX) {
        touchStartXRef.current = null;
        touchStartYRef.current = null;
        return;
      }

      if (deltaX >= SWIPE_THRESHOLD && !isSwipingRef.current) {
        isSwipingRef.current = true;
        void hapticLight();
        onSwipeBack();
        touchStartXRef.current = null;
        touchStartYRef.current = null;
      }
    },
    [enabled, onSwipeBack],
  );

  const onTouchEnd = useCallback(() => {
    touchStartXRef.current = null;
    touchStartYRef.current = null;
    isSwipingRef.current = false;
  }, []);

  return { onTouchStart, onTouchMove, onTouchEnd };
}
