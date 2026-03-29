'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AppIcon from '@/components/AppIcon';

interface IncomingMessageBannerProps {
  senderName: string;
  messagePreview: string;
  variant: 'room' | 'dm';
  count?: number;
  onClose: () => void;
  onClick: () => void;
}

const EXIT_ANIMATION_MS = 260;
const AUTO_DISMISS_MS = 4000;

export default function IncomingMessageBanner({
  senderName,
  messagePreview,
  variant,
  count = 1,
  onClose,
  onClick,
}: IncomingMessageBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartYRef = useRef<number | null>(null);

  const dismissBanner = useCallback(() => {
    setIsVisible(false);
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
    }
    closeTimerRef.current = setTimeout(() => {
      onClose();
    }, EXIT_ANIMATION_MS);
  }, [onClose]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setIsVisible(true);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    const dismissId = setTimeout(() => {
      dismissBanner();
    }, AUTO_DISMISS_MS);

    return () => {
      clearTimeout(dismissId);
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, [dismissBanner]);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className={`fixed left-0 top-0 z-[9999] w-full transform transition-all duration-300 ease-out motion-reduce:transition-none ${
        isVisible ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0'
      }`}
      style={{ paddingTop: 'max(env(safe-area-inset-top), 0.75rem)' }}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        touchStartYRef.current = touch ? touch.clientY : null;
      }}
      onTouchEnd={(event) => {
        const startY = touchStartYRef.current;
        touchStartYRef.current = null;
        if (startY === null) {
          return;
        }
        const endTouch = event.changedTouches[0];
        const endY = endTouch ? endTouch.clientY : startY;
        if (startY - endY >= 40) {
          dismissBanner();
        }
      }}
    >
      <div className="ui-panel-card mx-3 overflow-hidden rounded-2xl">
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Icon avatar — clickable */}
          <button
            type="button"
            onClick={onClick}
            className={`ui-focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xl transition hover:opacity-80 active:scale-95 ${
              variant === 'dm'
                ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300'
                : 'bg-violet-50 text-violet-600 dark:bg-violet-100 dark:text-violet-200'
            }`}
            aria-label={`Open ${variant === 'dm' ? 'conversation' : 'room'} notification from ${senderName}`}
          >
            <AppIcon kind={variant === 'dm' ? 'mail' : 'chat'} className="h-5 w-5" />
          </button>
          {/* Text — clickable */}
          <button
            type="button"
            onClick={onClick}
            className="ui-focus-ring min-w-0 flex-1 rounded-xl text-left transition active:opacity-80"
            aria-label={`Open ${variant === 'dm' ? 'conversation' : 'room'} from ${senderName}`}
          >
            <div className="flex items-baseline gap-1.5">
              <span className="truncate text-[length:var(--ui-text-md)] font-semibold text-slate-800">{senderName}</span>
              {count > 1 ? (
                <span className="shrink-0 text-[length:var(--ui-text-xs)] text-slate-400">{count} new</span>
              ) : null}
            </div>
            <p className="truncate text-[length:var(--ui-text-sm)] text-slate-500">{messagePreview}</p>
          </button>
          {/* Dismiss button */}
          <button
            type="button"
            onClick={dismissBanner}
            aria-label={`Dismiss notification from ${senderName}`}
            className="ui-focus-ring ui-sheet-close ml-1 h-11 w-11 shrink-0 text-[length:var(--ui-text-xs)] font-semibold"
          >
            <AppIcon kind="close" className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
