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
/*  CSS injected once                                                  */
/* ------------------------------------------------------------------ */

const SHIMMER_STYLE_ID = 'bp-skeleton-shimmer';

function ensureShimmerStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(SHIMMER_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = SHIMMER_STYLE_ID;
  style.textContent = `
    @keyframes bp-shimmer {
      0%   { background-position: -400px 0; }
      100% { background-position: 400px 0;  }
    }
    .bp-shimmer {
      background: linear-gradient(
        90deg,
        rgba(255,255,255,0.03) 0%,
        rgba(255,255,255,0.07) 40%,
        rgba(255,255,255,0.03) 80%
      );
      background-size: 800px 100%;
      animation: bp-shimmer 2s ease-in-out infinite;
    }
  `;
  document.head.appendChild(style);
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
  React.useEffect(() => ensureShimmerStyles(), []);

  const base = 'bp-shimmer rounded';

  const variantClass = (() => {
    switch (variant) {
      case 'text':
        return `${textHeights[size]} w-full rounded-md`;
      case 'circle':
        return `${circleSize[size]} rounded-full`;
      case 'rect':
        return `${rectHeights[size]} w-full rounded-xl`;
      case 'card':
        return 'w-full rounded-2xl p-6 space-y-4 glass';
      default:
        return '';
    }
  })();

  if (variant === 'card') {
    return (
      <div className={`${variantClass} ${className}`} {...rest}>
        <div className={`bp-shimmer h-5 w-2/5 rounded-md`} />
        <div className={`bp-shimmer h-4 w-4/5 rounded-md`} />
        <div className={`bp-shimmer h-4 w-3/5 rounded-md`} />
        <div className={`bp-shimmer h-24 w-full rounded-xl`} />
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
