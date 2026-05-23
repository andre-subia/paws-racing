import { Client, Room } from '@colyseus/core';
import {
  BROADCAST_DT,
  INPUT_FLAGS,
  type InputCommand,
  LAPS_PER_RACE,
  MAX_PLAYERS_PER_ROOM,
  PlayerState,
  RaceState,
  SIM_DT,
  SIM_HZ,
  VEHICLES,
  type VehicleId,
  hasFlag,
} from '@paws/shared';
import { logger } from '../logger.ts';

interface JoinOptions {
  name?: string;
  vehicle?: VehicleId;
}

interface PendingInput {
  seq: number;
  flags: number;
}

/**
 * Authoritative race room. MVP scaffolding: accepts joins, integrates a
 * placeholder arcade-bike step (no Rapier yet), broadcasts state at 20 Hz.
 * Rapier integration lands in Week 2 (server sim) and Week 3 (track collision).
 */
export class RaceRoom extends Room<RaceState> {
  override maxClients = MAX_PLAYERS_PER_ROOM;

  private inputQueue = new Map<string, PendingInput[]>();
  private broadcastAccum = 0;

  override onCreate() {
    this.setState(new RaceState());
    this.state.code = this.roomId.slice(0, 5).toUpperCase();

    this.setPatchRate(1000 / SIM_HZ);

    this.onMessage('input', (client, msg: InputCommand) => {
      // Trust seq monotonicity per client; drop replays.
      const queue = this.inputQueue.get(client.sessionId);
      if (!queue) return;
      const last = queue.at(-1);
      if (last && msg.seq <= last.seq) return;
      queue.push({ seq: msg.seq, flags: msg.flags });
      // Hard cap to prevent unbounded growth from a malicious client.
      if (queue.length > 60) queue.splice(0, queue.length - 60);
    });

    this.setSimulationInterval((dtMs) => this.tick(dtMs / 1000), 1000 / SIM_HZ);
  }

  override async onJoin(client: Client, options: JoinOptions = {}) {
    const vehicle: VehicleId = options.vehicle === 'bruiser' ? 'bruiser' : 'scout';
    const player = new PlayerState();
    player.id = client.sessionId;
    player.name = (options.name ?? 'Racer').slice(0, 16) || 'Racer';
    player.vehicle = vehicle;
    player.host = this.state.players.size === 0;
    if (player.host) this.state.hostId = client.sessionId;

    // Spread spawns along start line.
    const slot = this.state.players.size;
    player.position.x = (slot - (MAX_PLAYERS_PER_ROOM - 1) / 2) * 2.5;
    player.position.y = 0.5;
    player.position.z = 0;

    this.state.players.set(client.sessionId, player);
    this.inputQueue.set(client.sessionId, []);
    logger.info(
      { room: this.roomId, sid: client.sessionId, name: player.name, host: player.host },
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
    logger.info({ room: this.roomId }, 'room disposed');
  }

  private removePlayer(sid: string) {
    this.state.players.delete(sid);
    this.inputQueue.delete(sid);
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
  // Simulation
  // ---------------------------------------------------------------------------

  private tick(dt: number) {
    this.state.tick += 1;
    this.state.serverTime = Date.now();

    for (const [sid, player] of this.state.players) {
      const queue = this.inputQueue.get(sid);
      if (!queue || queue.length === 0) {
        this.stepPlayer(player, 0, dt);
        continue;
      }
      // Drain all queued inputs this tick; record the latest seq we processed.
      while (queue.length > 0) {
        const cmd = queue.shift()!;
        this.stepPlayer(player, cmd.flags, dt / Math.max(1, queue.length + 1));
        player.lastSeq = cmd.seq;
      }
    }

    this.broadcastAccum += dt;
    if (this.broadcastAccum >= BROADCAST_DT) {
      this.broadcastAccum = 0;
      // Colyseus auto-broadcasts via patch rate; no manual send needed.
    }
  }

  /**
   * Placeholder arcade-bike step. Replaced by server-side Rapier in W2.
   * Just enough physics for the hello-race handshake to feel alive.
   */
  private stepPlayer(p: PlayerState, flags: number, dt: number) {
    const spec = VEHICLES[(p.vehicle as VehicleId) in VEHICLES ? (p.vehicle as VehicleId) : 'scout'];

    const throttle = hasFlag(flags, INPUT_FLAGS.THROTTLE) ? 1 : 0;
    const brake = hasFlag(flags, INPUT_FLAGS.BRAKE) ? 1 : 0;
    const left = hasFlag(flags, INPUT_FLAGS.LEFT) ? 1 : 0;
    const right = hasFlag(flags, INPUT_FLAGS.RIGHT) ? 1 : 0;
    const drifting = hasFlag(flags, INPUT_FLAGS.DRIFT);

    // Yaw from rotation quaternion (only y component matters for this stub).
    const yaw = quatToYaw(p.rotation.x, p.rotation.y, p.rotation.z, p.rotation.w);

    const steer = (left - right) * spec.turnRate * (drifting ? 1.4 : 1.0);
    const newYaw = yaw + steer * dt;

    const accel = throttle * spec.accel - brake * spec.accel * 0.7;
    const drag = 1.2;
    const speed = clamp(p.speed + (accel - drag * Math.sign(p.speed)) * dt, 0, spec.topSpeed);

    const vx = -Math.sin(newYaw) * speed;
    const vz = -Math.cos(newYaw) * speed;

    p.position.x += vx * dt;
    p.position.z += vz * dt;
    p.velocity.x = vx;
    p.velocity.z = vz;
    p.speed = speed;
    p.drifting = drifting && Math.abs(steer) > 0.1 && speed > 8;

    setYawQuat(p.rotation, newYaw);

    // Lap progression is intentionally not wired here — that lands W3 with the
    // real track + checkpoints. We just keep the field present for the schema.
    if (p.lap > LAPS_PER_RACE) p.lap = LAPS_PER_RACE;
  }
}

// --- math helpers (kept local; package math when we add real physics) ---
function clamp(v: number, min: number, max: number) {
  return v < min ? min : v > max ? max : v;
}

function quatToYaw(x: number, y: number, z: number, w: number): number {
  // ZYX yaw extraction
  const siny_cosp = 2 * (w * y + x * z);
  const cosy_cosp = 1 - 2 * (y * y + x * x);
  return Math.atan2(siny_cosp, cosy_cosp);
}

function setYawQuat(q: { x: number; y: number; z: number; w: number }, yaw: number) {
  const half = yaw * 0.5;
  q.x = 0;
  q.y = Math.sin(half);
  q.z = 0;
  q.w = Math.cos(half);
}
