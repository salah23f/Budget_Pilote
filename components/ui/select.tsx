'use client';

import React from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label?: string;
  options: SelectOption[];
  placeholder?: string;
  error?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, placeholder, error, className = '', id, ...rest }, ref) => {
    const selectId =
      id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="flex flex-col gap-1.5 w-full">
        {/* Label */}
        {label && (
          <label
            htmlFor={selectId}
            className="text-sm font-medium text-pen-2"
          >
            {label}
          </label>
        )}

        {/* Select wrapper */}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={[
              'w-full appearance-none rounded-md px-4 py-2.5 pr-10 text-sm text-pen-1',
              'bg-ink-900 border transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent/30',
              error
                ? 'border-danger/50 focus:ring-danger/40 focus:border-danger/30'
                : 'border-line-2 hover:border-line-3',
              className,
            ]
              .filter(Boolean)
              .join(' ')}
            {...rest}
          >
            {placeholder && (
              <option value="" disabled className="bg-ink-900 text-pen-3">
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className="bg-ink-900 text-pen-1"
              >
                {opt.label}
              </option>
            ))}
          </select>

          {/* Chevron icon */}
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-pen-3">
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 6l4 4 4-4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>

        {/* Error */}
        {error && <p className="text-xs text-danger mt-0.5">{error}</p>}
      </div>
    );
  },
);

Select.displayName = 'Select';
