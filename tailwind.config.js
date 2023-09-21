/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{html, js}"],
  theme: {
    extend: {
      screens: {
        'lgxl': '1100px',  // Or whatever pixel value you want as the in-between size
      },
      colors: {
        'forest': '#004643',
        'white': '#fffffe',
        'off-white': '#e8e4e6',
        'forest-light': '#abd1c6',
        'yellow': '#f9bc60',
        'forest-dark': '#001e1d',
        'gray-light': '#e8e4e6',
        'red': '#e16162',
      }
    },
  },
  plugins: [],
}

