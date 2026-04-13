'use client';

import { type PointerEvent as ReactPointerEvent, type ReactNode, useCallback, useMemo, useRef, useState } from 'react';

const HORIZONTAL_LOCK_DISTANCE = 10;
const VERTICAL_CANCEL_DISTANCE = 14;
const TRIGGER_DISTANCE = 54;
const MAX_OFFSET = 72;

function isInteractiveElement(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('button, a, input, textarea, select, [data-swipe-ignore="true"]'));
}

function SwipeArrow({ align }: { align: 'start' | 'end' }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-3.5 w-3.5 ${align === 'start' ? '' : 'scale-x-[-1]'}`}
    >
      <path d="M7 5 3 9l4 4" />
      <path d="M4 9h10a3 3 0 0 1 3 3" />
    </svg>
  );
}

interface SwipeActionFrameProps {
  align: 'start' | 'end';
  children: ReactNode;
  className?: string;
  enabled?: boolean;
  label: string;
  onTrigger: () => void;
}

export default function SwipeActionFrame({
  align,
  children,
  className = '',
  enabled = true,
  label,
  onTrigger,
}: SwipeActionFrameProps) {
  const pointerIdRef = useRef<number | null>(null);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const [offset, setOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const reset = useCallback(() => {
    pointerIdRef.current = null;
    setOffset(0);
    setIsDragging(false);
  }, []);

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled || event.button !== 0 || isInteractiveElement(event.target)) {
        return;
      }

      pointerIdRef.current = event.pointerId;
      startXRef.current = event.clientX;
      startYRef.current = event.clientY;
      setIsDragging(false);
      setOffset(0);
    },
    [enabled],
  );

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!enabled || pointerIdRef.current !== event.pointerId) {
        return;
      }

      const deltaX = event.clientX - startXRef.current;
      const deltaY = event.clientY - startYRef.current;
      const absoluteX = Math.abs(deltaX);
      const absoluteY = Math.abs(deltaY);

      if (!isDragging && absoluteY > VERTICAL_CANCEL_DISTANCE && absoluteY > absoluteX) {
        reset();
        return;
      }

      if (!isDragging && absoluteX < HORIZONTAL_LOCK_DISTANCE) {
        return;
      }

      const constrainedOffset =
        align === 'start'
          ? Math.max(0, Math.min(deltaX, MAX_OFFSET))
          : Math.min(0, Math.max(deltaX, -MAX_OFFSET));

      if (Math.abs(constrainedOffset) < 2) {
        return;
      }

      setIsDragging(true);
      setOffset(constrainedOffset);
      if (event.cancelable) {
        event.preventDefault();
      }
    },
    [align, enabled, isDragging, reset],
  );

  const handlePointerRelease = useCallback(() => {
    if (!enabled || pointerIdRef.current === null) {
      return;
    }

    const shouldTrigger = Math.abs(offset) >= TRIGGER_DISTANCE;
    reset();
    if (shouldTrigger) {
      onTrigger();
    }
  }, [enabled, offset, onTrigger, reset]);

  const progress = Math.min(Math.abs(offset) / TRIGGER_DISTANCE, 1);
  const indicatorStyle = useMemo(
    () => ({
      opacity: progress,
      transform: `scale(${0.9 + progress * 0.1})`,
    }),
    [progress],
  );

  return (
    <div className={`relative ${className}`} style={{ touchAction: 'pan-y' }}>
      <div
        className={`pointer-events-none absolute inset-y-0 z-0 flex items-center ${
          align === 'start' ? 'left-0 pl-1.5' : 'right-0 pr-1.5'
        }`}
        aria-hidden="true"
      >
        <div
          className="inline-flex items-center gap-1.5 rounded-full border border-[#E8608A]/40 bg-[#E8608A]/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[#E8608A] dark:border-[#E8608A]/25 dark:bg-[#E8608A]/12 dark:text-[#E8608A]"
          style={indicatorStyle}
        >
          <SwipeArrow align={align} />
          <span>{label}</span>
        </div>
      </div>
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerRelease}
        onPointerCancel={reset}
        onLostPointerCapture={reset}
        style={{
          transform: `translateX(${offset}px)`,
          transition: isDragging ? 'none' : 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {children}
      </div>
    </div>
  );
}
