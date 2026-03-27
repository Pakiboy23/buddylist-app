import React from 'react';
import AppIcon from '@/components/AppIcon';

interface RetroWindowProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  variant?: 'default' | 'glass_shell' | 'xp_shell';
  titleBarClassName?: string;
  showBackButton?: boolean;
  backButtonLabel?: string;
  onBack?: () => void;
  headerActions?: React.ReactNode;
  xpTitleText?: string;
  onXpClose?: () => void;
  onXpSignOff?: () => void;
}

export default function RetroWindow({
  title,
  children,
  className,
  style,
  variant,
  titleBarClassName,
  showBackButton = false,
  backButtonLabel = 'Back',
  onBack,
  headerActions,
  xpTitleText,
  onXpClose,
  onXpSignOff,
}: RetroWindowProps) {
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
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
              <AppIcon kind="sparkle" className="h-3.5 w-3.5" />
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
                <AppIcon kind="menu" className="h-4 w-4" />
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
        <div className="z-10 flex min-w-[44px] items-center gap-2">
          {showBackButton ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex min-h-[38px] min-w-[38px] items-center justify-center rounded-full border border-slate-200 bg-white/85 px-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-white"
            >
              {backButtonLabel}
            </button>
          ) : null}
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-24">
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-600">
            <AppIcon kind="sparkle" className="h-3.5 w-3.5" />
          </span>
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
