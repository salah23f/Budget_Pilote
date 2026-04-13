'use client';

import React from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type PaddingSize = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  footer?: React.ReactNode;
  padding?: PaddingSize;
  hoverable?: boolean;
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
          'glass rounded-2xl',
          paddingClasses[padding],
          hoverable
            ? 'card-interactive hover:border-white/[0.14] hover:shadow-lg hover:shadow-amber-500/5'
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
              <h3 className="text-lg font-semibold text-white tracking-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="mt-1 text-sm text-white/55">{subtitle}</p>
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
              'mt-4 pt-4 border-t border-white/[0.07]',
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
