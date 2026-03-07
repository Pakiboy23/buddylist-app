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
      className={`flex h-[100dvh] w-full flex-col overflow-hidden bg-transparent font-["SF_Pro_Text","SF_Pro_Display","Segoe_UI",sans-serif] text-[12px] text-slate-700 ${className ?? ''}`}
      style={style}
    >
      <div className={`aim-window-header ${titleBarClassName ?? ''}`} style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="z-10 flex min-w-[44px] items-center gap-2">
          {showBackButton ? (
            <button
              type="button"
              onClick={onBack}
              className="aim-window-icon-button min-h-[38px] min-w-[38px] px-2 text-xs"
            >
              {backButtonLabel}
            </button>
          ) : null}
        </div>
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-24">
          <span className="aim-window-title-mark">✦</span>
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
