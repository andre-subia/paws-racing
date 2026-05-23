import type { PlayerState } from '@paws/shared';
import { quatToYaw } from '@paws/shared';

interface Snapshot {
  time: number; // local receive time (ms)
  x: number;
  y: number;
  z: number;
  yaw: number;
  drifting: boolean;
}

export interface InterpolatedPose {
  x: number;
  y: number;
  z: number;
  yaw: number;
  drifting: boolean;
}

/**
 * Entity interpolation buffer for remote players. We render at
 * `now - INTERP_DELAY_MS` so we always have two snapshots bracketing render
 * time, producing smooth motion even when packets jitter or briefly drop.
 *
 * Clock sync is unnecessary because we time snapshots by their local
 * receive time, not server timestamps.
 */
const INTERP_DELAY_MS = 100;
const MAX_BUFFER = 16;

export class RemoteInterpolator {
  private buffers = new Map<string, Snapshot[]>();

  pushFromSchema(player: PlayerState) {
    const yaw = quatToYaw(
      player.rotation.x,
      player.rotation.y,
      player.rotation.z,
      player.rotation.w,
    );
    this.push(player.id, {
      time: performance.now(),
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      yaw,
      drifting: player.drifting,
    });
  }

  push(id: string, snap: Snapshot) {
    let buf = this.buffers.get(id);
    if (!buf) {
      buf = [];
      this.buffers.set(id, buf);
    }
    buf.push(snap);
    if (buf.length > MAX_BUFFER) buf.shift();
  }

  drop(id: string) {
    this.buffers.delete(id);
  }

  /**
   * Sample the interpolated pose for `id` at the current render time.
   * Returns null if no snapshots have been received yet.
   */
  sample(id: string, out: InterpolatedPose): boolean {
    const buf = this.buffers.get(id);
    if (!buf || buf.length === 0) return false;

    const renderTime = performance.now() - INTERP_DELAY_MS;

    // Only one snapshot — use it directly.
    if (buf.length === 1) {
      const s = buf[0]!;
      out.x = s.x;
      out.y = s.y;
      out.z = s.z;
      out.yaw = s.yaw;
      out.drifting = s.drifting;
      return true;
    }

    // Find the two snapshots bracketing renderTime.
    let earlier: Snapshot | null = null;
    let later: Snapshot | null = null;
    for (let i = 0; i < buf.length; i++) {
      const s = buf[i]!;
      if (s.time <= renderTime) earlier = s;
      else {
        later = s;
        break;
      }
    }

    // renderTime is older than everything we have — extrapolate would jitter;
    // just clamp to the oldest snapshot.
    if (!earlier) {
      const s = buf[0]!;
      out.x = s.x;
      out.y = s.y;
      out.z = s.z;
      out.yaw = s.yaw;
      out.drifting = s.drifting;
      return true;
    }

    // renderTime is newer than everything — clamp to latest (small lag).
    if (!later) {
      const s = buf[buf.length - 1]!;
      out.x = s.x;
      out.y = s.y;
      out.z = s.z;
      out.yaw = s.yaw;
      out.drifting = s.drifting;
      return true;
    }

    const span = later.time - earlier.time;
    const t = span > 0 ? (renderTime - earlier.time) / span : 0;
    out.x = earlier.x + (later.x - earlier.x) * t;
    out.y = earlier.y + (later.y - earlier.y) * t;
    out.z = earlier.z + (later.z - earlier.z) * t;
    out.yaw = lerpAngle(earlier.yaw, later.yaw, t);
    out.drifting = later.drifting;
    return true;
  }
}

function lerpAngle(a: number, b: number, t: number): number {
  // Wrap shortest path around ±π.
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
