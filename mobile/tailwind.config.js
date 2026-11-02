/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff1ec',
          100: '#ffd9c8',
          200: '#ffb39c',
          300: '#ff8c6f',
          400: '#ff6b3d',
          500: '#e85223',
          600: '#c1411c',
          700: '#993316',
          800: '#70240f',
          900: '#471607',
        },
      },
    },
  },
  plugins: [],
};
