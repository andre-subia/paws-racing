/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        pixel: ['"Press Start 2P"', 'VT323', 'monospace'],
      },
      colors: {
        neon: {
          cyan: '#42f5e0',
          magenta: '#ff3aa3',
          orange: '#ffb142',
          violet: '#9b59ff',
        },
        ink: '#0b0418',
      },
    },
  },
  plugins: [],
};
