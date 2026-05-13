import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        felt: { 900: '#073322', 800: '#115540', 700: '#1f6b50' },
        gold: { 400: '#ffd455', 500: '#f4c842', 600: '#d4a830' },
        cardred: '#c52a2a',
        cardblack: '#1d1d1f',
      },
      fontFamily: {
        serif: ['Georgia', 'Times New Roman', 'serif'],
      },
      boxShadow: {
        'card-rest': '0 4px 8px rgba(0,0,0,0.4)',
        'card-hover': '0 12px 24px rgba(0,0,0,0.55)',
        'card-glow-gold': '0 0 18px 4px #d4a437',
      },
      transitionTimingFunction: {
        'cozy': 'cubic-bezier(.2,.7,.2,1)',
      },
    },
  },
  plugins: [],
};

export default config;
