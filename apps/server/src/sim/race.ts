import type { BikeState, BoostPadDef, CheckpointDef, PlayerState, TrackDef } from '@paws/shared';

/** Per-player checkpoint tracking — signed distance to next gate last tick. */
export interface GateMemory {
  lastSignedDist: number;
}

/** Per-player boost-cooldown tracking, keyed by pad index. */
export type BoostCooldowns = Map<number, number>;

/**
 * Apply checkpoint progression for one player given their current bike state.
 * Mutates the schema player's `checkpoint`, `lap`, `finishedAt`, and the
 * passed GateMemory entry. Returns true if the player just finished.
 */
export function advanceCheckpoint(
  track: TrackDef,
  player: PlayerState,
  bike: BikeState,
  mem: GateMemory,
  laps: number,
  serverTime: number,
): { crossed: boolean; finished: boolean } {
  if (player.finishedAt > 0) return { crossed: false, finished: false };

  const nextId = (player.checkpoint + 1) % track.checkpoints.length;
  const gate = track.checkpoints[nextId]!;
  const dx = bike.x - gate.center.x;
  const dz = bike.z - gate.center.z;
  // Travel direction (the bike moves along (-sin yaw, -cos yaw)).
  const fwdX = -Math.sin(gate.yaw);
  const fwdZ = -Math.cos(gate.yaw);
  // Perpendicular ("right" of travel) for the lateral width check.
  const sideX = -Math.cos(gate.yaw);
  const sideZ = Math.sin(gate.yaw);

  const signed = dx * fwdX + dz * fwdZ;
  const lateral = dx * sideX + dz * sideZ;

  const prev = mem.lastSignedDist;
  mem.lastSignedDist = signed;

  if (prev < 0 && signed >= 0 && Math.abs(lateral) <= gate.width) {
    player.checkpoint = nextId;
    // Re-seed lastSignedDist; the next gate's signed will be computed cleanly
    // next tick.
    mem.lastSignedDist = -1;

    if (nextId === 0) {
      // Crossed the start/finish line.
      if (player.lap === 0) {
        player.lap = 1;
      } else if (player.lap < laps) {
        player.lap += 1;
      } else {
        // Completed the final lap.
        player.finishedAt = serverTime;
        return { crossed: true, finished: true };
      }
    }
    return { crossed: true, finished: false };
  }
  return { crossed: false, finished: false };
}

/**
 * Resolves vehicle-vehicle overlaps via pairwise capsule separation. Cheap
 * O(n²); fine for 8 players.
 */
export function resolveBikeCollisions(
  ids: string[],
  bikes: Map<string, BikeState>,
  radius = 0.9,
) {
  const minSep = radius * 2;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = bikes.get(ids[i]!);
      const b = bikes.get(ids[j]!);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const distSq = dx * dx + dz * dz;
      if (distSq >= minSep * minSep || distSq < 0.0001) continue;
      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const nz = dz / dist;
      const overlap = (minSep - dist) * 0.5;
      a.x -= nx * overlap;
      a.z -= nz * overlap;
      b.x += nx * overlap;
      b.z += nz * overlap;

      // Cartoonish velocity exchange along the contact normal.
      const relVel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (relVel < 0) {
        const bounce = relVel * 0.6;
        a.vx += nx * bounce;
        a.vz += nz * bounce;
        b.vx -= nx * bounce;
        b.vz -= nz * bounce;
        // Damp scalar speeds so big hits slow both bikes.
        const drop = Math.min(8, Math.abs(relVel) * 0.5);
        a.speed = Math.max(0, a.speed - drop * 0.5);
        b.speed = Math.max(0, b.speed - drop * 0.5);
      }
    }
  }
}

/**
 * Trigger boost pads. Returns the boost target speed if a new boost just
 * triggered for this player (so caller can update schema). Otherwise 0.
 */
export function tickBoostPads(
  track: TrackDef,
  bike: BikeState,
  cooldowns: BoostCooldowns,
  serverTime: number,
): { pad: BoostPadDef; until: number } | null {
  for (let i = 0; i < track.boostPads.length; i++) {
    const pad = track.boostPads[i]!;
    if (!isInsidePad(bike, pad)) continue;
    const cd = cooldowns.get(i) ?? 0;
    if (serverTime < cd) continue;
    cooldowns.set(i, serverTime + pad.cooldown * 1000);
    return { pad, until: serverTime + pad.duration * 1000 };
  }
  return null;
}

function isInsidePad(bike: BikeState, pad: BoostPadDef): boolean {
  // Transform bike position into pad-local space.
  const dx = bike.x - pad.center.x;
  const dz = bike.z - pad.center.z;
  // Pad-local forward axis is travel direction = (-sin yaw, -cos yaw).
  const fwdX = -Math.sin(pad.yaw);
  const fwdZ = -Math.cos(pad.yaw);
  const sideX = -Math.cos(pad.yaw);
  const sideZ = Math.sin(pad.yaw);
  const along = dx * fwdX + dz * fwdZ;
  const across = dx * sideX + dz * sideZ;
  return Math.abs(along) <= pad.length / 2 && Math.abs(across) <= pad.width / 2;
}
