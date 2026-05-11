import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#080d1a',
          900: '#0c1424',
          850: '#10192c',
          800: '#152038',
          700: '#1d2c4d',
          600: '#293c66',
        },
        teal: {
          DEFAULT: '#2de2d4',
          50: '#e6fffd',
          100: '#b3fff8',
          300: '#5cf2e6',
          400: '#2de2d4',
          500: '#14c4b8',
          600: '#0e9d94',
        },
        amber: {
          DEFAULT: '#f5b942',
          400: '#f5b942',
          500: '#e2a02a',
          600: '#b87f1f',
        },
        status: {
          pending: '#3b82f6',
          active: '#f5b942',
          parallel: '#fb923c',
          blocked: '#ef4444',
          requirements: '#a855f7',
          hold: '#64748b',
          completed: '#22c55e',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Space Grotesk"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      backgroundImage: {
        'navy-gradient':
          'radial-gradient(ellipse at top, rgba(45, 226, 212, 0.08), transparent 50%), linear-gradient(180deg, #080d1a 0%, #0c1424 100%)',
      },
      boxShadow: {
        glass: '0 8px 32px 0 rgba(8, 13, 26, 0.45)',
        'teal-glow': '0 0 24px rgba(45, 226, 212, 0.35)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

export default config;
