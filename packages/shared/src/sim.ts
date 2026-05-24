import { INPUT_FLAGS, type InputFlags, hasFlag } from './input.js';
import { type VehicleSpec } from './constants.js';
import { type TrackDef, type Vec3Lit } from './track.js';

/**
 * Minimal bike kinematic state. Identical structure used on both client (for
 * client-side prediction) and server (authoritative). The state object is
 * mutated in place to avoid per-tick allocations.
 */
export interface BikeState {
  x: number;
  y: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  speed: number;
  drifting: boolean;
}

export function emptyBikeState(): BikeState {
  return { x: 0, y: 0.5, z: 0, yaw: 0, vx: 0, vz: 0, speed: 0, drifting: false };
}

/**
 * Deterministic arcade-bike step. Same `state, input, dt, spec` produces the
 * same `state`. If `track` is provided, the bike is clamped to within
 * trackWidth/2 of the centerline so it can't leave the map.
 *
 * Velocity is strictly along the heading (Mode-7 racer feel): pressing left
 * or right turns the bike and the velocity vector follows instantly — no
 * lateral slide. This is the original tuning the player asked to keep.
 */
export function stepBike(
  state: BikeState,
  flags: InputFlags,
  dt: number,
  spec: VehicleSpec,
  track?: TrackDef,
): void {
  const throttle = hasFlag(flags, INPUT_FLAGS.THROTTLE) ? 1 : 0;
  const brake = hasFlag(flags, INPUT_FLAGS.BRAKE) ? 1 : 0;
  const left = hasFlag(flags, INPUT_FLAGS.LEFT) ? 1 : 0;
  const right = hasFlag(flags, INPUT_FLAGS.RIGHT) ? 1 : 0;
  const drifting = hasFlag(flags, INPUT_FLAGS.DRIFT);

  // Steering tightens with speed up to mid-range, loosens at top speed.
  const speedFactor = state.speed / spec.topSpeed;
  const steerScale = drifting ? 1.5 : 1.0 - 0.25 * Math.max(0, speedFactor - 0.5) * 2;
  const steer = (left - right) * spec.turnRate * steerScale;
  state.yaw += steer * dt;

  const accel = throttle * spec.accel - brake * spec.accel * 0.7;
  const drag = 1.4;
  const next = state.speed + (accel - drag * Math.sign(state.speed)) * dt;
  state.speed = next < 0 ? 0 : next > spec.topSpeed ? spec.topSpeed : next;

  const vx = -Math.sin(state.yaw) * state.speed;
  const vz = -Math.cos(state.yaw) * state.speed;
  state.x += vx * dt;
  state.z += vz * dt;
  state.vx = vx;
  state.vz = vz;

  if (track) clampToTrack(state, track);

  state.drifting = drifting && Math.abs(steer) > 0.1 && state.speed > 8;
}

/**
 * Push the bike back inside the track if it has crossed the wall. Kills the
 * outward component of velocity and applies a small speed penalty so grinding
 * walls is costly. Cheap O(n) over loop segments.
 */
export function clampToTrack(state: BikeState, track: TrackDef): void {
  const halfW = track.trackWidth / 2;
  const near = nearestOnLoop(track.loop, state.x, state.z);
  if (near.dist <= halfW) return;

  const len = near.dist || 1;
  const nx = (state.x - near.px) / len;
  const nz = (state.z - near.pz) / len;

  state.x = near.px + nx * halfW;
  state.z = near.pz + nz * halfW;

  const outV = state.vx * nx + state.vz * nz;
  if (outV > 0) {
    state.vx -= nx * outV;
    state.vz -= nz * outV;
  }

  state.vx *= 0.88;
  state.vz *= 0.88;
  state.speed = Math.hypot(state.vx, state.vz);
}

function nearestOnLoop(
  loop: Vec3Lit[],
  x: number,
  z: number,
): { px: number; pz: number; dist: number } {
  let bestD2 = Infinity;
  let bestPx = 0;
  let bestPz = 0;
  const n = loop.length;
  for (let i = 0; i < n; i++) {
    const a = loop[i]!;
    const b = loop[(i + 1) % n]!;
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const len2 = abx * abx + abz * abz;
    let t = 0;
    if (len2 > 0) {
      t = ((x - a.x) * abx + (z - a.z) * abz) / len2;
      if (t < 0) t = 0;
      else if (t > 1) t = 1;
    }
    const px = a.x + abx * t;
    const pz = a.z + abz * t;
    const dx = x - px;
    const dz = z - pz;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD2) {
      bestD2 = d2;
      bestPx = px;
      bestPz = pz;
    }
  }
  return { px: bestPx, pz: bestPz, dist: Math.sqrt(bestD2) };
}

export function yawToQuat(yaw: number): { x: number; y: number; z: number; w: number } {
  const half = yaw * 0.5;
  return { x: 0, y: Math.sin(half), z: 0, w: Math.cos(half) };
}

export function quatToYaw(x: number, y: number, z: number, w: number): number {
  const siny_cosp = 2 * (w * y + x * z);
  const cosy_cosp = 1 - 2 * (y * y + x * x);
  return Math.atan2(siny_cosp, cosy_cosp);
}
