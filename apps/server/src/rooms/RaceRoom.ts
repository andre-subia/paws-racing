import { Client, Room } from '@colyseus/core';
import {
  type BikeState,
  BROADCAST_DT,
  COUNTDOWN_MS,
  emptyBikeState,
  type InputCommand,
  LAPS_PER_RACE,
  MAX_PLAYERS_PER_ROOM,
  PlayerState,
  RaceState,
  SIM_DT,
  SIM_HZ,
  stepBike,
  VEHICLES,
  type VehicleId,
  yawToQuat,
} from '@paws/shared';
import { generateCode, normalizeCode } from '../codes.js';
import { logger } from '../logger.js';

interface JoinOptions {
  name?: string;
  vehicle?: VehicleId;
  code?: string;
}

interface PendingInput {
  seq: number;
  flags: number;
}

/**
 * Unified lobby + race room. Phases: waiting → countdown → racing → finished.
 * Solo-MVP simplification vs. the original plan's two-room split — one state
 * machine in one room is materially simpler to ship.
 */
export class RaceRoom extends Room<RaceState> {
  override maxClients = MAX_PLAYERS_PER_ROOM;
  override autoDispose = true;

  private inputQueue = new Map<string, PendingInput[]>();
  private bikeStates = new Map<string, BikeState>();

  override onCreate(options: JoinOptions) {
    this.setState(new RaceState());
    const requestedCode = options.code ? normalizeCode(options.code) : '';
    this.state.code = requestedCode || generateCode();
    // Persisted on the room metadata so filterBy can match join-by-code.
    this.setMetadata({ code: this.state.code });

    this.setPatchRate(1000 * BROADCAST_DT);

    this.onMessage('input', (client, msg: InputCommand) => {
      if (this.state.phase !== 'racing' && this.state.phase !== 'countdown') return;
      const queue = this.inputQueue.get(client.sessionId);
      if (!queue) return;
      const last = queue.at(-1);
      if (last && msg.seq <= last.seq) return;
      queue.push({ seq: msg.seq, flags: msg.flags });
      if (queue.length > 60) queue.splice(0, queue.length - 60);
    });

    this.onMessage('ready', (client) => {
      if (this.state.phase !== 'waiting') return;
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      p.ready = !p.ready;
    });

    this.onMessage('vehicle', (client, payload: { vehicle: VehicleId }) => {
      if (this.state.phase !== 'waiting') return;
      const p = this.state.players.get(client.sessionId);
      if (!p) return;
      if (payload.vehicle === 'scout' || payload.vehicle === 'bruiser') {
        p.vehicle = payload.vehicle;
      }
    });

    this.onMessage('start', (client) => {
      if (this.state.phase !== 'waiting') return;
      if (this.state.hostId !== client.sessionId) return;
      this.startCountdown();
    });

    this.setSimulationInterval((dtMs) => this.tick(dtMs / 1000), 1000 / SIM_HZ);
  }

  override async onJoin(client: Client, options: JoinOptions = {}) {
    if (this.state.phase !== 'waiting') {
      throw new Error('race already started');
    }

    const vehicle: VehicleId = options.vehicle === 'bruiser' ? 'bruiser' : 'scout';
    const player = new PlayerState();
    player.id = client.sessionId;
    player.name = (options.name ?? 'Racer').slice(0, 16) || 'Racer';
    player.vehicle = vehicle;
    player.host = this.state.players.size === 0;
    if (player.host) this.state.hostId = client.sessionId;

    const slot = this.state.players.size;
    const bike = emptyBikeState();
    bike.x = (slot - (MAX_PLAYERS_PER_ROOM - 1) / 2) * 2.5;
    this.bikeStates.set(client.sessionId, bike);

    syncToSchema(bike, player);
    this.state.players.set(client.sessionId, player);
    this.inputQueue.set(client.sessionId, []);

    logger.info(
      {
        room: this.roomId,
        code: this.state.code,
        sid: client.sessionId,
        name: player.name,
        host: player.host,
      },
      'player joined',
    );
  }

