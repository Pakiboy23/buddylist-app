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
      className={`fixed left-0 top-0 z-[9999] w-full transform transition-all duration-300 ease-out ${
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
      <div className="mx-3 overflow-hidden rounded-2xl border border-white/60 bg-white/82 shadow-[0_16px_40px_rgba(15,23,42,0.20)] backdrop-blur-2xl">
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Icon avatar — clickable */}
          <button
            type="button"
            onClick={onClick}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xl transition hover:opacity-80 active:scale-95"
            style={{ background: variant === 'dm' ? '#dbeafe' : '#ede9fe' }}
            aria-label={`Open message from ${senderName}`}
          >
            <AppIcon
              kind={variant === 'dm' ? 'mail' : 'chat'}
              className={`h-5 w-5 ${variant === 'dm' ? 'text-blue-600' : 'text-violet-600'}`}
            />
          </button>
          {/* Text — clickable */}
          <button
            type="button"
            onClick={onClick}
            className="min-w-0 flex-1 text-left transition active:opacity-80"
          >
            <div className="flex items-baseline gap-1.5">
              <span className="truncate text-[13px] font-semibold text-slate-800">{senderName}</span>
              {count > 1 ? (
                <span className="shrink-0 text-[11px] text-slate-400">{count} new</span>
              ) : null}
            </div>
            <p className="truncate text-[12px] text-slate-500">{messagePreview}</p>
          </button>
          {/* Dismiss button */}
          <button
            type="button"
            onClick={dismissBanner}
            aria-label="Dismiss notification"
            className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200/80 bg-slate-100/80 text-[11px] font-semibold text-slate-500 hover:bg-slate-200 active:scale-95"
          >
            <AppIcon kind="close" className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
