/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#eef0f8',
          100: '#d5d9ee',
          200: '#aab3dd',
          300: '#7f8dcc',
          400: '#5467bb',
          500: '#3a4fa8',
          600: '#2d3f96',
          700: '#222d64',
          800: '#1a2350',
          900: '#11183c',
          950: '#090e22',
        },
        yellow: {
          brand: '#f9b106',
        },
      },
    },
  },
  plugins: [],
};
