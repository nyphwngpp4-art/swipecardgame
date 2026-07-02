/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: {
          900: '#0F1B14',
          800: '#142318',
          700: '#1A2E22',
          600: '#22392B',
        },
        bone: {
          50: '#FAF6EC',
          100: '#F4EDE0',
          200: '#E8DDC4',
        },
        oxblood: {
          500: '#A8231F',
          600: '#8B1C19',
          700: '#6F1714',
        },
        brass: {
          400: '#E8C879',
          500: '#C9A961',
          600: '#A38847',
        },
        ink: '#0A0A0A',
      },
      fontFamily: {
        display: ['"Fraunces Variable"', '"Fraunces"', 'serif'],
        sans: ['"DM Sans Variable"', '"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"DM Mono"', 'monospace'],
      },
      boxShadow: {
        card: '0 2px 8px rgba(0,0,0,0.35), 0 1px 2px rgba(0,0,0,0.25)',
        'card-lifted': '0 12px 28px rgba(0,0,0,0.45), 0 4px 8px rgba(0,0,0,0.3)',
        'glow-brass': '0 0 0 2px rgba(232,200,121,0.6), 0 0 24px rgba(232,200,121,0.35)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 1.6s ease-in-out infinite',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 0 2px rgba(232,200,121,0.4), 0 0 18px rgba(232,200,121,0.2)' },
          '50%': { boxShadow: '0 0 0 2px rgba(232,200,121,0.8), 0 0 32px rgba(232,200,121,0.5)' },
        },
      },
    },
  },
  plugins: [],
};
