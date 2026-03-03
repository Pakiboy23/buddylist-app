import React from 'react';

interface RetroWindowProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  titleBarClassName?: string;
  showBackButton?: boolean;
  backButtonLabel?: string;
  onBack?: () => void;
  headerActions?: React.ReactNode;
}

export default function RetroWindow({
  title,
  children,
  className,
  style,
  titleBarClassName,
  showBackButton = false,
  backButtonLabel = 'Back',
  onBack,
  headerActions,
}: RetroWindowProps) {
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
