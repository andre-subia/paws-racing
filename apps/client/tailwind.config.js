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
          cyan: '#00e8ff',
          magenta: '#ff2dd1',
          orange: '#ff7a1a',
          violet: '#8a2cff',
          yellow: '#ffd400',
          green: '#3bff7a',
        },
        ink: '#0a0420',
      },
    },
  },
  plugins: [],
};
