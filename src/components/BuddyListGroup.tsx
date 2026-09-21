'use client';

import type { ReactNode } from 'react';

interface BuddyListGroupProps {
  name: string;
  total: number;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  collapsible?: boolean;
  tone?: 'default' | 'muted';
  children: ReactNode;
}

export function BuddyListGroup({
  name,
  total,
  collapsed,
  onToggleCollapsed,
  collapsible = true,
  tone = 'default',
  children,
}: BuddyListGroupProps) {
  const countDescription = `${total} ${total === 1 ? 'buddy' : 'buddies'}`;
  const headerInner = (
    <>
      <span
        className="ui-group-caret"
        data-collapsed={collapsed ? 'true' : 'false'}
        data-static={collapsible ? 'false' : 'true'}
      >
        ▶
      </span>
      <span className="ui-group-name truncate">{name}</span>
      <span className="ui-group-count">({total})</span>
    </>
  );

  return (
    <section className="ui-buddy-group" data-tone={tone} data-collapsed={collapsed ? 'true' : 'false'}>
      <div className="ui-group-header">
        {collapsible ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="ui-focus-ring ui-group-header-toggle"
            aria-expanded={!collapsed}
            aria-label={`${name}, ${countDescription}`}
          >
            {headerInner}
          </button>
        ) : (
          <p className="ui-group-header-toggle" aria-label={`${name}, ${countDescription}`}>
            {headerInner}
          </p>
        )}
      </div>
      {collapsed ? null : children}
    </section>
  );
}
