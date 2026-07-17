/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{vue,js}'
  ],
  theme: {
    container: {
      center: true
    },
    extend: {
      colors: {
        paper: '#F5F7FA',
        ink: '#1A1E2E',
        accent: '#5B6EE1',
        mist: '#DDE3F0',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'ui-sans-serif', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
