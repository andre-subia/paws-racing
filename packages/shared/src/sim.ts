import { INPUT_FLAGS, type InputFlags, hasFlag } from './input.js';
import { type VehicleSpec } from './constants.js';

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
 * same `state`. This is the single source of truth so client prediction and
 * server authority stay aligned.
 *
 * Future: replace internals with Rapier when track collision lands in W3.
 * The signature is stable; callers should not need to change.
 */
export function stepBike(state: BikeState, flags: InputFlags, dt: number, spec: VehicleSpec): void {
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

  state.drifting = drifting && Math.abs(steer) > 0.1 && state.speed > 8;
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
