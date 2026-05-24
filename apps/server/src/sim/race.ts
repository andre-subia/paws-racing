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

export interface RearHit {
  victimId: string;
  attackerId: string;
  /** Closing speed along the contact normal at the moment of impact (m/s). */
  impactSpeed: number;
}

/**
 * Resolves vehicle-vehicle overlaps via pairwise capsule separation. Cheap
 * O(n²); fine for 8 players. Returns the list of rear-hit events detected
 * during the same sweep (attacker behind victim, both forwards aligned with
 * the contact normal), so the caller can apply damage.
 */
export function resolveBikeCollisions(
  ids: string[],
  bikes: Map<string, BikeState>,
  radius = 0.9,
): RearHit[] {
  const minSep = radius * 2;
  const hits: RearHit[] = [];
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
      const nx = dx / dist; // points from A to B
      const nz = dz / dist;
      const overlap = (minSep - dist) * 0.5;
      a.x -= nx * overlap;
      a.z -= nz * overlap;
      b.x += nx * overlap;
      b.z += nz * overlap;

      // --- Rear-hit detection (BEFORE bounce, so closing speed is the real
      // pre-impact value, not the dampened one). A hits B's rear when A is
      // behind B (normal aligned with B's forward), A is moving toward B
      // (forward dot positive), and the closing speed along the normal
      // exceeds MIN_IMPACT.
      const fxA = -Math.sin(a.yaw);
      const fzA = -Math.cos(a.yaw);
      const fxB = -Math.sin(b.yaw);
      const fzB = -Math.cos(b.yaw);
      const nFwdA = nx * fxA + nz * fzA;
      const nFwdB = nx * fxB + nz * fzB;
      const closingPre = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
      const REAR_DOT = 0.45;
      const APPROACH_DOT = 0.2;
      const MIN_IMPACT = 2.5;
      // closingPre is positive in BOTH cases when bikes are getting closer
      // (it's -d(distance)/dt regardless of which side `n` points to).
      // The dot-product signs are what tell us who's behind whom.
      if (nFwdB > REAR_DOT && nFwdA > APPROACH_DOT && closingPre > MIN_IMPACT) {
        // a is behind b → a hits b's rear.
        hits.push({
          victimId: ids[j]!,
          attackerId: ids[i]!,
          impactSpeed: closingPre,
        });
      } else if (nFwdA < -REAR_DOT && nFwdB < -APPROACH_DOT && closingPre > MIN_IMPACT) {
        // b is behind a → b hits a's rear.
        hits.push({
          victimId: ids[i]!,
          attackerId: ids[j]!,
          impactSpeed: closingPre,
        });
      }

      // Cartoonish velocity exchange along the contact normal.
      const relVel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (relVel < 0) {
        const bounce = relVel * 0.6;
        a.vx += nx * bounce;
        a.vz += nz * bounce;
        b.vx -= nx * bounce;
        b.vz -= nz * bounce;
        const drop = Math.min(8, Math.abs(relVel) * 0.5);
        a.speed = Math.max(0, a.speed - drop * 0.5);
        b.speed = Math.max(0, b.speed - drop * 0.5);
      }
    }
  }
  return hits;
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
