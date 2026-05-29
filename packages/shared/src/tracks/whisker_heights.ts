import { MAX_PLAYERS_PER_ROOM } from '../constants.js';
import type { BoostPadDef, CheckpointDef, RampDef, SpawnPoint, TrackDef } from '../track.js';
import { buildPolygonLoop, type Vec2 } from './polygon.js';

/**
 * Whisker Heights — a big, fast, sweeping circuit built for air. Four launch
 * ramps are spaced around the loop so there's almost always a jump coming up.
 * Wide surface gives room to land the hops without scrubbing the wall.
 */

const SURFACE_Y = 0;
const TRACK_WIDTH = 16;
const CORNER_R = 13;

const VERTICES: Vec2[] = [
  { x: -80, z: -45 }, // V0 top-left  (start straight runs toward V1)
  { x: 75, z: -55 }, // V1 top-right
  { x: 95, z: 20 }, // V2 right
  { x: 0, z: 60 }, // V3 bottom
  { x: -95, z: 25 }, // V4 left
];

const built = buildPolygonLoop({
  vertices: VERTICES,
  cornerRadius: CORNER_R,
  startSegment: 0,
  startFraction: 0.4,
  surfaceY: SURFACE_Y,
});

const loop = built.loop;

/** Tangent (travel) yaw of the loop at a given sample index. */
function loopYaw(idx: number): number {
  const here = loop[idx]!;
  const next = loop[(idx + 1) % loop.length]!;
  return Math.atan2(-(next.x - here.x), -(next.z - here.z));
}

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
  const count = 8;
  const out: CheckpointDef[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor((i / count) * loop.length) % loop.length;
    const here = loop[idx]!;
    out.push({
      id: i,
      center: { x: here.x, y: SURFACE_Y + 1, z: here.z },
      yaw: loopYaw(idx),
      width: TRACK_WIDTH * 0.7,
    });
  }
  return out;
}

function buildBoostPads(): BoostPadDef[] {
  const fwdX = built.startForward.x;
  const fwdZ = built.startForward.z;
  return [
    {
      center: { x: built.startX + fwdX * 24, y: SURFACE_Y + 0.05, z: built.startZ + fwdZ * 24 },
      yaw: built.startYaw,
      width: 5,
      length: 12,
      speed: 76,
      duration: 1.3,
      cooldown: 4,
    },
  ];
}

function buildRamps(): RampDef[] {
  // Four ramps spaced around the loop — there's nearly always air ahead.
  return [0.14, 0.39, 0.64, 0.89].map((frac) => {
    const idx = Math.floor(loop.length * frac) % loop.length;
    const here = loop[idx]!;
    return {
      center: { x: here.x, y: SURFACE_Y, z: here.z },
      yaw: loopYaw(idx),
      width: 8,
      length: 6,
      launch: 16,
    };
  });
}

export const whiskerHeights: TrackDef = {
  id: 'whisker_heights',
  name: 'Whisker Heights',
  surfaceY: SURFACE_Y,
  trackWidth: TRACK_WIDTH,
  loop,
  spawnPoints: spawnPoints(),
  checkpoints: buildCheckpoints(),
  boostPads: buildBoostPads(),
  ramps: buildRamps(),
  gaps: [],
};
