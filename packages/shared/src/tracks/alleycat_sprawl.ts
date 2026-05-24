import { MAX_PLAYERS_PER_ROOM } from '../constants.js';
import type {
  BoostPadDef,
  CheckpointDef,
  SpawnPoint,
  TrackDef,
} from '../track.js';
import { buildPolygonLoop, type Vec2 } from './polygon.js';

/**
 * Alleycat Sprawl — irregular pentagonal circuit. Long top straight, then
 * five distinct turns of varied tightness. Not a smooth oval.
 */

const SURFACE_Y = 0;
const TRACK_WIDTH = 14;
const CORNER_R = 8;

const VERTICES: Vec2[] = [
  { x: -50, z: -30 }, // V0 top-left
  { x: 45, z: -25 }, // V1 top-right
  { x: 60, z: 15 }, // V2 right
  { x: -5, z: 40 }, // V3 bottom-right
  { x: -70, z: 0 }, // V4 left
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
    const row = i % 2;
    const col = Math.floor(i / 2);
    const back = 4 + col * 4;
    const lateral = -3 + row * 3;
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
  // One pad mid-way along the long top straight, pointing in the direction
  // of travel at the start (V0 → V1).
  const fwdX = built.startForward.x;
  const fwdZ = built.startForward.z;
  const aheadX = built.startX + fwdX * 22;
  const aheadZ = built.startZ + fwdZ * 22;
  return [
    {
      center: { x: aheadX, y: SURFACE_Y + 0.05, z: aheadZ },
      yaw: built.startYaw,
      width: 4,
      length: 12,
      speed: 70,
      duration: 1.2,
      cooldown: 4,
    },
  ];
}

export const alleycatSprawl: TrackDef = {
  id: 'alleycat_sprawl',
  name: 'Alleycat Sprawl',
  surfaceY: SURFACE_Y,
  trackWidth: TRACK_WIDTH,
  loop,
  spawnPoints: spawnPoints(),
  checkpoints: buildCheckpoints(),
  boostPads: buildBoostPads(),
};