  override async onLeave(client: Client, consented: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    if (consented) {
      this.removePlayer(client.sessionId);
      return;
    }

    player.connected = false;
    try {
      await this.allowReconnection(client, 20);
      player.connected = true;
      logger.info({ sid: client.sessionId }, 'reconnected');
    } catch {
      this.removePlayer(client.sessionId);
    }
  }

  override onDispose() {
    logger.info({ room: this.roomId, code: this.state.code }, 'room disposed');
  }

  private removePlayer(sid: string) {
    this.state.players.delete(sid);
    this.inputQueue.delete(sid);
    this.bikeStates.delete(sid);
    if (this.state.hostId === sid) {
      const next = this.state.players.keys().next().value as string | undefined;
      this.state.hostId = next ?? '';
      if (next) {
        const p = this.state.players.get(next);
        if (p) p.host = true;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Phase transitions
  // ---------------------------------------------------------------------------

  private startCountdown() {
    this.state.phase = 'countdown';
    this.state.countdownEndsAt = Date.now() + COUNTDOWN_MS;
    // Reset positions to the starting grid in case people moved around.
    let slot = 0;
    for (const [sid, player] of this.state.players) {
      const bike = this.bikeStates.get(sid) ?? emptyBikeState();
      bike.x = (slot - (this.state.players.size - 1) / 2) * 2.5;
      bike.y = 0.5;
      bike.z = 0;
      bike.yaw = 0;
      bike.vx = 0;
      bike.vz = 0;
      bike.speed = 0;
      bike.drifting = false;
      this.bikeStates.set(sid, bike);
      syncToSchema(bike, player);
      player.lap = 0;
      player.checkpoint = -1;
      player.finishedAt = 0;
      slot += 1;
    }
    logger.info({ room: this.roomId, code: this.state.code }, 'countdown started');
  }

  // ---------------------------------------------------------------------------
  // Simulation
  // ---------------------------------------------------------------------------

  private tick(dt: number) {
    this.state.tick += 1;
    this.state.serverTime = Date.now();

    if (this.state.phase === 'countdown' && this.state.serverTime >= this.state.countdownEndsAt) {
      this.state.phase = 'racing';
      logger.info({ room: this.roomId, code: this.state.code }, 'race started');
    }

    if (this.state.phase !== 'racing' && this.state.phase !== 'countdown') {
      // Drain stale input queues (e.g. from disconnects mid-state-transition).
      for (const q of this.inputQueue.values()) q.length = 0;
      return;
    }

    // Inputs are accepted in 'racing' only — during countdown the bike sits still.
    const acceptInputs = this.state.phase === 'racing';

    for (const [sid, player] of this.state.players) {
      const bike = this.bikeStates.get(sid);
      if (!bike) continue;
      const spec = VEHICLES[(player.vehicle as VehicleId) in VEHICLES ? (player.vehicle as VehicleId) : 'scout'];
      const queue = this.inputQueue.get(sid);

      if (!acceptInputs || !queue || queue.length === 0) {
        stepBike(bike, 0, dt, spec);
      } else {
        const n = queue.length;
        const sub = dt / n;
        for (let i = 0; i < n; i++) {
          const cmd = queue.shift()!;
          stepBike(bike, cmd.flags, sub, spec);
          player.lastSeq = cmd.seq;
        }
      }

      syncToSchema(bike, player);
    }

    for (const p of this.state.players.values()) {
      if (p.lap > LAPS_PER_RACE) p.lap = LAPS_PER_RACE;
    }
  }
}

function syncToSchema(bike: BikeState, player: PlayerState) {
  player.position.x = bike.x;
  player.position.y = bike.y;
  player.position.z = bike.z;
  player.velocity.x = bike.vx;
  player.velocity.y = 0;
  player.velocity.z = bike.vz;
  player.speed = bike.speed;
  player.drifting = bike.drifting;
  const q = yawToQuat(bike.yaw);
  player.rotation.x = q.x;
  player.rotation.y = q.y;
  player.rotation.z = q.z;
  player.rotation.w = q.w;
}
