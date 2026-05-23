/**
 * Data-driven track format. The same shape is consumed by:
 *   - server: spawn placement, checkpoint progress, boost pad triggers,
 *     ground-plane assumption (everything sits at y = surfaceY).
 *   - client: procedural rendering of the placeholder track (replaced by
 *     real glTF visuals in Phase 2).
 *
 * Keeping art and code data decoupled means we can swap in MagicaVoxel-baked
 * tracks later without touching gameplay logic.
 */

export interface Vec3Lit {
  x: number;
  y: number;
  z: number;
}

export interface SpawnPoint {
  x: number;
  z: number;
  yaw: number;
}

export interface CheckpointDef {
  /** 0..N-1, must be crossed in order. id 0 is the start/finish line. */
  id: number;
  center: Vec3Lit;
  /** Direction of travel through the gate (radians). */
  yaw: number;
  /** Half-width perpendicular to travel direction. */
  width: number;
}

export interface BoostPadDef {
  center: Vec3Lit;
  yaw: number;
  width: number;
  length: number;
  /** Target speed during the boost (m/s). */
  speed: number;
  /** Boost duration (s). */
  duration: number;
  /** Per-player cooldown before retrigger (s). */
  cooldown: number;
}

export interface TrackDef {
  id: string;
  name: string;
  surfaceY: number;
  /** Width of the drivable surface (m). */
  trackWidth: number;
  /** Centerline of the loop, sampled densely enough for ribbon rendering. */
  loop: Vec3Lit[];
  spawnPoints: SpawnPoint[];
  checkpoints: CheckpointDef[];
  boostPads: BoostPadDef[];
}
