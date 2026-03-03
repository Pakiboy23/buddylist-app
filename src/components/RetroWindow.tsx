import React from 'react';

interface RetroWindowProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  titleBarClassName?: string;
  showBackButton?: boolean;
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
  onBack,
  headerActions,
}: RetroWindowProps) {
  return (
    <div
      className={`flex h-[100dvh] w-full flex-col overflow-hidden bg-[#f8f9fa] font-sans ${className ?? ''}`}
      style={style}
    >
      <div
        className={`flex min-h-[56px] items-center gap-2 bg-gradient-to-b from-blue-400 via-blue-500 to-blue-700 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] text-sm font-semibold text-white ${titleBarClassName ?? ''}`}
      >
        {showBackButton ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md border border-white/30 bg-white/20 px-3 text-xs font-bold text-white transition-colors hover:bg-white/30"
          >
            Back
          </button>
        ) : null}
        {headerActions}
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-[12px] text-aim-yellow">
          🏃
        </span>
        <span className="flex-1 truncate tracking-wide [text-shadow:0_1px_1px_rgba(0,0,0,0.45),0_0_1px_rgba(255,255,255,0.35)]">
          {title}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto bg-gradient-to-b from-[#f7fbff] via-[#eff6ff] to-[#e7f1ff] p-3">
        {children}
      </div>
    </div>
  );
}
