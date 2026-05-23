import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// GitHub Pages serves under /paws-racing/ in production; root in dev.
const base = process.env.GITHUB_PAGES === '1' ? '/paws-racing/' : '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
