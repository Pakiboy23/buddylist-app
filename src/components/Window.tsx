import React from 'react';

interface WindowProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  variant?: 'default' | 'minimal_shell';
  titleBarClassName?: string;
  showBackButton?: boolean;
  backButtonLabel?: string;
  onBack?: () => void;
  headerActions?: React.ReactNode;
  onMinimalClose?: () => void;
  onMinimalSignOff?: () => void;
  minimalTitleText?: string;
}

export default function Window({
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
  onMinimalClose,
  onMinimalSignOff,
  minimalTitleText,
}: WindowProps) {
  if (variant === 'minimal_shell') {
    return (
      <div
        className={`flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-50 font-["SF_Pro_Text","SF_Pro_Display","Segoe_UI",sans-serif] text-[12px] text-slate-700 ${className ?? ''}`}
        style={style}
      >
        <div
          className={`relative z-20 flex min-h-[56px] items-center border-b border-slate-200/50 bg-white/80 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] text-[15px] font-semibold text-slate-900 shadow-sm backdrop-blur-xl ${titleBarClassName ?? ''}`}
        >
          <div className="z-10 flex min-w-[44px] items-center">
            {onMinimalClose ? (
              <button
                type="button"
                onClick={onMinimalClose}
                className="inline-flex items-center text-[15px] font-normal text-blue-600 active:opacity-70"
                aria-label="Back"
                title="Back"
              >
                <span className="mr-1 text-xl leading-none">‹</span> Back
              </button>
            ) : null}
          </div>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1 px-16 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
            <span className="truncate tracking-tight text-slate-900">{minimalTitleText ?? title}</span>
          </div>
          <div className="z-10 ml-auto flex min-w-[44px] justify-end">
            {onMinimalSignOff ? (
              <button
                type="button"
                onClick={onMinimalSignOff}
                className="inline-flex items-center text-[15px] font-normal text-blue-600 active:opacity-70"
                aria-label="Settings"
                title="Settings"
              >
                Edit
              </button>
            ) : null}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-50 font-["SF_Pro_Text","SF_Pro_Display","Segoe_UI",sans-serif] ${className ?? ''}`}
      style={style}
    >
      <div
        className={`relative flex min-h-[56px] items-center border-b border-slate-200/50 bg-white/80 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] text-[15px] font-semibold text-slate-900 shadow-sm backdrop-blur-xl ${titleBarClassName ?? ''}`}
      >
        <div className="z-10 flex min-w-[44px] items-center gap-2">
          {showBackButton ? (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center text-[15px] font-normal text-blue-600 active:opacity-70"
            >
              <span className="mr-1 text-xl leading-none">‹</span> {backButtonLabel}
            </button>
          ) : null}
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-24 pt-[calc(env(safe-area-inset-top)+0.5rem)]">
          <span className="truncate tracking-tight text-slate-900">
            {title}
          </span>
        </div>
        <div className="z-10 ml-auto flex min-w-[44px] items-center justify-end gap-2">
          {headerActions}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
