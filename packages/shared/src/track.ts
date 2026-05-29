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

/** A launch ramp: crossing it at ground level flings the bike into the air. */
export interface RampDef {
  center: Vec3Lit;
  /** Direction the ramp faces / launches along (radians, travel convention). */
  yaw: number;
  width: number;
  length: number;
  /** Upward launch velocity (m/s) applied on contact. */
  launch: number;
}

/** A hole in the track surface — touching down inside one is fatal (you fall). */
export interface GapDef {
  center: Vec3Lit;
  /** Orientation of the rectangular hole (radians, travel convention). */
  yaw: number;
  width: number;
  length: number;
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
  /** Launch ramps that fling bikes into the air. May be empty. */
  ramps: RampDef[];
  /** Holes in the surface — landing in one is fatal. May be empty. */
  gaps: GapDef[];
}
