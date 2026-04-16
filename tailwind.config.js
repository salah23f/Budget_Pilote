/** @type {import('tailwindcss').Config} */
module.exports = {
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
        // Editorial serif — hero headlines, greetings, section intros
        serif: ['var(--font-serif)', 'Fraunces', 'ui-serif', 'Georgia', 'serif'],
        // Legacy display — logo wordmark only
        display: ['var(--font-display)', 'Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Data & codes
        mono: ['ui-monospace', 'SF Mono', 'Menlo', 'monospace'],
      },
      fontSize: {
        // Strict 6-size scale — see design-system.md §2
        micro: ['10.5px', { lineHeight: '1.3', letterSpacing: '0.08em' }],
        caption: ['12px', { lineHeight: '1.4' }],
        body: ['14px', { lineHeight: '1.5' }],
        'body-lg': ['16px', { lineHeight: '1.55' }],
        h2: ['22px', { lineHeight: '1.25', letterSpacing: '-0.01em' }],
        h1: ['32px', { lineHeight: '1.15', letterSpacing: '-0.015em' }],
        display: ['48px', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
      },
      colors: {
        // New ink scale (warm off-black surfaces)
        ink: {
          950: '#0B0B0D',
          900: '#111114',
          800: '#17171B',
          700: '#1D1D22',
          600: '#26262C',
          500: '#32323A',
        },
        // Text tones
        pen: {
          1: '#F5F5F1', // primary
          2: '#A9A9A4', // secondary
          3: '#6E6E68', // muted
        },
        // Border levels
        line: {
          1: '#1A1A1D', // subtle
          2: '#252528', // hover / interactive
          3: '#2F2F34', // focused / strong
        },
        // Single primary accent — use rarely (5-10% of screen)
        accent: {
          DEFAULT: '#D4A24C',
          soft: 'rgba(212,162,76,0.12)',
          ink: '#0B0B0D', // foreground on solid accent bg
        },
        // Semantic
        success: {
          DEFAULT: '#4F8A6E',
          soft: 'rgba(79,138,110,0.12)',
        },
        danger: {
          DEFAULT: '#A14848',
          soft: 'rgba(161,72,72,0.12)',
        },
        warning: {
          DEFAULT: '#B8893C',
        },

        // Legacy aliases — keep temporarily for incremental migration
        surface: {
          primary: '#0B0B0D',
          elevated: '#17171B',
          card: '#17171B',
        },
        border: {
          subtle: '#1A1A1D',
          DEFAULT: '#252528',
        },
        text: {
          primary: '#F5F5F1',
          secondary: '#A9A9A4',
          muted: '#6E6E68',
        },
      },
      borderRadius: {
        // 4-size scale — see design-system.md §5
        none: '0',
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
        full: '9999px',
      },
      boxShadow: {
        // Subtle only. No glow. No accent shadows.
        'elev-1': '0 1px 0 rgba(0,0,0,0.2) inset',
        'elev-2': '0 8px 24px -8px rgba(0,0,0,0.4)',
        'elev-3': '0 24px 48px -12px rgba(0,0,0,0.5)',
      },
      spacing: {
        // Match 4px base — 0.5 = 2px through 24 = 96px
        // Tailwind has most of these natively; we add the 0.5 step explicitly.
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
