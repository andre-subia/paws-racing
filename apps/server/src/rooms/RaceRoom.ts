import { Client, Room } from '@colyseus/core';
import {
  type BikeState,
  BROADCAST_DT,
  COUNTDOWN_MS,
  emptyBikeState,
  getTrack,
  type InputCommand,
  LAPS_PER_RACE,
  MAX_PLAYERS_PER_ROOM,
  PlayerState,
  RaceState,
  SIM_HZ,
  stepBike,
  type TrackDef,
  VEHICLES,
  type VehicleId,
  yawToQuat,
} from '@paws/shared';
import { generateCode, normalizeCode } from '../codes.js';
import { logger } from '../logger.js';
import {
  advanceCheckpoint,
  type BoostCooldowns,
  type GateMemory,
  resolveBikeCollisions,
  tickBoostPads,
} from '../sim/race.js';

interface JoinOptions {
  name?: string;
  vehicle?: VehicleId;
  code?: string;
  trackId?: string;
}

interface PendingInput {
  seq: number;
  flags: number;
}

const FINISH_HOLD_MS = 4000;

export class RaceRoom extends Room<RaceState> {
  override maxClients = MAX_PLAYERS_PER_ROOM;
  override autoDispose = true;

  private inputQueue = new Map<string, PendingInput[]>();
  private bikeStates = new Map<string, BikeState>();
  private gateMem = new Map<string, GateMemory>();
  private boostCooldowns = new Map<string, BoostCooldowns>();

  private track!: TrackDef;
  private finishedAt = 0; // serverTime when race finished, for hold-then-reset

  override onCreate(options: JoinOptions) {
    this.setState(new RaceState());
    const requestedCode = options.code ? normalizeCode(options.code) : '';
    this.state.code = requestedCode || generateCode();
    this.setMetadata({ code: this.state.code });

    this.track = getTrack(options.trackId ?? this.state.trackId);
    this.state.trackId = this.track.id;

    this.setPatchRate(1000 * BROADCAST_DT);

    this.onMessage('input', (client, msg: InputCommand) => {
      if (this.state.phase !== 'racing') return;
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
    const spawn =
      this.track.spawnPoints[slot] ??
      this.track.spawnPoints[this.track.spawnPoints.length - 1]!;
    const bike = emptyBikeState();
    bike.x = spawn.x;
    bike.y = this.track.surfaceY + 0.5;
    bike.z = spawn.z;
    bike.yaw = spawn.yaw;
    this.bikeStates.set(client.sessionId, bike);
    this.gateMem.set(client.sessionId, { lastSignedDist: -1 });
    this.boostCooldowns.set(client.sessionId, new Map());

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
    this.gateMem.delete(sid);
    this.boostCooldowns.delete(sid);
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
    this.state.finishOrder.clear();
    this.finishedAt = 0;

    let slot = 0;
    for (const [sid, player] of this.state.players) {
      const spawn =
        this.track.spawnPoints[slot] ??
        this.track.spawnPoints[this.track.spawnPoints.length - 1]!;
      const bike = this.bikeStates.get(sid) ?? emptyBikeState();
      bike.x = spawn.x;
      bike.y = this.track.surfaceY + 0.5;
      bike.z = spawn.z;
      bike.yaw = spawn.yaw;
      bike.vx = 0;
      bike.vz = 0;
      bike.speed = 0;
      bike.drifting = false;
      this.bikeStates.set(sid, bike);
      syncToSchema(bike, player);
      player.lap = 0;
      player.checkpoint = -1;
      player.finishedAt = 0;
      player.position_rank = 0;
      player.boostUntil = 0;
      player.boostSpeed = 0;
      this.gateMem.set(sid, { lastSignedDist: -1 });
      this.boostCooldowns.set(sid, new Map());
      slot += 1;
    }
    logger.info(
      { room: this.roomId, code: this.state.code, track: this.track.id },
      'countdown started',
    );
  }

  private finishRace() {
    this.state.phase = 'finished';
    this.finishedAt = Date.now();
    logger.info({ room: this.roomId, code: this.state.code }, 'race finished');
  }

  private resetToLobby() {
    this.state.phase = 'waiting';
    this.state.countdownEndsAt = 0;
    this.state.finishOrder.clear();
    for (const [sid, p] of this.state.players) {
      p.ready = false;
      p.lap = 0;
      p.checkpoint = -1;
      p.finishedAt = 0;
      p.position_rank = 0;
      p.boostUntil = 0;
      p.boostSpeed = 0;
      this.gateMem.set(sid, { lastSignedDist: -1 });
      this.boostCooldowns.set(sid, new Map());
    }
  }

  // ---------------------------------------------------------------------------
  // Simulation
  // ---------------------------------------------------------------------------

  private tick(dt: number) {
    this.state.tick += 1;
    const now = Date.now();
    this.state.serverTime = now;

    // Phase transitions
    if (this.state.phase === 'countdown' && now >= this.state.countdownEndsAt) {
      this.state.phase = 'racing';
      logger.info({ room: this.roomId, code: this.state.code }, 'race started');
    }
    if (this.state.phase === 'finished' && now - this.finishedAt > FINISH_HOLD_MS) {
      this.resetToLobby();
    }

    if (this.state.phase !== 'racing' && this.state.phase !== 'countdown') {
      for (const q of this.inputQueue.values()) q.length = 0;
      return;
    }

    const acceptInputs = this.state.phase === 'racing';

    // Step each player.
    for (const [sid, player] of this.state.players) {
      const bike = this.bikeStates.get(sid);
      if (!bike) continue;
      const spec =
        VEHICLES[
          (player.vehicle as VehicleId) in VEHICLES ? (player.vehicle as VehicleId) : 'scout'
        ];
      const queue = this.inputQueue.get(sid);

      if (!acceptInputs || player.finishedAt > 0 || !queue || queue.length === 0) {
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

      // Boost: while active, hold speed at the boost target.
      if (now < player.boostUntil) {
        if (bike.speed < player.boostSpeed) bike.speed = player.boostSpeed;
      } else if (player.boostUntil !== 0) {
        player.boostUntil = 0;
        player.boostSpeed = 0;
      }
    }

    // Vehicle-vehicle collision (only during active race).
    if (acceptInputs) {
      resolveBikeCollisions(Array.from(this.bikeStates.keys()), this.bikeStates);
    }

    // Checkpoints + laps + boost-pad triggers (race only).
    if (acceptInputs) {
      for (const [sid, player] of this.state.players) {
        const bike = this.bikeStates.get(sid);
        const mem = this.gateMem.get(sid);
        if (!bike || !mem) continue;

        const result = advanceCheckpoint(this.track, player, bike, mem, LAPS_PER_RACE, now);
        if (result.finished) {
          this.state.finishOrder.push(player.id);
          player.position_rank = this.state.finishOrder.length;
        }

        // Boost pads.
        const cd = this.boostCooldowns.get(sid);
        if (cd) {
          const hit = tickBoostPads(this.track, bike, cd, now);
          if (hit) {
            player.boostUntil = hit.until;
            player.boostSpeed = hit.pad.speed;
          }
        }
      }
    }

    // Sync schema for everyone.
    for (const [sid, player] of this.state.players) {
      const bike = this.bikeStates.get(sid);
      if (bike) syncToSchema(bike, player);
    }

    // If everyone has finished, end the race.
    if (acceptInputs) {
      const players = Array.from(this.state.players.values());
      if (players.length > 0 && players.every((p) => p.finishedAt > 0)) {
        this.finishRace();
      }
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
