import type { TrackDef } from '@paws/shared';
import { Container, Sprite } from 'pixi.js';
import { TILE_H, TILE_W, worldToScreen } from './projection.js';
import type { SpriteAtlas } from './sprites.js';

// A 64×32 diamond covers exactly 1×1 world units, so the grid step must be
// 1 for diamonds to share edges. Step 2 left a checkerboard of gaps that
// strobed against the moving camera and felt dizzying.
const TILE_STEP_WORLD = 1;
// Tiles within ±this many world units of the start line plane get painted
// white in a zebra pattern.
const START_LINE_DEPTH = 1.2;
// How far behind the start line the surface extends so spawn rows have ground.
const START_LINE_EXTENSION = 18;

/**
 * Iso-tiled track. Renders the centerline + a band of tiles `trackWidth` wide
 * sampled at TILE_H/2 spacing so the surface looks continuous. Tiles are
 * z-sorted by world (x+z) so things drawn on top look right.
 *
 * Built once on race start; checkpoint highlighting is updated per-frame via
 * `setNextCheckpoint`.
 */
export class TrackView {
  container: Container;
  private tilesContainer: Container;
  private propsContainer: Container;
  /** All sprites for each checkpoint id, so we can highlight the "next" one. */
  private checkpointSprites = new Map<number, Sprite[]>();
  private nextCheckpointId = 0;

  constructor(track: TrackDef, atlas: SpriteAtlas) {
    this.container = new Container();
    this.tilesContainer = new Container();
    this.propsContainer = new Container();
    this.container.addChild(this.tilesContainer);
    this.container.addChild(this.propsContainer);

    this.buildSurface(track, atlas);
    this.buildBoostPads(track, atlas);
    this.buildCheckpoints(track, atlas);
  }

  /**
   * Highlight the checkpoint id the local player is heading toward. All
   * others are dimmed; the target pulses.
   */
  setNextCheckpoint(id: number, time: number) {
    this.nextCheckpointId = id;
    const pulse = 0.85 + Math.sin(time * 6) * 0.15;
    for (const [cid, sprites] of this.checkpointSprites) {
      const isNext = cid === id;
      for (const sp of sprites) {
        sp.alpha = isNext ? 1 : 0.45;
        sp.scale.set(isNext ? pulse : 1, isNext ? pulse : 1);
      }
    }
  }

  private buildSurface(track: TrackDef, atlas: SpriteAtlas) {
    const placedKeys = new Set<string>();
    const halfW = track.trackWidth / 2;

    // Start-line plane info — used to paint zebra tiles along it.
    const startCp = track.checkpoints.find((c) => c.id === 0);
    const startFwdX = startCp ? -Math.sin(startCp.yaw) : 0;
    const startFwdZ = startCp ? -Math.cos(startCp.yaw) : 0;

    const placeTile = (kx: number, kz: number) => {
      const key = `${kx},${kz}`;
      if (placedKeys.has(key)) return;
      placedKeys.add(key);
      const wx = kx * TILE_STEP_WORLD;
      const wz = kz * TILE_STEP_WORLD;
      const onStartLine =
        startCp !== undefined &&
        Math.abs((wx - startCp.center.x) * startFwdX + (wz - startCp.center.z) * startFwdZ) <
          START_LINE_DEPTH;
      const sp = new Sprite(onStartLine ? atlas.whiteTile : atlas.tile);
      const sc = worldToScreen(wx, wz);
      sp.x = Math.round(sc.x - TILE_W / 2);
      sp.y = Math.round(sc.y - TILE_H / 2);
      sp.zIndex = wx + wz;
      this.tilesContainer.addChild(sp);
    };

    // 1) Walk the centerline and fill a strip `trackWidth` wide.
    const samples = densifyLoop(track.loop, TILE_STEP_WORLD);
    for (let i = 0; i < samples.length; i++) {
      const p = samples[i]!;
      const next = samples[(i + 1) % samples.length]!;
      const dx = next.x - p.x;
      const dz = next.z - p.z;
      const len = Math.hypot(dx, dz) || 1;
      const px = -dz / len;
      const pz = dx / len;
      for (let off = -halfW; off <= halfW; off += TILE_STEP_WORLD) {
        const tx = p.x + px * off;
        const tz = p.z + pz * off;
        placeTile(Math.round(tx / TILE_STEP_WORLD), Math.round(tz / TILE_STEP_WORLD));
      }
    }

    // 2) Extend a strip behind the start line so spawn rows have ground under
    // them. Behind = -fwd direction (depth negative ⇒ further behind).
    if (startCp) {
      const sideX = -Math.cos(startCp.yaw);
      const sideZ = Math.sin(startCp.yaw);
      for (let depth = -START_LINE_EXTENSION; depth < 0; depth += TILE_STEP_WORLD) {
        for (let off = -halfW; off <= halfW; off += TILE_STEP_WORLD) {
          const tx = startCp.center.x + startFwdX * depth + sideX * off;
          const tz = startCp.center.z + startFwdZ * depth + sideZ * off;
          placeTile(Math.round(tx / TILE_STEP_WORLD), Math.round(tz / TILE_STEP_WORLD));
        }
      }
    }

    this.tilesContainer.sortableChildren = true;
    this.tilesContainer.sortChildren();
  }

