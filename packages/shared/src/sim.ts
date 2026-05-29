import { INPUT_FLAGS, type InputFlags, hasFlag } from './input.js';
import { type VehicleSpec } from './constants.js';
import { type RampDef, type TrackDef, type Vec3Lit } from './track.js';

/** Resting height of a bike above the track surface (matches the spawn offset). */
export const BIKE_GROUND_OFFSET = 0.5;
/** Upward launch speed (m/s) for a manual hop — a drift tap, Mario-Kart style. */
export const JUMP_VELOCITY = 11;
/** Gravity pulling airborne bikes back to the ground (m/s²). */
export const GRAVITY = 34;

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
  /** Vertical velocity (m/s). Positive = rising. Drives hops/ramp launches. */
  vy: number;
  /** Whether the drift/jump input was held last tick (for rising-edge hops). */
  jumpHeld: boolean;
  /** Outward speed (m/s) at which the bike hit the track wall this tick. 0
   * otherwise. Transient — reset at the start of each stepBike call. */
  wallImpact: number;
}

export function emptyBikeState(): BikeState {
  return {
    x: 0,
    y: BIKE_GROUND_OFFSET,
    z: 0,
    yaw: 0,
    vx: 0,
    vz: 0,
    speed: 0,
    drifting: false,
    vy: 0,
    jumpHeld: false,
    wallImpact: 0,
  };
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
  state.wallImpact = 0;

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

  // --- Vertical (jump) physics ---------------------------------------------
  // Ground sits at surfaceY + offset. A drift TAP while grounded hops the bike
  // (hold-to-drift still works — the hop only fires on the press edge). Ramps
  // launch harder. Everything here is deterministic so client prediction and
  // the server stay in lockstep; horizontal clamping above keeps you on track,
  // so a jump is pure air (you never fall off).
  const groundY = (track ? track.surfaceY : 0) + BIKE_GROUND_OFFSET;
  const grounded = state.y <= groundY + 0.001 && state.vy <= 0.001;
  if (grounded) {
    if (drifting && !state.jumpHeld) state.vy = JUMP_VELOCITY;
    if (track) {
      for (const ramp of track.ramps) {
        if (isInsideRamp(state, ramp)) {
          state.vy = ramp.launch;
          break;
        }
      }
    }
  }
  state.jumpHeld = drifting;
  state.vy -= GRAVITY * dt;
  state.y += state.vy * dt;
  if (state.y <= groundY) {
    state.y = groundY;
    state.vy = 0;
  }

  state.drifting = drifting && Math.abs(steer) > 0.1 && state.speed > 8;
}

/** True when (x, z) lies within an oriented rectangle (travel-yaw convention). */
export function insideBox(
  x: number,
  z: number,
  box: { center: Vec3Lit; yaw: number; width: number; length: number },
): boolean {
  const dx = x - box.center.x;
  const dz = z - box.center.z;
  const fwdX = -Math.sin(box.yaw);
  const fwdZ = -Math.cos(box.yaw);
  const sideX = -Math.cos(box.yaw);
  const sideZ = Math.sin(box.yaw);
  const along = dx * fwdX + dz * fwdZ;
  const across = dx * sideX + dz * sideZ;
  return Math.abs(along) <= box.length / 2 && Math.abs(across) <= box.width / 2;
}

/** True when the bike sits within the rectangular footprint of a launch ramp. */
function isInsideRamp(state: BikeState, ramp: RampDef): boolean {
  return insideBox(state.x, state.z, ramp);
}

/**
 * True when the bike is over a hole in the track. Used by the server for fatal
 * fall detection — a bike that touches down inside a gap is wrecked.
 */
export function isOverGap(state: BikeState, track: TrackDef): boolean {
  for (const gap of track.gaps) {
    if (insideBox(state.x, state.z, gap)) return true;
  }
  return false;
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
    if (outV > state.wallImpact) state.wallImpact = outV;
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
