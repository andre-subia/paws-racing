import { Server } from '@colyseus/core';
import { monitor } from '@colyseus/monitor';
import { WebSocketTransport } from '@colyseus/ws-transport';
import express from 'express';
import { createServer } from 'node:http';
import { ROOM_NAMES } from '@paws/shared';
import { config } from './config.ts';
import { logger } from './logger.ts';
import { RaceRoom } from './rooms/RaceRoom.ts';

const app = express();

app.get('/health', (_req, res) => {
  res.json({ ok: true, env: config.env });
});

app.use(config.monitorPath, monitor());

const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define(ROOM_NAMES.RACE, RaceRoom);

gameServer
  .listen(config.port)
  .then(() => logger.info({ port: config.port, env: config.env }, 'paws-racing server up'))
  .catch((err) => {
    logger.error({ err }, 'failed to start');
    process.exit(1);
  });
