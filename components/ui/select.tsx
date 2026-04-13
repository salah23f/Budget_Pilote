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
            className="text-sm font-medium text-white/70"
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
              'w-full appearance-none rounded-xl px-4 py-2.5 pr-10 text-sm text-white',
              'bg-white/[0.06] backdrop-blur-md border transition-colors duration-150',
              'focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-400/30',
              error
                ? 'border-red-500/50 focus:ring-red-400/40 focus:border-red-400/30'
                : 'border-white/[0.09] hover:border-white/[0.15]',
              className,
            ]
              .filter(Boolean)
              .join(' ')}
            {...rest}
          >
            {placeholder && (
              <option value="" disabled className="bg-[#1C1917] text-white/50">
                {placeholder}
              </option>
            )}
            {options.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className="bg-[#1C1917] text-white"
              >
                {opt.label}
              </option>
            ))}
          </select>

          {/* Chevron icon */}
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40">
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
        {error && <p className="text-xs text-red-400 mt-0.5">{error}</p>}
      </div>
    );
  },
);

Select.displayName = 'Select';
