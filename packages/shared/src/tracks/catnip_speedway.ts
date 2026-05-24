import { MAX_PLAYERS_PER_ROOM } from '../constants.js';
import type {
  BoostPadDef,
  CheckpointDef,
  SpawnPoint,
  TrackDef,
  Vec3Lit,
} from '../track.js';

/**
 * Catnip Speedway — wider, longer sister track to Neo-Kibble City. Horizontal
 * layout (straights along ±x, semicircle ends on ±x). Designed for sustained
 * top-speed runs with bigger sweeps.
 */

const STRAIGHT = 140;
const RADIUS = 45;
const SAMPLES_PER_CORNER = 28;
const TRACK_WIDTH = 18;
const SURFACE_Y = 0;

function buildLoop(): Vec3Lit[] {
  // Centered on origin. Traversed clockwise (looking from above). Start line
  // at (-STRAIGHT/2, 0, -RADIUS), heading +x along the top straight.
  const pts: Vec3Lit[] = [];

  // 1) Top straight: x: -STRAIGHT/2 → +STRAIGHT/2 at z=-RADIUS.
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    pts.push({ x: -STRAIGHT / 2 + t * STRAIGHT, y: SURFACE_Y, z: -RADIUS });
  }

  // 2) Right semicircle: center (STRAIGHT/2, 0, 0), sweeping from angle=-π/2
  //    (top of curve) through 0 (right edge) to π/2 (bottom of curve).
  for (let i = 1; i <= SAMPLES_PER_CORNER; i++) {
    const t = i / SAMPLES_PER_CORNER;
    const angle = -Math.PI / 2 + t * Math.PI;
    pts.push({
      x: STRAIGHT / 2 + Math.cos(angle) * RADIUS,
      y: SURFACE_Y,
      z: Math.sin(angle) * RADIUS,
    });
  }

  // 3) Bottom straight: x: +STRAIGHT/2 → -STRAIGHT/2 at z=+RADIUS.
  for (let i = 1; i <= 16; i++) {
    const t = i / 16;
    pts.push({ x: STRAIGHT / 2 - t * STRAIGHT, y: SURFACE_Y, z: +RADIUS });
  }

  // 4) Left semicircle: center (-STRAIGHT/2, 0, 0), from angle=π/2 through π
  //    (left edge) to 3π/2, closing the loop back to start.
  for (let i = 1; i <= SAMPLES_PER_CORNER; i++) {
    const t = i / SAMPLES_PER_CORNER;
    const angle = Math.PI / 2 + t * Math.PI;
    pts.push({
      x: -STRAIGHT / 2 + Math.cos(angle) * RADIUS,
      y: SURFACE_Y,
      z: Math.sin(angle) * RADIUS,
    });
  }

  return pts;
}

const loop = buildLoop();

function spawnPoints(): SpawnPoint[] {
  // Grid sits behind the start line on the top straight. Heading is +x
  // (yaw = -π/2). Behind = -x direction.
  const startX = -STRAIGHT / 2;
  const startZ = -RADIUS;
  const out: SpawnPoint[] = [];
  for (let i = 0; i < MAX_PLAYERS_PER_ROOM; i++) {
    const row = i % 2;
    const col = Math.floor(i / 2);
    out.push({
      x: startX - 4 - col * 4,
      z: startZ - 3 + row * 3,
      yaw: -Math.PI / 2,
    });
  }
  return out;
}

function buildCheckpoints(): CheckpointDef[] {
  const count = 10;
  const out: CheckpointDef[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor((i / count) * loop.length) % loop.length;
    const next = loop[(idx + 1) % loop.length]!;
    const here = loop[idx]!;
    const dx = next.x - here.x;
    const dz = next.z - here.z;
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
  return [
    {
      center: { x: 0, y: SURFACE_Y + 0.05, z: -RADIUS },
      yaw: -Math.PI / 2,
      width: 5,
      length: 14,
      speed: 75,
      duration: 1.2,
      cooldown: 4,
    },
    {
      center: { x: 0, y: SURFACE_Y + 0.05, z: +RADIUS },
      yaw: Math.PI / 2,
      width: 5,
      length: 14,
      speed: 75,
      duration: 1.2,
      cooldown: 4,
    },
  ];
}

export const catnipSpeedway: TrackDef = {
  id: 'catnip_speedway',
  name: 'Catnip Speedway',
  surfaceY: SURFACE_Y,
  trackWidth: TRACK_WIDTH,
  loop,
  spawnPoints: spawnPoints(),
  checkpoints: buildCheckpoints(),
  boostPads: buildBoostPads(),
};
