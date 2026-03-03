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
    const xpControlBase =
      'inline-flex h-[20px] w-[22px] items-center justify-center border border-[#0f2e73] border-t-white/70 border-l-white/70 border-r-[#0d2d6f] border-b-[#0d2d6f] text-[11px] font-bold leading-none shadow-[inset_1px_1px_0_rgba(255,255,255,0.35)]';

    return (
      <div
        className={`flex h-[100dvh] w-full flex-col overflow-hidden bg-[#ece9d8] font-[Tahoma,Arial,sans-serif] text-[11px] ${className ?? ''}`}
        style={style}
      >
        <div
          className={`relative flex min-h-[32px] items-center justify-between rounded-t-lg border border-[#1f4f9e] bg-gradient-to-b from-[#0058e6] via-[#3a93ff] to-[#0058e6] px-2 text-[11px] font-bold text-white [text-shadow:0_1px_0_rgba(0,0,0,0.6)] ${titleBarClassName ?? ''}`}
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="min-w-0 truncate pr-2">{xpTitleText ?? title}</div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={`${xpControlBase} bg-gradient-to-b from-[#6faeff] to-[#2d75d8]`}
              aria-label="Minimize"
              title="Minimize"
            >
              _
            </button>
            <button
              type="button"
              className={`${xpControlBase} bg-gradient-to-b from-[#6faeff] to-[#2d75d8]`}
              aria-label="Maximize"
              title="Maximize"
            >
              □
            </button>
            <button
              type="button"
              onClick={onXpClose}
              className={`${xpControlBase} bg-gradient-to-b from-[#ff7f7f] via-[#ef3a3a] to-[#c90000]`}
              aria-label="Close"
              title="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex min-h-[24px] items-center gap-4 border-x border-b border-[#b6b6b6] bg-[#ece9d8] px-2 text-[11px] text-[#111]">
          <span>File</span>
          <span>Edit</span>
          <span>Insert</span>
          <span>Window</span>
          {onXpSignOff ? (
            <button type="button" onClick={onXpSignOff} className="cursor-pointer">
              Sign Off
            </button>
          ) : (
            <span>Sign Off</span>
          )}
          <span>Help</span>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden border-x border-b border-[#b6b6b6] bg-[#ece9d8]">
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
