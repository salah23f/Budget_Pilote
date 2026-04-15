'use client';

import React from 'react';

interface SeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
  decorative?: boolean;
}

export const Separator = React.forwardRef<HTMLDivElement, SeparatorProps>(
  ({ orientation = 'horizontal', decorative = true, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        role={decorative ? 'none' : 'separator'}
        aria-orientation={decorative ? undefined : orientation}
        className={[
          'shrink-0 bg-white/[0.06]',
          orientation === 'horizontal' ? 'h-px w-full' : 'h-full w-px',
          className,
        ].join(' ')}
        {...props}
      />
    );
  }
);

Separator.displayName = 'Separator';
