'use client';

import { useEffect, useState } from 'react';

const KEYBOARD_INSET_THRESHOLD_PX = 80;

interface KeyboardViewportState {
  keyboardInset: number;
  viewportHeight: number | null;
}

function measureKeyboardViewport(): KeyboardViewportState {
  if (typeof window === 'undefined') {
    return {
      keyboardInset: 0,
      viewportHeight: null,
    };
  }

  const visualViewport = window.visualViewport;
  if (!visualViewport) {
    return {
      keyboardInset: 0,
      viewportHeight: window.innerHeight,
    };
  }

  const rawInset = Math.max(0, Math.round(window.innerHeight - visualViewport.height - visualViewport.offsetTop));
  const keyboardInset = rawInset >= KEYBOARD_INSET_THRESHOLD_PX ? rawInset : 0;

  return {
    keyboardInset,
    viewportHeight: Math.round(visualViewport.height),
  };
}

export function useKeyboardViewport() {
  const [state, setState] = useState<KeyboardViewportState>(() => measureKeyboardViewport());

  useEffect(() => {
    const updateViewport = () => {
      setState(measureKeyboardViewport());
    };

    updateViewport();

    const visualViewport = window.visualViewport;
    const handleFocusChange = () => {
      window.requestAnimationFrame(updateViewport);
    };

    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    window.addEventListener('focusin', handleFocusChange);
    window.addEventListener('focusout', handleFocusChange);

    if (visualViewport) {
      visualViewport.addEventListener('resize', updateViewport);
      visualViewport.addEventListener('scroll', updateViewport);
    }

    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
      window.removeEventListener('focusin', handleFocusChange);
      window.removeEventListener('focusout', handleFocusChange);

      if (visualViewport) {
        visualViewport.removeEventListener('resize', updateViewport);
        visualViewport.removeEventListener('scroll', updateViewport);
      }
    };
  }, []);

  return {
    keyboardInset: state.keyboardInset,
    viewportHeight: state.viewportHeight,
    isKeyboardOpen: state.keyboardInset > 0,
  };
}
