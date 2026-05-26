import { MAX_PLAYERS_PER_ROOM } from '../constants.js';
import type {
  BoostPadDef,
  CheckpointDef,
  SpawnPoint,
  TrackDef,
  Vec3Lit,
} from '../track.js';

/**
 * Neo-Kibble City — MVP placeholder track. A rounded rectangle (stadium
 * shape) approximated by sampled centerline points. Designed for ~60 s laps
 * at the Scout's top speed (48 m/s) over ~2.8 km of loop with cornering loss.
 *
 * Coordinate system: +z is "forward" along the start line (yaw 0). The straight
 * heading from start runs in -z direction (because the bike step uses
 * (-sin yaw, -cos yaw) as forward), so start checkpoint faces +z direction of
 * travel meaning the bike's yaw 0 sends it into -z.
 */

const STRAIGHT = 100; // long-side straightaway length
const RADIUS = 40; // semicircle radius at each end
const SAMPLES_PER_CORNER = 24;
const TRACK_WIDTH = 14; // drivable width
const SURFACE_Y = 0;

function buildLoop(): Vec3Lit[] {
  // The loop is traversed clockwise (looking from above). Start line is at
  // (0, 0, STRAIGHT/2), heading is -z, so the bike turns into the +x straight
  // after the first corner.
  const pts: Vec3Lit[] = [];

  // 1) Right-side straight: from (0, _, STRAIGHT/2) going -z to (0, _, -STRAIGHT/2)
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    pts.push({ x: 0, y: SURFACE_Y, z: STRAIGHT / 2 - t * STRAIGHT });
  }

  // 2) Right semicircle (going from -z back to +z on the left side).
  // Center: (RADIUS, 0, -STRAIGHT/2). Start angle = π (pointing -z from center),
  // end angle = 0 (pointing +z from center)... wait, I want to wrap around the
  // OUTSIDE. Let me re-think: center should be on the inside of the loop.
  // Bike goes -z then turns right -> wraps around to the +x straight.
  // So curve center is to the +x side of the straight: center=(RADIUS, _, -STRAIGHT/2).
  // From angle = π (point at -x side, i.e. (0, _, -STRAIGHT/2)) sweeping clockwise
  // (decreasing angle) to angle = 0 (point at +x side, i.e. (2*RADIUS, _, -STRAIGHT/2)).
  // But the curve goes via angle = -π/2 (point at (RADIUS, _, -STRAIGHT/2 - RADIUS)),
  // i.e. the far end of the corner.
  for (let i = 1; i <= SAMPLES_PER_CORNER; i++) {
    const t = i / SAMPLES_PER_CORNER;
    const angle = Math.PI - t * Math.PI; // π -> 0 via π/2
    pts.push({
      x: RADIUS + Math.cos(angle) * RADIUS,
      y: SURFACE_Y,
      z: -STRAIGHT / 2 - Math.sin(angle) * RADIUS,
    });
  }

  // 3) Far straight: from (2R, _, -STRAIGHT/2) along +z to (2R, _, STRAIGHT/2)
  for (let i = 1; i <= 16; i++) {
    const t = i / 16;
    pts.push({ x: 2 * RADIUS, y: SURFACE_Y, z: -STRAIGHT / 2 + t * STRAIGHT });
  }

  // 4) Top semicircle: center=(RADIUS, _, STRAIGHT/2). angle 0 -> π via -π/2... wait,
  // we need to go from (2R, _, STRAIGHT/2) (angle=0) back to (0, _, STRAIGHT/2) (angle=π)
  // sweeping through +π/2 (far +z side).
  for (let i = 1; i <= SAMPLES_PER_CORNER; i++) {
    const t = i / SAMPLES_PER_CORNER;
    const angle = t * Math.PI; // 0 -> π via π/2
    pts.push({
      x: RADIUS + Math.cos(angle) * RADIUS,
      y: SURFACE_Y,
      z: STRAIGHT / 2 + Math.sin(angle) * RADIUS,
    });
  }

  // Loop closes back to start (first point). Don't duplicate; consumer should
  // treat the array as cyclic.
  return pts;
}

const loop = buildLoop();

function spawnPoints(): SpawnPoint[] {
  // Grid sits behind the start line so cars cross the white line at race
  // start. Forward is -z, so "behind" means z > STRAIGHT/2.
  const out: SpawnPoint[] = [];
  for (let i = 0; i < MAX_PLAYERS_PER_ROOM; i++) {
    const col = i % 4; // 0..3 abreast across the start line (along x)
    const row = Math.floor(i / 4); // 0..1 rows back (along +z)
    out.push({
      x: -4.5 + col * 3,
      z: STRAIGHT / 2 + 4 + row * 5,
      yaw: 0, // bike faces -z (forward heading)
    });
  }
  return out;
}

/**
 * Checkpoints are placed evenly around the loop. id 0 is the start/finish line.
 * Yaw at each checkpoint is the direction of travel through it.
 */
function buildCheckpoints(): CheckpointDef[] {
  const count = 8;
  const out: CheckpointDef[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor((i / count) * loop.length) % loop.length;
    const next = loop[(idx + 1) % loop.length]!;
    const here = loop[idx]!;
    const dx = next.x - here.x;
    const dz = next.z - here.z;
    // Direction of travel (yaw) where bike forward is (-sin, -cos).
    // Travel direction unit vector ~ (dx, dz) normalized. We want yaw such that
    // (-sin yaw, -cos yaw) ≈ (dx, dz)/|...|. => yaw = atan2(-dx, -dz).
    const yaw = Math.atan2(-dx, -dz);
    out.push({
      id: i,
      center: { x: here.x, y: SURFACE_Y + 1, z: here.z },
      yaw,
      width: TRACK_WIDTH * 0.7,
    });
  }
  return out;
}

function buildBoostPads(): BoostPadDef[] {
  // Two boost strips, one on each long straight, placed about 1/3 of the way
  // into the straight so the player still has runway to use the boost.
  return [
    {
      center: { x: 0, y: SURFACE_Y + 0.05, z: -STRAIGHT / 6 },
      yaw: Math.PI, // pointing in -z direction of travel
      width: 4,
      length: 12,
      speed: 70,
      duration: 1.2,
      cooldown: 4,
    },
    {
      center: { x: 2 * RADIUS, y: SURFACE_Y + 0.05, z: STRAIGHT / 6 },
      yaw: 0, // pointing in +z direction of travel
      width: 4,
      length: 12,
      speed: 70,
      duration: 1.2,
      cooldown: 4,
    },
  ];
}

export const neoKibbleCity: TrackDef = {
  id: 'neo_kibble_city',
  name: 'Neo-Kibble City',
  surfaceY: SURFACE_Y,
  trackWidth: TRACK_WIDTH,
  loop,
  spawnPoints: spawnPoints(),
  checkpoints: buildCheckpoints(),
  boostPads: buildBoostPads(),
};
