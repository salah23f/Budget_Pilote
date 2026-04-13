'use client';

import React from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type BadgeVariant =
  | 'default'
  | 'highlight'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  icon?: React.ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Style maps                                                         */
/* ------------------------------------------------------------------ */

/**
 * We combine the existing CSS classes from globals.css (badge,
 * highlight-badge, success-badge, warning-badge) with extra Tailwind
 * for the new variants that are not in the stylesheet.
 */
const variantClasses: Record<BadgeVariant, string> = {
  default: 'badge',
  highlight: 'badge highlight-badge',
  success: 'badge success-badge',
  warning: 'badge warning-badge',
  danger:
    'badge bg-red-500/15 text-red-300 border-red-500/25',
  info:
    'badge bg-blue-500/15 text-blue-300 border-blue-500/25',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'text-[0.7rem] px-2 py-0.5',
  md: '', // default sizing from .badge class
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = 'default', size = 'md', icon, children, className = '', ...rest }, ref) => {
    return (
      <span
        ref={ref}
        className={[variantClasses[variant], sizeClasses[size], className]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      >
        {icon && <span className="flex-shrink-0">{icon}</span>}
        {children}
      </span>
    );
  },
);

Badge.displayName = 'Badge';
