import { Client, Room } from '@colyseus/core';
import {
  type BikeState,
  BROADCAST_DT,
  COUNTDOWN_MS,
  emptyBikeState,
  getTrack,
  type InputCommand,
  LAPS_DEFAULT,
  LAPS_MAX,
  LAPS_MIN,
  MAX_PLAYERS_PER_ROOM,
  PlayerState,
  RaceState,
  SIM_HZ,
  stepBike,
  type TrackDef,
  TRACK_IDS,
  type TrackId,
  VEHICLES,
  type VehicleId,
  yawToQuat,
} from '@paws/shared';
import { generateCode, normalizeCode } from '../codes.js';
import { logger } from '../logger.js';
import { computeBotInput } from '../sim/bot.js';
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
  laps?: number;
  /** Number of AI opponents to fill the grid with (host's create option). */
  bots?: number;
}

/** Themed names for the AI racers, cycled if more bots than names. */
const BOT_NAMES = [
  'Mittens',
  'Shadow',
  'Tobermory',
  'Biscuit',
  'Pixel',
  'Salem',
  'Nitro',
  'Whiskers',
];

function clampLaps(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : LAPS_DEFAULT;
  return Math.min(LAPS_MAX, Math.max(LAPS_MIN, n));
}

function clampBots(v: unknown): number {
  const n = typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : 0;
  return Math.min(MAX_PLAYERS_PER_ROOM - 1, Math.max(0, n));
}

