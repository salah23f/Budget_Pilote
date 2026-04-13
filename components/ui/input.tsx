'use client';

import React from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon, className = '', id, ...rest }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-white/70"
          >
            {label}
          </label>
        )}

        {/* Input wrapper */}
        <div className="relative">
          {icon && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={[
              'w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/35',
              'bg-white/[0.06] backdrop-blur-md border transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/30',
              error
                ? 'border-red-500/50 focus:ring-red-400/40 focus:border-red-400/30'
                : 'border-white/[0.09] hover:border-white/[0.15]',
              icon ? 'pl-10' : '',
              className,
            ]
              .filter(Boolean)
              .join(' ')}
            {...rest}
          />
        </div>

        {/* Error / helper */}
        {error && (
          <p className="text-xs text-red-400 mt-0.5">{error}</p>
        )}
        {!error && helperText && (
          <p className="text-xs text-white/45 mt-0.5">{helperText}</p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
