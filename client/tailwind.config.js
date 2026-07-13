/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        glass: 'rgba(255,255,255,0.1)',
        'glass-dark': 'rgba(0,0,0,0.4)',
        brandPrimary: '#06B6D4', // cyan accent
        brandSecondary: '#7C3AED', // purple accent
        brandDark: '#0f172a', // deep slate background
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};
