'use client';

import React from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Style maps                                                         */
/* ------------------------------------------------------------------ */

const variantClasses: Record<ButtonVariant, string> = {
  // Solid accent — no gradient, no glow (DS v3 §9)
  primary:
    'bg-accent text-accent-ink font-semibold hover:bg-accent-hover active:scale-[0.98] transition-all duration-default',
  secondary:
    'bg-ink-800 text-pen-1 border border-line-2 hover:bg-ink-600 hover:border-line-3 transition-colors',
  ghost:
    'bg-transparent text-pen-2 hover:bg-ink-600 hover:text-pen-1 transition-colors border border-transparent',
  outline:
    'bg-transparent text-accent border border-accent/30 hover:bg-accent/10 hover:border-accent/50 transition-colors',
  danger:
    'bg-danger/10 text-danger border border-danger/25 hover:bg-danger/20 transition-colors',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'text-xs px-3.5 py-2 rounded-md gap-1.5 min-h-[36px]',
  md: 'text-sm px-5 py-2.5 rounded-md gap-2 min-h-[44px]',
  lg: 'text-base px-7 py-3.5 rounded-md gap-2.5 min-h-[48px]',
};

/* ------------------------------------------------------------------ */
/*  Spinner                                                            */
/* ------------------------------------------------------------------ */

function Spinner({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      fullWidth = false,
      disabled,
      children,
      className = '',
      ...rest
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={[
          'inline-flex items-center justify-center font-medium select-none',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth ? 'w-full' : '',
          isDisabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer',
          className,
        ]
          .filter(Boolean)
          .join(' ')}
        {...rest}
      >
        {loading ? <Spinner /> : icon ? icon : null}
        {children}
      </button>
    );
  },
);

Button.displayName = 'Button';