function isValidTrackId(id: unknown): id is TrackId {
  return typeof id === 'string' && (TRACK_IDS as readonly string[]).includes(id);
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
  /** Cooldown so a player taking continuous wall damage doesn't insta-die. */
  private wallHitAt = new Map<string, number>();
  /** Pending respawn timestamps (server time, ms). Player is exploded until
   * tick time >= this value; then bike teleports to nearest checkpoint. */
  private respawnAt = new Map<string, number>();

  /** Session ids of AI-controlled racers (no real client behind them). */
  private bots = new Set<string>();
  /** Per-bot driving skill in 0..1 — higher carries more corner speed. */
  private botSkill = new Map<string, number>();
  /** Bots requested at create time, spawned once the host joins. */
  private pendingBots = 0;
  /** Monotonic counter for unique bot session ids across add/remove. */
  private botSeq = 0;

  private track!: TrackDef;
  private finishedAt = 0; // serverTime when race finished, for hold-then-reset

  override onCreate(options: JoinOptions) {
    this.setState(new RaceState());
    const requestedCode = options.code ? normalizeCode(options.code) : '';
    this.state.code = requestedCode || generateCode();
    this.setMetadata({ code: this.state.code });

    this.track = getTrack(options.trackId ?? this.state.trackId);
    this.state.trackId = this.track.id;
    this.state.laps = clampLaps(options.laps);
    this.pendingBots = clampBots(options.bots);

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
      if (payload.vehicle in VEHICLES) p.vehicle = payload.vehicle;
    });

    this.onMessage('track', (client, payload: { trackId: TrackId }) => {
      if (this.state.phase !== 'waiting') return;
      if (this.state.hostId !== client.sessionId) return;
      if (!isValidTrackId(payload.trackId)) return;
      this.track = getTrack(payload.trackId);
      this.state.trackId = this.track.id;
    });

    this.onMessage('laps', (client, payload: { laps: number }) => {
      if (this.state.phase !== 'waiting') return;
      if (this.state.hostId !== client.sessionId) return;
      this.state.laps = clampLaps(payload.laps);
    });

    this.onMessage('bots', (client, payload: { count: number }) => {
      if (this.state.phase !== 'waiting') return;
      if (this.state.hostId !== client.sessionId) return;
      this.setBotCount(clampBots(payload?.count));
    });

    this.onMessage('start', (client) => {
      if (this.state.phase !== 'waiting') return;
      if (this.state.hostId !== client.sessionId) return;
      this.startCountdown();
    });

    // Ping/pong for round-trip latency display. Client sends its timestamp,
    // server echoes it back, client measures the elapsed time.
    this.onMessage('ping', (client, sentAt: number) => {
      client.send('pong', sentAt);
    });

    this.setSimulationInterval((dtMs) => this.tick(dtMs / 1000), 1000 / SIM_HZ);
  }

  override async onJoin(client: Client, options: JoinOptions = {}) {
    if (this.state.phase !== 'waiting') {
      throw new Error('race already started');
    }

    const vehicle: VehicleId =
      options.vehicle && options.vehicle in VEHICLES ? options.vehicle : 'scout';
    const player = new PlayerState();
    player.id = client.sessionId;
    player.name = (options.name ?? 'Racer').slice(0, 16) || 'Racer';
    player.vehicle = vehicle;
    player.host = this.state.players.size === 0;
    if (player.host) this.state.hostId = client.sessionId;

    const slot = this.state.players.size;
    const spawn =
      this.track.spawnPoints[slot] ?? this.track.spawnPoints[this.track.spawnPoints.length - 1]!;
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

    // Fill the grid with AI opponents once the host has taken their slot.
    if (player.host && this.pendingBots > 0) {
      this.setBotCount(this.pendingBots);
      this.pendingBots = 0;
    }
  }

  /** Humans currently in the room (everyone that isn't an AI racer). */
  private humanCount(): number {
    return this.state.players.size - this.bots.size;
  }

  /**
   * Add or remove bots so exactly `target` AI racers are present, clamped so
   * the grid never exceeds the room capacity. Host-controllable from the lobby.
   */
  private setBotCount(target: number) {
    const maxBots = Math.max(0, MAX_PLAYERS_PER_ROOM - this.humanCount());
    const desired = Math.min(maxBots, Math.max(0, Math.round(target)));
    while (this.bots.size < desired) this.addBot();
    while (this.bots.size > desired) this.removeLastBot();
  }

  /** Spawn a single AI racer on the next free grid slot. */
  private addBot() {
    if (this.state.players.size >= MAX_PLAYERS_PER_ROOM) return;
    this.botSeq += 1;
    const sid = `bot-${this.botSeq}`;
    const idx = this.bots.size;
    const vehicleIds = Object.keys(VEHICLES) as VehicleId[];
    const player = new PlayerState();
    player.id = sid;
    player.name = BOT_NAMES[idx % BOT_NAMES.length]!;
    player.vehicle = vehicleIds[idx % vehicleIds.length]!;
    player.host = false;
    player.ready = true;
    player.connected = true;
    player.isBot = true;

    const slot = this.state.players.size;
    const spawn =
      this.track.spawnPoints[slot] ?? this.track.spawnPoints[this.track.spawnPoints.length - 1]!;
    const bike = emptyBikeState();
    bike.x = spawn.x;
    bike.y = this.track.surfaceY + 0.5;
    bike.z = spawn.z;
    bike.yaw = spawn.yaw;
    this.bikeStates.set(sid, bike);
    this.gateMem.set(sid, { lastSignedDist: -1 });
    this.boostCooldowns.set(sid, new Map());
    this.bots.add(sid);
    this.botSkill.set(sid, 0.78 + Math.random() * 0.22);

    syncToSchema(bike, player);
    this.state.players.set(sid, player);
  }

  /** Remove the most recently added bot (Set keeps insertion order). */
  private removeLastBot() {
    let last: string | undefined;
    for (const id of this.bots) last = id;
    if (last) this.removePlayer(last);
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
    this.wallHitAt.delete(sid);
    this.respawnAt.delete(sid);
    this.bots.delete(sid);
    this.botSkill.delete(sid);
    if (this.state.hostId === sid) {
      // Hand host to the next human; bots can't host (and the room
      // auto-disposes once the last real client is gone anyway).
      let next: string | undefined;
      for (const key of this.state.players.keys()) {
        if (!this.bots.has(key)) {
          next = key;
          break;
        }
      }
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
        this.track.spawnPoints[slot] ?? this.track.spawnPoints[this.track.spawnPoints.length - 1]!;
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
      player.health = 100;
      player.explodedAt = 0;
      this.gateMem.set(sid, { lastSignedDist: -1 });
      this.boostCooldowns.set(sid, new Map());
      this.wallHitAt.set(sid, 0);
      this.respawnAt.delete(sid);
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
    // Award championship points by finish position: 1st gets N, last gets 1
    // (N = number of racers that finished). Accumulates across races in the
    // room. By now every player has been pushed to finishOrder.
    const total = this.state.finishOrder.length;
    this.state.finishOrder.forEach((id, i) => {
      const p = this.state.players.get(id);
      if (p) p.score += total - i;
    });
    logger.info({ room: this.roomId, code: this.state.code }, 'race finished');
  }

  /**
   * Mark a player as exploded and schedule a respawn 1.5s later (covers the
   * client's explosion animation). Players are NOT pushed to finishOrder —
   * they come back at the nearest checkpoint with full health.
   */
  private killPlayer(sid: string, player: PlayerState, now: number) {
    player.health = 0;
    player.explodedAt = now;
    const bike = this.bikeStates.get(sid);
    if (bike) {
      bike.vx = 0;
      bike.vz = 0;
      bike.speed = 0;
    }
    this.respawnAt.set(sid, now + 1500);
    // Drop any queued inputs so we don't replay them at the respawn point.
    this.inputQueue.get(sid)?.splice(0);
  }

  /** Teleport the bike to the player's last passed checkpoint, full HP. */
  private respawnPlayer(sid: string, player: PlayerState) {
    const bike = this.bikeStates.get(sid);
    if (!bike) return;
    const cpIdx = Math.max(0, player.checkpoint);
    const cp = this.track.checkpoints[cpIdx] ?? this.track.checkpoints[0]!;
    bike.x = cp.center.x;
    bike.y = this.track.surfaceY + 0.5;
    bike.z = cp.center.z;
    bike.yaw = cp.yaw;
    bike.vx = 0;
    bike.vz = 0;
    bike.speed = 0;
    bike.wallImpact = 0;
    this.gateMem.set(sid, { lastSignedDist: -1 });
    this.wallHitAt.set(sid, Date.now()); // grace from immediate wall damage
    player.health = 100;
    player.explodedAt = 0;
    this.respawnAt.delete(sid);
    syncToSchema(bike, player);
  }

  private resetToLobby() {
    this.state.phase = 'waiting';
    this.state.countdownEndsAt = 0;
    this.state.finishOrder.clear();
    for (const [sid, p] of this.state.players) {
      // Bots are always ready so the host can immediately re-start.
      p.ready = this.bots.has(sid);
      p.lap = 0;
      p.checkpoint = -1;
      p.finishedAt = 0;
      p.position_rank = 0;
      p.boostUntil = 0;
      p.boostSpeed = 0;
      p.health = 100;
      p.explodedAt = 0;
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

      const frozen = !acceptInputs || player.finishedAt > 0 || player.explodedAt > 0;
      if (this.bots.has(sid)) {
        // AI racers: drive toward a look-ahead point on the centerline.
        const flags = frozen
          ? 0
          : computeBotInput(this.track, bike, spec, this.botSkill.get(sid) ?? 0.9);
        stepBike(bike, flags, dt, spec, this.track);
      } else if (frozen || !queue || queue.length === 0) {
        stepBike(bike, 0, dt, spec, this.track);
      } else {
        const n = queue.length;
        const sub = dt / n;
        for (let i = 0; i < n; i++) {
          const cmd = queue.shift()!;
          stepBike(bike, cmd.flags, sub, spec, this.track);
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

      // Wall damage. clampToTrack writes the outward impact speed into
      // bike.wallImpact when the bike crosses the track edge this tick.
      // Only real crashes (>= WALL_HIT_THRESHOLD) bleed health, and a
      // cooldown stops a stuck-against-the-wall bike from accumulating
      // damage tick after tick.
      const WALL_HIT_THRESHOLD = 9;
      const WALL_COOLDOWN_MS = 700;
      if (acceptInputs && bike.wallImpact > WALL_HIT_THRESHOLD && player.explodedAt === 0) {
        const lastHit = this.wallHitAt.get(sid) ?? 0;
        if (now - lastHit >= WALL_COOLDOWN_MS) {
          this.wallHitAt.set(sid, now);
          const dmg = Math.min(25, Math.max(6, (bike.wallImpact - 6) * 2));
          player.health = Math.max(0, player.health - dmg);
          if (player.health <= 0) this.killPlayer(sid, player, now);
        }
      }
    }

    // Process pending respawns. Player stays exploded for ~1.5s, then we
    // teleport them to the nearest passed checkpoint with full HP.
    if (acceptInputs) {
      for (const [sid, player] of this.state.players) {
        const at = this.respawnAt.get(sid);
        if (at && now >= at && player.explodedAt > 0) {
          this.respawnPlayer(sid, player);
        }
      }
    }

    // Vehicle-vehicle collision (only during active race). Rear hits drain
    // health; reaching 0 explodes the player (treated as a finish in the
    // current finishOrder slot — usually last place).
    if (acceptInputs) {
      const hits = resolveBikeCollisions(Array.from(this.bikeStates.keys()), this.bikeStates);
      for (const hit of hits) {
        const victim = this.state.players.get(hit.victimId);
        if (!victim || victim.finishedAt > 0 || victim.explodedAt > 0) continue;
        // Rear-hits hurt — every clean tap should chunk meaningful health.
        const dmg = Math.min(60, Math.max(18, hit.impactSpeed * 3.5 + 10));
        victim.health = Math.max(0, victim.health - dmg);
        if (victim.health <= 0) this.killPlayer(hit.victimId, victim, now);
      }
    }

    // Checkpoints + laps + boost-pad triggers (race only).
    if (acceptInputs) {
      for (const [sid, player] of this.state.players) {
        const bike = this.bikeStates.get(sid);
        const mem = this.gateMem.get(sid);
        if (!bike || !mem) continue;

        const result = advanceCheckpoint(this.track, player, bike, mem, this.state.laps, now);
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

    // End early once the penultimate racer finishes (last place is inferred).
    // - 1 player: must finish themselves.
    // - 2+ players: when N-1 have finished, auto-finish the lone straggler in
    //   last place and end the race.
    if (acceptInputs) {
      const players = Array.from(this.state.players.values());
      const total = players.length;
      const finished = players.filter((p) => p.finishedAt > 0).length;
      if (total === 1 && finished === 1) {
        this.finishRace();
      } else if (total > 1 && finished >= total - 1) {
        for (const p of players) {
          if (p.finishedAt === 0) {
            this.state.finishOrder.push(p.id);
            p.position_rank = this.state.finishOrder.length;
            p.finishedAt = now;
          }
        }
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
