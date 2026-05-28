import { Server } from '@colyseus/core';
import { monitor } from '@colyseus/monitor';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROOM_NAMES } from '@paws/shared';
import { config } from './config.js';
import { logger } from './logger.js';
import { RaceRoom } from './rooms/RaceRoom.js';

const app = express();

app.get('/health', (_req, res) => {
  res.json({ ok: true, env: config.env });
});

// Static client. In production we ship the built client dist alongside the
// server so a single URL serves both. In dev this directory may not exist —
// it's fine, Vite serves the client separately.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistCandidates = [
  process.env.CLIENT_DIST_PATH,
  path.resolve(process.cwd(), 'apps/client/dist'),
  path.resolve(__dirname, '../../client/dist'),
  path.resolve(__dirname, '../../../client/dist'),
].filter((p): p is string => Boolean(p));
const clientDist = clientDistCandidates.find((p) => existsSync(path.join(p, 'index.html')));
if (clientDist) {
  logger.info({ clientDist }, 'serving client static files');
  app.use(express.static(clientDist));
}

app.use(config.monitorPath, monitor());

// SPA fallback so direct loads of '/race', '/lobby', etc. resolve to index.html.
// Skip API/WS paths so they keep their handlers.
if (clientDist) {
  app.get(/^(?!\/(matchmake|health|colyseus)).*/, (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

const httpServer = createServer(app);

const gameServer = new Server({
  // Be lenient with heartbeats: mobile/Wi-Fi lag spikes shouldn't drop a live
  // race. ~5 missed pings at 6s ≈ 30s of grace before the socket is closed
  // (well within the 20s allowReconnection window the room also grants).
  transport: new WebSocketTransport({
    server: httpServer,
    pingInterval: 6000,
    pingMaxRetries: 5,
  }),
});

gameServer.define(ROOM_NAMES.RACE, RaceRoom).filterBy(['code']);

gameServer
  .listen(config.port)
  .then(() => logger.info({ port: config.port, env: config.env }, 'paws-racing server up'))
  .catch((err) => {
    logger.error({ err }, 'failed to start');
    process.exit(1);
  });
