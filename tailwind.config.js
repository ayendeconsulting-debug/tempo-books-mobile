/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#0F6E56',
        'primary-light': '#EDF7F2',
        'primary-dark': '#0a5240',
        danger: '#DC2626',
        warning: '#D97706',
        success: '#16A34A',
      },
    },
  },
  plugins: [],
};
