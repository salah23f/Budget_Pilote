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
  primary:
    'bg-gradient-to-r from-accent-light to-accent-dark text-white font-semibold shadow-glow hover:shadow-glow-lg hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-all duration-200',
  secondary:
    'bg-surface-card text-text-primary border border-border-default hover:bg-white/[0.08] hover:border-border-default transition-colors',
  ghost:
    'bg-transparent text-text-secondary hover:bg-white/[0.06] hover:text-text-primary transition-colors border border-transparent',
  outline:
    'bg-transparent text-accent border border-accent/30 hover:bg-accent/10 hover:border-accent/50 transition-colors',
  danger:
    'bg-red-500/15 text-red-300 border border-red-500/25 hover:bg-red-500/25 transition-colors',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'text-xs px-3.5 py-2 rounded-lg gap-1.5 min-h-[36px]',
  md: 'text-sm px-5 py-2.5 rounded-xl gap-2 min-h-[44px]',
  lg: 'text-base px-7 py-3.5 rounded-xl gap-2.5 min-h-[48px]',
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
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary',
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
