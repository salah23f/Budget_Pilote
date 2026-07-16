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

/** Base pill styling shared by every variant (Design System v3 tokens). */
const baseClasses =
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium';

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-ink-700 text-pen-2 border-line-1',
  highlight: 'bg-accent-soft text-accent border-accent/30',
  success: 'bg-success-soft text-success border-success/30',
  warning: 'bg-warning-soft text-warning border-warning/30',
  danger: 'bg-danger-soft text-danger border-danger/30',
  info: 'bg-ink-700 text-pen-1 border-line-2',
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
        className={[baseClasses, variantClasses[variant], sizeClasses[size], className]
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
