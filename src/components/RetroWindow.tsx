import React from 'react';

interface RetroWindowProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  variant?: 'default' | 'xp_shell';
  titleBarClassName?: string;
  showBackButton?: boolean;
  backButtonLabel?: string;
  onBack?: () => void;
  headerActions?: React.ReactNode;
  onXpClose?: () => void;
  onXpSignOff?: () => void;
  xpTitleText?: string;
}

export default function RetroWindow({
  title,
  children,
  className,
  style,
  variant = 'default',
  titleBarClassName,
  showBackButton = false,
  backButtonLabel = 'Back',
  onBack,
  headerActions,
  onXpClose,
  onXpSignOff,
  xpTitleText,
}: RetroWindowProps) {
  if (variant === 'xp_shell') {
    return (
      <div
        className={`flex h-[100dvh] w-full flex-col overflow-hidden bg-[#f4f7fc] font-[Tahoma,Arial,"MS Sans Serif",sans-serif] text-[11px] ${className ?? ''}`}
        style={style}
      >
        <div
          className={`relative z-20 flex min-h-[52px] items-center border-b border-[#1f4f9e] bg-gradient-to-b from-[#0058e6] via-[#3a93ff] to-[#0058e6] px-2 pb-1.5 text-[11px] font-bold text-white shadow-[0_1px_0_rgba(255,255,255,0.35)_inset] ${titleBarClassName ?? ''}`}
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="z-10 flex min-w-[44px] items-center">
            {onXpClose ? (
              <button
                type="button"
                onClick={onXpClose}
                className="inline-flex h-7 min-w-7 items-center justify-center border border-[#2a5db5] border-t-white/70 border-l-white/70 border-r-[#1a3f86] border-b-[#1a3f86] bg-gradient-to-b from-[#86bbff] to-[#3579d6] px-1 text-[13px] font-bold leading-none text-white [text-shadow:0_1px_0_rgba(0,0,0,0.45)]"
                aria-label="Back"
                title="Back"
              >
                {'<'}
              </button>
            ) : null}
          </div>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1 px-16">
            <span className="inline-flex h-3.5 w-3.5 items-center justify-center border border-[#0b3f9c] bg-gradient-to-b from-[#ffd84e] to-[#f0ba0f] text-[9px] leading-none text-[#103d95]">
              +
            </span>
            <span className="truncate [text-shadow:0_1px_0_rgba(0,0,0,0.55)]">{xpTitleText ?? title}</span>
          </div>
          <div className="z-10 ml-auto flex min-w-[44px] justify-end">
            {onXpSignOff ? (
              <button
                type="button"
                onClick={onXpSignOff}
                className="inline-flex h-7 min-w-7 items-center justify-center border border-[#2a5db5] border-t-white/70 border-l-white/70 border-r-[#1a3f86] border-b-[#1a3f86] bg-gradient-to-b from-[#86bbff] to-[#3579d6] px-1 text-[12px] font-bold text-white [text-shadow:0_1px_0_rgba(0,0,0,0.45)]"
                aria-label="Settings"
                title="Settings"
              >
                ≡
              </button>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden bg-[#f4f7fc]">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex h-[100dvh] w-full flex-col overflow-hidden bg-[#f8f9fa] font-sans ${className ?? ''}`}
      style={style}
    >
      <div
        className={`relative flex min-h-[56px] items-center bg-gradient-to-b from-blue-400 via-blue-500 to-blue-700 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] text-sm font-semibold text-white ${titleBarClassName ?? ''}`}
      >
        <div className="z-10 flex min-w-[44px] items-center gap-2">
          {showBackButton ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-md border border-white/30 bg-white/20 px-2 text-xs font-bold text-white transition-colors hover:bg-white/30"
            >
              {backButtonLabel}
            </button>
          ) : null}
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-24">
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-[12px] text-aim-yellow">
            🏃
          </span>
          <span className="ml-2 truncate tracking-wide [text-shadow:0_1px_1px_rgba(0,0,0,0.45),0_0_1px_rgba(255,255,255,0.35)]">
            {title}
          </span>
        </div>
        <div className="z-10 ml-auto flex min-w-[44px] items-center justify-end gap-2">
          {headerActions}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#f7fbff] via-[#eff6ff] to-[#e7f1ff] p-3">
        {children}
      </div>
    </div>
  );
}
