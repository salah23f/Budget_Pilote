/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // Default sans for UI
        sans: ['var(--font-inter)', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        // Editorial display — Fraunces. Headlines, greetings, destination names.
        serif: ['var(--font-serif)', 'Fraunces', 'ui-serif', 'Georgia', 'serif'],
        // Legacy display — logo wordmark only
        display: ['var(--font-display)', 'Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Data & codes
        mono: ['ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Strict 6-size scale — see docs/design-system.md §2
        micro: ['10.5px', { lineHeight: '1.3', letterSpacing: '0.08em' }],
        caption: ['12px', { lineHeight: '1.4' }],
        body: ['14px', { lineHeight: '1.5' }],
        'body-lg': ['16px', { lineHeight: '1.55' }],
        h2: ['22px', { lineHeight: '1.25', letterSpacing: '-0.01em' }],
        h1: ['32px', { lineHeight: '1.15', letterSpacing: '-0.015em' }],
        display: ['48px', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
      },
      colors: {
        // All values live in globals.css as themed CSS variables.
        // Light (default) = warm paper; .dark = after-hours.
        ink: {
          950: 'var(--ink-950)',
          900: 'var(--ink-900)',
          800: 'var(--ink-800)',
          700: 'var(--ink-700)',
          600: 'var(--ink-600)',
          500: 'var(--ink-500)',
        },
        // Text tones
        pen: {
          1: 'var(--pen-1)',
          2: 'var(--pen-2)',
          3: 'var(--pen-3)',
        },
        // Border levels
        line: {
          1: 'var(--line-1)',
          2: 'var(--line-2)',
          3: 'var(--line-3)',
        },
        // Single primary accent — cedar green. Use rarely (5-10% of screen).
        accent: {
          DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
          soft: 'var(--accent-soft)',
          ink: 'var(--accent-ink)',
          hover: 'var(--accent-hover)',
          // Legacy gradient stops — degrade to solid accent
          light: 'var(--accent-hover)',
          dark: 'rgb(var(--accent-rgb) / <alpha-value>)',
        },
        // Semantic
        success: {
          DEFAULT: 'rgb(var(--success-rgb) / <alpha-value>)',
          soft: 'var(--success-soft)',
        },
        danger: {
          DEFAULT: 'rgb(var(--danger-rgb) / <alpha-value>)',
          soft: 'var(--danger-soft)',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning-rgb) / <alpha-value>)',
          soft: 'var(--warning-soft)',
        },

        // Legacy aliases — keep temporarily for incremental migration
        surface: {
          primary: 'var(--ink-950)',
          elevated: 'var(--ink-800)',
          card: 'var(--ink-800)',
        },
        border: {
          subtle: 'var(--line-1)',
          DEFAULT: 'var(--line-2)',
        },
        text: {
          primary: 'var(--pen-1)',
          secondary: 'var(--pen-2)',
          muted: 'var(--pen-3)',
        },
      },
      borderRadius: {
        // 4-size scale — buttons/inputs md, cards lg, hero xl
        none: '0',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
        full: '9999px',
      },
      boxShadow: {
        // Themed: soft warm shadows in light, surface lift in dark.
        'elev-1': 'var(--shadow-1)',
        'elev-2': 'var(--shadow-2)',
        'elev-3': 'var(--shadow-3)',
        // Legacy glow classes — neutralized (no glow in this design system)
        glow: '0 0 0 0 rgba(0,0,0,0)',
        'glow-lg': '0 0 0 0 rgba(0,0,0,0)',
      },
      maxWidth: {
        prose: '640px',
        content: '960px',
        wide: '1200px',
      },
      transitionTimingFunction: {
        'default': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'entrance': 'cubic-bezier(0.16, 1, 0.3, 1)',
        'exit': 'cubic-bezier(0.4, 0, 1, 1)',
      },
      transitionDuration: {
        'default': '160ms',
        'entrance': '280ms',
      },
    },
  },
  plugins: [],
};
