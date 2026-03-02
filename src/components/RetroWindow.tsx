import React from 'react';

interface RetroWindowProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  titleBarClassName?: string;
  onTitleBarMouseDown?: (event: React.MouseEvent<HTMLDivElement>) => void;
}

export default function RetroWindow({
  title,
  children,
  className,
  style,
  titleBarClassName,
  onTitleBarMouseDown,
}: RetroWindowProps) {
  return (
    <div
      className={`w-full rounded-[2px] border-2 border-white border-b-[#0a0a0a] border-r-[#0a0a0a] bg-os-grey p-[2px] font-sans shadow-window-out flex flex-col ${className ?? ''}`}
      style={style}
    >
      
      <div
        className={`aim-titlebar flex select-none items-center px-1 py-[3px] text-sm font-bold text-white ${titleBarClassName ?? ''}`}
        onMouseDown={onTitleBarMouseDown}
      >
        <span className="mr-2 text-xs text-aim-yellow">🏃</span>
        <span className="tracking-wide drop-shadow-[0_1px_0_rgba(0,0,0,0.35)]">{title}</span>
      </div>

      <div className="mt-1 flex-grow border border-os-dark-grey bg-os-light-grey p-2 shadow-window-in">
        {children}
      </div>
      
    </div>
  );
}
