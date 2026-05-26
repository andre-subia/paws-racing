import { MAX_PLAYERS_PER_ROOM } from '../constants.js';
import type {
  BoostPadDef,
  CheckpointDef,
  SpawnPoint,
  TrackDef,
} from '../track.js';
import { buildPolygonLoop, type Vec2 } from './polygon.js';

/**
 * Litter Box Loop — 6-sided irregular hexagon. Long straight, sweeping right,
 * tight middle corner, sweeping return. Designed to feel like an alley fight
 * with mixed corner radii.
 */

const SURFACE_Y = 0;
const TRACK_WIDTH = 16;
const CORNER_R = 9;

const VERTICES: Vec2[] = [
  { x: -50, z: -25 }, // V0 top-left, start side
  { x: 45, z: -30 }, // V1 top-right
  { x: 65, z: 0 }, // V2 right
  { x: 40, z: 30 }, // V3 bottom-right
  { x: -15, z: 40 }, // V4 bottom
  { x: -65, z: 5 }, // V5 left
];

const built = buildPolygonLoop({
  vertices: VERTICES,
  cornerRadius: CORNER_R,
  startSegment: 0,
  startFraction: 0.5,
  surfaceY: SURFACE_Y,
});

const loop = built.loop;

function spawnPoints(): SpawnPoint[] {
  const fwdX = built.startForward.x;
  const fwdZ = built.startForward.z;
  const sideX = -fwdZ;
  const sideZ = fwdX;
  const out: SpawnPoint[] = [];
  for (let i = 0; i < MAX_PLAYERS_PER_ROOM; i++) {
    const col = i % 4; // 0..3 abreast across the start line
    const row = Math.floor(i / 4); // 0..1 rows back
    const back = 4 + row * 5;
    const lateral = -4.5 + col * 3;
    out.push({
      x: built.startX - fwdX * back + sideX * lateral,
      z: built.startZ - fwdZ * back + sideZ * lateral,
      yaw: built.startYaw,
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
    out.push({
      id: i,
      center: { x: here.x, y: SURFACE_Y + 1, z: here.z },
      yaw: Math.atan2(-dx, -dz),
      width: TRACK_WIDTH * 0.7,
    });
  }
  return out;
}

function buildBoostPads(): BoostPadDef[] {
  // Pad mid-way on the long top straight in travel direction, plus one
  // diagonally opposite as a comeback boost.
  const fwdX = built.startForward.x;
  const fwdZ = built.startForward.z;
  return [
    {
      center: {
        x: built.startX + fwdX * 22,
        y: SURFACE_Y + 0.05,
        z: built.startZ + fwdZ * 22,
      },
      yaw: built.startYaw,
      width: 4,
      length: 12,
      speed: 72,
      duration: 1.2,
      cooldown: 4,
    },
    {
      // Opposite side of the loop (~ halfway around). Direction tangent to
      // the loop at that index.
      ...(() => {
        const idx = Math.floor(loop.length * 0.55);
        const here = loop[idx]!;
        const next = loop[(idx + 1) % loop.length]!;
        const dx = next.x - here.x;
        const dz = next.z - here.z;
        return {
          center: { x: here.x, y: SURFACE_Y + 0.05, z: here.z },
          yaw: Math.atan2(-dx, -dz),
        };
      })(),
      width: 4,
      length: 12,
      speed: 72,
      duration: 1.2,
      cooldown: 4,
    },
  ];
}

export const litterBoxLoop: TrackDef = {
  id: 'litter_box_loop',
  name: 'Litter Box Loop',
  surfaceY: SURFACE_Y,
  trackWidth: TRACK_WIDTH,
  loop,
  spawnPoints: spawnPoints(),
  checkpoints: buildCheckpoints(),
  boostPads: buildBoostPads(),
};
