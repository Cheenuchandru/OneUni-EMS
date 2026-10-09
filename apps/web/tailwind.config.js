/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
          950: '#022c22',
        },
        oneuni: {
          dark: '#051812',
          card: '#08241b',
          border: '#0d382b',
          accent: '#10b981',
          gold: '#f59e0b',
        },
        slate: {
          850: '#0d1f19',
          950: '#040d0a',
        }
      },
    },
  },
  plugins: [],
};

