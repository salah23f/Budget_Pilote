'use client';

import React from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type PaddingSize = 'none' | 'sm' | 'md' | 'lg';
type CardVariant = 'default' | 'glass' | 'elevated';

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  footer?: React.ReactNode;
  padding?: PaddingSize;
  hoverable?: boolean;
  variant?: CardVariant;
}

/* ------------------------------------------------------------------ */
/*  Style maps                                                         */
/* ------------------------------------------------------------------ */

const paddingClasses: Record<PaddingSize, string> = {
  none: '',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

const variantClasses: Record<CardVariant, string> = {
  default: 'bg-surface-card border border-border-subtle',
  glass: 'glass',
  elevated: 'glass-elevated',
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      title,
      subtitle,
      footer,
      padding = 'md',
      hoverable = false,
      variant = 'default',
      children,
      className = '',
      ...rest
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        className={[
          'rounded-2xl',
          variantClasses[variant],
          paddingClasses[padding],
          hoverable
            ? 'card-interactive hover:border-border-default'
            : '',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      >
        {/* Header */}
        {(title || subtitle) && (
          <div className={`mb-4 ${padding === 'none' ? 'px-6 pt-6' : ''}`}>
            {title && (
              <h3 className="text-lg font-semibold font-display text-text-primary tracking-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
            )}
          </div>
        )}

        {/* Body */}
        {padding === 'none' && !title && !subtitle ? (
          children
        ) : (
          <div>{children}</div>
        )}

        {/* Footer */}
        {footer && (
          <div
            className={[
              'mt-4 pt-4 border-t border-border-subtle',
              padding === 'none' ? 'px-6 pb-6' : '',
            ].join(' ')}
          >
            {footer}
          </div>
        )}
      </div>
    );
  },
);

Card.displayName = 'Card';
