'use client';

import React from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type SkeletonVariant = 'text' | 'circle' | 'rect' | 'card';
type SkeletonSize = 'sm' | 'md' | 'lg';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant;
  size?: SkeletonSize;
  width?: string | number;
  height?: string | number;
}

/* ------------------------------------------------------------------ */
/*  Dimension helpers                                                  */
/* ------------------------------------------------------------------ */

const textHeights: Record<SkeletonSize, string> = {
  sm: 'h-3',
  md: 'h-4',
  lg: 'h-5',
};

const circleSize: Record<SkeletonSize, string> = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
};

const rectHeights: Record<SkeletonSize, string> = {
  sm: 'h-20',
  md: 'h-32',
  lg: 'h-48',
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function Skeleton({
  variant = 'text',
  size = 'md',
  width,
  height,
  className = '',
  style: styleProp,
  ...rest
}: SkeletonProps) {
  const base = 'flyeas-shimmer rounded';

  const variantClass = (() => {
    switch (variant) {
      case 'text':
        return `${textHeights[size]} w-full rounded-md`;
      case 'circle':
        return `${circleSize[size]} rounded-full`;
      case 'rect':
        return `${rectHeights[size]} w-full rounded-lg`;
      case 'card':
        return 'w-full rounded-lg p-6 space-y-4 bg-ink-800 border border-line-1';
      default:
        return '';
    }
  })();

  if (variant === 'card') {
    return (
      <div className={`${variantClass} ${className}`} {...rest}>
        <div className={`flyeas-shimmer h-5 w-2/5 rounded-md`} />
        <div className={`flyeas-shimmer h-4 w-4/5 rounded-md`} />
        <div className={`flyeas-shimmer h-4 w-3/5 rounded-md`} />
        <div className={`flyeas-shimmer h-24 w-full rounded-lg`} />
      </div>
    );
  }

  return (
    <div
      className={`${base} ${variantClass} ${className}`}
      style={{
        ...(width ? { width: typeof width === 'number' ? `${width}px` : width } : {}),
        ...(height ? { height: typeof height === 'number' ? `${height}px` : height } : {}),
        ...styleProp,
      }}
      {...rest}
    />
  );
}
