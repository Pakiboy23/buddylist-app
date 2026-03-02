'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

interface IncomingMessageBannerProps {
  senderName: string;
  messagePreview: string;
  onClose: () => void;
  onClick: () => void;
}

const EXIT_ANIMATION_MS = 260;
const AUTO_DISMISS_MS = 4000;

export default function IncomingMessageBanner({
  senderName,
  messagePreview,
  onClose,
  onClick,
}: IncomingMessageBannerProps) {
  const [isVisible, setIsVisible] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  return (
    <div
      className={`fixed left-0 top-0 z-50 w-full transform transition-transform duration-300 ease-out ${
        isVisible ? 'translate-y-0' : '-translate-y-full'
      }`}
      style={{ paddingTop: 'max(env(safe-area-inset-top), 1rem)' }}
    >
      <div className="mx-3 overflow-hidden rounded-b-2xl border border-blue-300/50 bg-gradient-to-b from-blue-400 via-blue-500 to-blue-700 shadow-2xl shadow-blue-900/40">
        <div className="flex items-start gap-2 px-3 pb-3 pt-2">
          <button
            type="button"
            onClick={onClick}
            className="flex min-h-[44px] flex-1 items-start gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-white/10"
          >
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-lg">
              🏃
            </span>
            <span className="min-w-0 text-white [text-shadow:0_1px_1px_rgba(0,0,0,0.45)]">
              <span className="block truncate text-sm font-bold">{senderName}</span>
              <span className="block truncate text-xs opacity-95">{messagePreview}</span>
            </span>
          </button>

          <button
            type="button"
            onClick={dismissBanner}
            aria-label="Dismiss notification"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/30 bg-white/20 text-sm font-bold text-white transition-colors hover:bg-white/30"
          >
            X
          </button>
        </div>
      </div>
    </div>
  );
}
