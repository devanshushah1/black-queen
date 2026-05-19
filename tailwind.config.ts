import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: {
          900: '#03140e',
          800: '#073523',
          700: '#0c5537',
          500: '#12774e',
        },
        gold: {
          300: '#ffebad',
          400: '#fce38a',
          500: '#d4a52d',
          600: '#a37c1e',
        },
        wood: {
          dark: '#1a0f0a',
          light: '#362217',
        },
        cardred: '#c52a2a',
        cardblack: '#1d1d1f',
      },
      fontFamily: {
        serif: ['var(--font-playfair)', 'Georgia', 'Times New Roman', 'serif'],
        sans: ['var(--font-outfit)', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'card-rest': '0 6px 12px rgba(0,0,0,0.5)',
        'card-hover': '0 16px 32px rgba(0,0,0,0.7), 0 0 10px rgba(212,165,45,0.25)',
        'card-glow-gold': '0 0 20px 4px rgba(212,165,45,0.45)',
        'glass': 'inset 0 1px 1px rgba(255,255,255,0.1), 0 8px 32px rgba(0,0,0,0.4)',
        'glass-gold': 'inset 0 1px 2px rgba(255,255,255,0.2), 0 0 20px rgba(212,165,45,0.3)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 20s linear infinite',
      },
      transitionTimingFunction: {
        'cozy': 'cubic-bezier(.2,.7,.2,1)',
      },
    },
  },
  plugins: [],
};

export default config;
