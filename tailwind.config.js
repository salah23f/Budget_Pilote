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
        sans: ['var(--font-inter)', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['var(--font-display)', 'Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        surface: {
          primary: '#09090B',
          elevated: '#18181B',
          card: 'rgba(255, 255, 255, 0.04)',
        },
        border: {
          subtle: 'rgba(255, 255, 255, 0.06)',
          DEFAULT: 'rgba(255, 255, 255, 0.10)',
        },
        accent: {
          DEFAULT: '#E8A317',
          light: '#F5BE3A',
          dark: '#C78B0F',
          muted: 'rgba(232, 163, 23, 0.15)',
        },
        text: {
          primary: '#FAFAF9',
          secondary: '#A8A29E',
          muted: '#78716C',
        },
      },
      borderRadius: {
        'sm': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
        '2xl': '24px',
      },
      boxShadow: {
        'sm': '0 2px 8px rgba(0, 0, 0, 0.15)',
        'md': '0 4px 16px rgba(0, 0, 0, 0.2)',
        'lg': '0 8px 32px rgba(0, 0, 0, 0.25)',
        'xl': '0 16px 48px rgba(0, 0, 0, 0.3)',
        'glow': '0 0 24px rgba(232, 163, 23, 0.15)',
        'glow-lg': '0 0 48px rgba(232, 163, 23, 0.2)',
      },
    },
  },
  plugins: [],
};
