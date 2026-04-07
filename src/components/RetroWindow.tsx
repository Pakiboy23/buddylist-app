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
  xpSubtitleText?: string;
  onXpClose?: () => void;
  onXpSignOff?: () => void;
  hideHeader?: boolean;
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
  xpSubtitleText,
  onXpClose,
  onXpSignOff,
  hideHeader = false,
}: RetroWindowProps) {
  if (variant === 'xp_shell' || variant === 'glass_shell') {
    return (
      <div
        className={`flex h-[100dvh] w-full flex-col overflow-hidden bg-transparent text-[12px] text-slate-700 ${className ?? ''}`}
        style={style}
      >
        {hideHeader ? null : (
          <div
            className={`ui-window-header relative z-20 mx-3 mt-3 flex min-h-[60px] items-center rounded-[1.4rem] px-3 py-2 text-[13px] font-semibold ${titleBarClassName ?? ''}`}
            style={{ paddingTop: 'env(safe-area-inset-top)' }}
          >
            <div className="z-10 flex min-w-0 flex-1 items-center gap-2.5 pr-3">
              {onXpClose ? (
                <button
                  type="button"
                  onClick={onXpClose}
                  className="ui-focus-ring ui-window-header-button min-h-[40px] gap-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.16em]"
                  aria-label="Back"
                  title="Back"
                >
                  <span aria-hidden="true" className="text-[13px] leading-none">←</span>
                  <span>Back</span>
                </button>
              ) : null}
              <span className="ui-brand-sparkle inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                <AppIcon kind="sparkle" className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="ui-him-wordmark truncate">
                    <span>H</span><span>.</span><span>I</span><span>.</span><span>M</span>
                  </p>
                  <span className="aim-pro-badge">Pro</span>
                </div>
                <p className="truncate text-[11px] tracking-[0.08em] text-slate-500 dark:text-slate-300">{xpTitleText ?? title}</p>
                {xpSubtitleText ? (
                  <p className="truncate text-[11px] font-medium text-slate-400 dark:text-slate-400">{xpSubtitleText}</p>
                ) : null}
              </div>
            </div>
            <div className="z-10 ml-auto flex shrink-0 items-center justify-end gap-2">
              {headerActions}
              {onXpSignOff ? (
                <button
                  type="button"
                  onClick={onXpSignOff}
                  className="ui-focus-ring ui-window-header-button px-1 text-[14px] font-semibold"
                  aria-label="Settings"
                  title="Settings"
                >
                  <AppIcon kind="menu" className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          </div>
        )}

        <div className={`min-h-0 flex-1 overflow-hidden ${hideHeader ? 'px-0 pt-0 pb-0' : 'px-3 pb-3 pt-2'}`}>
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex h-[100dvh] w-full flex-col overflow-hidden bg-transparent ${className ?? ''}`}
      style={style}
    >
      {hideHeader ? null : (
        <div
          className={`ui-window-header relative mx-3 mt-3 flex min-h-[56px] items-center rounded-[1.4rem] px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] text-sm font-semibold ${titleBarClassName ?? ''}`}
        >
          <div className="z-10 flex min-w-[44px] items-center gap-2">
            {showBackButton ? (
              <button
                type="button"
                onClick={onBack}
                className="ui-focus-ring ui-window-header-button min-h-[44px] min-w-[44px] px-2 text-xs font-semibold"
              >
                {backButtonLabel}
              </button>
            ) : null}
          </div>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-24">
            <span className="ui-brand-sparkle inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
              <AppIcon kind="sparkle" className="h-3.5 w-3.5" />
            </span>
            <span className="ui-him-wordmark ml-2 truncate">
              <span>H</span><span>.</span><span>I</span><span>.</span><span>M</span>
            </span>
            <span className="aim-pro-badge ml-1">Pro</span>
            <span className="ml-2 truncate tracking-wide text-slate-700 dark:text-slate-100">
              {title}
            </span>
          </div>
          <div className="z-10 ml-auto flex min-w-[44px] items-center justify-end gap-2">
            {headerActions}
          </div>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto px-3 pb-3 ${hideHeader ? 'pt-0' : 'pt-2'}`}>
        {children}
      </div>
    </div>
  );
}
