'use client';

import React from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type InputSize = 'sm' | 'md' | 'lg';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  inputSize?: InputSize;
}

/* ------------------------------------------------------------------ */
/*  Style maps                                                         */
/* ------------------------------------------------------------------ */

const sizeClasses: Record<InputSize, string> = {
  sm: 'text-xs px-3 py-2 rounded-md min-h-[36px]',
  md: 'text-sm px-4 py-2.5 rounded-md min-h-[44px]',
  lg: 'text-base px-4 py-3 rounded-md min-h-[48px]',
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, icon, inputSize = 'md', className = '', id, ...rest }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-pen-2"
          >
            {label}
          </label>
        )}

        {/* Input wrapper */}
        <div className="relative">
          {icon && (
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-pen-3 pointer-events-none">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={[
              'w-full text-pen-1 placeholder:text-pen-3',
              'bg-ink-900 border transition-colors duration-150',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus:border-accent/30',
              error
                ? 'border-danger/50 focus-visible:ring-danger/30 focus:border-danger/30'
                : 'border-line-2 hover:border-line-3',
              sizeClasses[inputSize],
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
          <p className="text-xs text-danger mt-0.5">{error}</p>
        )}
        {!error && helperText && (
          <p className="text-xs text-pen-3 mt-0.5">{helperText}</p>
        )}
      </div>
    );
  },
);

Input.displayName = 'Input';
