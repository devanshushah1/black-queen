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
    },
  },
  plugins: [],
};

export default config;
