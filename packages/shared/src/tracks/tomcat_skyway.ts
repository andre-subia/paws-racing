import { MAX_PLAYERS_PER_ROOM } from '../constants.js';
import type {
  BoostPadDef,
  CheckpointDef,
  GapDef,
  RampDef,
  SpawnPoint,
  TrackDef,
} from '../track.js';
import { buildPolygonLoop, type Vec2 } from './polygon.js';

/**
 * Tomcat Skyway — a sweeping hexagonal skyway with two yawning gaps. Ramps lead
 * into each chasm; clear them with speed or fall to the depths below.
 */

const SURFACE_Y = 0;
const TRACK_WIDTH = 15;
const CORNER_R = 17;

const VERTICES: Vec2[] = [
  { x: -85, z: -35 },
  { x: 0, z: -65 },
  { x: 90, z: -30 },
  { x: 80, z: 45 },
  { x: -10, z: 65 },
  { x: -95, z: 30 },
];

const built = buildPolygonLoop({
  vertices: VERTICES,
  cornerRadius: CORNER_R,
  startSegment: 0,
  startFraction: 0.4,
  surfaceY: SURFACE_Y,
});

const loop = built.loop;

const GAP_FRACS = [0.27, 0.74];
const RAMP_LEAD = 16;

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
    const col = i % 4;
    const row = Math.floor(i / 4);
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
      center: { x: built.startX + fwdX * 22, y: SURFACE_Y + 0.05, z: built.startZ + fwdZ * 22 },
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
  return GAP_FRACS.map((frac) => {
    const gi = Math.floor(loop.length * frac) % loop.length;
    const idx = (gi - RAMP_LEAD + loop.length) % loop.length;
    const here = loop[idx]!;
    return {
      center: { x: here.x, y: SURFACE_Y, z: here.z },
      yaw: loopYaw(idx),
      width: 9,
      length: 6,
      launch: 17,
    };
  });
}

function buildGaps(): GapDef[] {
  return GAP_FRACS.map((frac) => {
    const idx = Math.floor(loop.length * frac) % loop.length;
    const here = loop[idx]!;
    return {
      center: { x: here.x, y: SURFACE_Y, z: here.z },
      yaw: loopYaw(idx),
      width: TRACK_WIDTH + 4,
      length: 9,
    };
  });
}

export const tomcatSkyway: TrackDef = {
  id: 'tomcat_skyway',
  name: 'Tomcat Skyway',
  surfaceY: SURFACE_Y,
  trackWidth: TRACK_WIDTH,
  loop,
  spawnPoints: spawnPoints(),
  checkpoints: buildCheckpoints(),
  boostPads: buildBoostPads(),
  ramps: buildRamps(),
  gaps: buildGaps(),
};
