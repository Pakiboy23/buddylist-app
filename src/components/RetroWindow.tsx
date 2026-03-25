import React from 'react';

interface RetroWindowProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
<<<<<<< HEAD
=======
  variant?: 'default' | 'glass_shell' | 'xp_shell';
>>>>>>> main
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
<<<<<<< HEAD
  return (
    <div
      className={`flex h-[100dvh] w-full flex-col overflow-hidden bg-transparent font-["SF_Pro_Text","SF_Pro_Display","Segoe_UI",sans-serif] text-[12px] text-slate-700 ${className ?? ''}`}
      style={style}
    >
      <div className={`aim-window-header ${titleBarClassName ?? ''}`} style={{ paddingTop: 'env(safe-area-inset-top)' }}>
=======
  if (variant === 'xp_shell' || variant === 'glass_shell') {
    return (
      <div
        className={`flex h-[100dvh] w-full flex-col overflow-hidden bg-transparent font-["SF_Pro_Text","SF_Pro_Display","Segoe_UI",sans-serif] text-[12px] text-slate-700 ${className ?? ''}`}
        style={style}
      >
        <div
          className={`relative z-20 mx-3 mt-3 flex min-h-[56px] items-center rounded-[1.4rem] border border-white/45 bg-white/50 px-3 pb-1.5 text-[13px] font-semibold text-slate-700 shadow-[0_10px_30px_rgba(15,23,42,0.15)] backdrop-blur-xl ${titleBarClassName ?? ''}`}
          style={{ paddingTop: 'env(safe-area-inset-top)' }}
        >
          <div className="z-10 flex min-w-[44px] items-center">
            {onXpClose ? (
              <button
                type="button"
                onClick={onXpClose}
                className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-slate-200 bg-white/80 px-1 text-[13px] font-semibold leading-none text-slate-700 transition hover:bg-white"
                aria-label="Back"
                title="Back"
              >
                ←
              </button>
            ) : null}
          </div>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1 px-16">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/10 text-[11px] leading-none text-blue-600">
              ✦
            </span>
            <span className="truncate tracking-[0.01em] text-slate-700">{xpTitleText ?? title}</span>
          </div>
          <div className="z-10 ml-auto flex min-w-[44px] justify-end">
            {onXpSignOff ? (
              <button
                type="button"
                onClick={onXpSignOff}
                className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-slate-200 bg-white/80 px-1 text-[14px] font-semibold text-slate-700 transition hover:bg-white"
                aria-label="Settings"
                title="Settings"
              >
                ⋯
              </button>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden px-3 pb-3 pt-2">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex h-[100dvh] w-full flex-col overflow-hidden bg-transparent font-["SF_Pro_Text","SF_Pro_Display","Segoe_UI",sans-serif] ${className ?? ''}`}
      style={style}
    >
      <div
        className={`relative mx-3 mt-3 flex min-h-[56px] items-center rounded-[1.4rem] border border-white/45 bg-white/55 px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] text-sm font-semibold text-slate-700 shadow-[0_12px_30px_rgba(15,23,42,0.15)] backdrop-blur-xl ${titleBarClassName ?? ''}`}
      >
>>>>>>> main
        <div className="z-10 flex min-w-[44px] items-center gap-2">
          {showBackButton ? (
            <button
              type="button"
              onClick={onBack}
<<<<<<< HEAD
              className="aim-window-icon-button min-h-[38px] min-w-[38px] px-2 text-xs"
=======
              className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-full border border-slate-200 bg-white/85 px-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-white"
>>>>>>> main
            >
              {backButtonLabel}
            </button>
          ) : null}
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-24">
<<<<<<< HEAD
          <span className="aim-window-title-mark">✦</span>
=======
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-[12px] text-blue-600">
            ✦
          </span>
>>>>>>> main
          <span className="ml-2 truncate tracking-wide text-slate-700">
            {title}
          </span>
        </div>
        <div className="z-10 ml-auto flex min-w-[44px] items-center justify-end gap-2">
          {headerActions}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 pt-2">
        {children}
      </div>
    </div>
  );
}