  private buildBoostPads(track: TrackDef, atlas: SpriteAtlas) {
    const STEP = 1.5;
    for (const pad of track.boostPads) {
      const cosY = Math.cos(pad.yaw);
      const sinY = Math.sin(pad.yaw);
      const fwdX = -sinY;
      const fwdZ = -cosY;
      const sideX = -cosY;
      const sideZ = sinY;
      const halfL = pad.length / 2;
      const halfW = pad.width / 2;
      for (let l = -halfL; l <= halfL; l += STEP) {
        for (let w = -halfW; w <= halfW; w += STEP) {
          const wx = pad.center.x + fwdX * l + sideX * w;
          const wz = pad.center.z + fwdZ * l + sideZ * w;
          const sp = new Sprite(atlas.boostTile);
          const sc = worldToScreen(wx, wz);
          sp.x = Math.round(sc.x - TILE_W / 2);
          sp.y = Math.round(sc.y - TILE_H / 2);
          sp.zIndex = wx + wz - 0.5; // slightly under bikes
          this.propsContainer.addChild(sp);
        }
      }
    }
    this.propsContainer.sortableChildren = true;
  }

  private buildCheckpoints(track: TrackDef, atlas: SpriteAtlas) {
    for (const cp of track.checkpoints) {
      // The start line gets a painted zebra crossing instead of vertical bars.
      if (cp.id === 0) {
        this.checkpointSprites.set(cp.id, []);
        continue;
      }
      const tex = atlas.checkpointMarker;
      const sideX = -Math.cos(cp.yaw);
      const sideZ = Math.sin(cp.yaw);
      const sprites: Sprite[] = [];
      for (const sign of [-1, 1] as const) {
        const wx = cp.center.x + sideX * cp.width * sign;
        const wz = cp.center.z + sideZ * cp.width * sign;
        const sp = new Sprite(tex);
        const sc = worldToScreen(wx, wz);
        sp.anchor.set(0.5, 1);
        sp.x = Math.round(sc.x);
        sp.y = Math.round(sc.y);
        sp.zIndex = wx + wz + 0.25;
        this.propsContainer.addChild(sp);
        sprites.push(sp);
      }
      this.checkpointSprites.set(cp.id, sprites);
    }
  }

}

/**
 * Resample the loop centerline so consecutive points are at most `step` world
 * units apart. Helps draw a continuous track without big gaps on long
 * straights.
 */
function densifyLoop(
  loop: TrackDef['loop'],
  step: number,
): Array<{ x: number; z: number }> {
  const out: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < loop.length; i++) {
    const a = loop[i]!;
    const b = loop[(i + 1) % loop.length]!;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const dist = Math.hypot(dx, dz);
    const n = Math.max(1, Math.ceil(dist / step));
    for (let j = 0; j < n; j++) {
      const t = j / n;
      out.push({ x: a.x + dx * t, z: a.z + dz * t });
    }
  }
  return out;
}
