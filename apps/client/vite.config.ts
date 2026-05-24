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
    // Allow any ngrok subdomain so the dev server is reachable through a
    // shared tunnel without re-editing the config each session. The leading
    // dot tells Vite to treat it as a suffix match.
    allowedHosts: ['.ngrok-free.app', '.ngrok.app', '.ngrok.io'],
    // Forward Colyseus traffic (matchmaking HTTP + room WebSocket) to the
    // local game server, so a single ngrok tunnel on the Vite port can
    // serve the whole game. Client picks this prefix automatically when
    // the page is loaded from a non-localhost host.
    proxy: {
      '/colyseus': {
        target: 'http://localhost:2567',
        ws: true,
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/colyseus/, ''),
      },
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
  },
});
