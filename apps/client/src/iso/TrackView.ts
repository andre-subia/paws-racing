import { type TrackDef, insideBox } from '@paws/shared';
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
// Grass margin (world units) added around the track's bounding box so the
// off-track area has visual context. Larger → more tiles to render.
const GRASS_MARGIN = 12;

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
    this.buildRamps(track, atlas);
    this.buildCheckpoints(track, atlas);
  }

  /**
   * Highlight the checkpoint id the local player is heading toward. All
   * others are dimmed; the target pulses.
   */
  setNextCheckpoint(id: number, time: number) {
    this.nextCheckpointId = id;
    // The target gate pulses bigger; the rest stay clearly visible (not faded out).
    const pulse = 1.1 + Math.sin(time * 6) * 0.22;
    for (const [cid, sprites] of this.checkpointSprites) {
      const isNext = cid === id;
      for (const sp of sprites) {
        sp.alpha = isNext ? 1 : 0.65;
        sp.scale.set(isNext ? pulse : 1, isNext ? pulse : 1);
      }
    }
  }

  private buildSurface(track: TrackDef, atlas: SpriteAtlas) {
    const placedKeys = new Set<string>();
    const halfW = track.trackWidth / 2;
    const halfWSq = halfW * halfW;

    const startCp = track.checkpoints.find((c) => c.id === 0);
    const startFwdX = startCp ? -Math.sin(startCp.yaw) : 0;
    const startFwdZ = startCp ? -Math.cos(startCp.yaw) : 0;
    const startSideX = startCp ? -Math.cos(startCp.yaw) : 0;
    const startSideZ = startCp ? Math.sin(startCp.yaw) : 0;

    // Decimate the loop for the distance test so dense polygon tracks stay
    // cheap; long segments keep point-to-segment distance accurate.
    const stride = Math.max(1, Math.floor(track.loop.length / 240));
    const coarse: Array<{ x: number; z: number }> = [];
    for (let i = 0; i < track.loop.length; i += stride) coarse.push(track.loop[i]!);

    // Min squared distance from (x, z) to the centerline polyline.
    const distSqToLoop = (x: number, z: number): number => {
      let best = Number.POSITIVE_INFINITY;
      for (let i = 0; i < coarse.length; i++) {
        const a = coarse[i]!;
        const b = coarse[(i + 1) % coarse.length]!;
        const abx = b.x - a.x;
        const abz = b.z - a.z;
        const len2 = abx * abx + abz * abz;
        let t = 0;
        if (len2 > 0) {
          t = ((x - a.x) * abx + (z - a.z) * abz) / len2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
        }
        const dx = x - (a.x + abx * t);
        const dz = z - (a.z + abz * t);
        const d2 = dx * dx + dz * dz;
        if (d2 < best) best = d2;
      }
      return best;
    };

    // Behind-the-start extension so the spawn rows have ground under them.
    const onStartExtension = (wx: number, wz: number): boolean => {
      if (!startCp) return false;
      const dF = (wx - startCp.center.x) * startFwdX + (wz - startCp.center.z) * startFwdZ;
      const dS = (wx - startCp.center.x) * startSideX + (wz - startCp.center.z) * startSideZ;
      return dF <= 0 && dF >= -START_LINE_EXTENSION && Math.abs(dS) <= halfW;
    };

    // Loop bounding box.
    let minX = Number.POSITIVE_INFINITY;
    let minZ = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxZ = Number.NEGATIVE_INFINITY;
    for (const p of track.loop) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.z < minZ) minZ = p.z;
      if (p.z > maxZ) maxZ = p.z;
    }
    const lo = (v: number) => Math.floor(v / TILE_STEP_WORLD);
    const hi = (v: number) => Math.ceil(v / TILE_STEP_WORLD);

    // Phase 1: solid track band. Every cell within halfW of the centerline (or
    // in the start extension) gets asphalt — a per-cell distance test, so the
    // surface is gap-free even on the outside of sweeping curves. White is
    // painted ONLY on the start-line segment itself (forward AND lateral
    // bounded), so the finish line is the only white stripe. Gap cells are
    // claimed but left empty so the dark void shows through.
    const bandPad = halfW + 2 + START_LINE_EXTENSION;
    for (let kz = lo(minZ - bandPad); kz <= hi(maxZ + bandPad); kz++) {
      for (let kx = lo(minX - bandPad); kx <= hi(maxX + bandPad); kx++) {
        const wx = kx * TILE_STEP_WORLD;
        const wz = kz * TILE_STEP_WORLD;
        if (distSqToLoop(wx, wz) > halfWSq && !onStartExtension(wx, wz)) continue;
        placedKeys.add(`${kx},${kz}`);
        if (track.gaps.some((g) => insideBox(wx, wz, g))) continue; // carved hole
        let white = false;
        if (startCp) {
          const dF = (wx - startCp.center.x) * startFwdX + (wz - startCp.center.z) * startFwdZ;
          const dS = (wx - startCp.center.x) * startSideX + (wz - startCp.center.z) * startSideZ;
          white = Math.abs(dF) < START_LINE_DEPTH && Math.abs(dS) <= halfW + 0.5;
        }
        const sp = new Sprite(white ? atlas.whiteTile : atlas.tile);
        const sc = worldToScreen(wx, wz);
        sp.x = Math.round(sc.x - TILE_W / 2);
        sp.y = Math.round(sc.y - TILE_H / 2);
        sp.zIndex = wx + wz;
        this.tilesContainer.addChild(sp);
      }
    }

    // Phase 2: grass everywhere the track didn't claim.
    const grassPad = halfW + GRASS_MARGIN;
    for (let kz = lo(minZ - grassPad); kz <= hi(maxZ + grassPad); kz++) {
      for (let kx = lo(minX - grassPad); kx <= hi(maxX + grassPad); kx++) {
        const key = `${kx},${kz}`;
        if (placedKeys.has(key)) continue;
        placedKeys.add(key);
        const wx = kx * TILE_STEP_WORLD;
        const wz = kz * TILE_STEP_WORLD;
        const sp = new Sprite(atlas.grassTile);
        const sc = worldToScreen(wx, wz);
        sp.x = Math.round(sc.x - TILE_W / 2);
        sp.y = Math.round(sc.y - TILE_H / 2);
        sp.zIndex = wx + wz;
        this.tilesContainer.addChild(sp);
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

  private buildRamps(track: TrackDef, atlas: SpriteAtlas) {
    const STEP = 1.5;
    for (const ramp of track.ramps) {
      const cosY = Math.cos(ramp.yaw);
      const sinY = Math.sin(ramp.yaw);
      const fwdX = -sinY;
      const fwdZ = -cosY;
      const sideX = -cosY;
      const sideZ = sinY;
      const halfL = ramp.length / 2;
      const halfW = ramp.width / 2;
      for (let l = -halfL; l <= halfL; l += STEP) {
        for (let w = -halfW; w <= halfW; w += STEP) {
          const wx = ramp.center.x + fwdX * l + sideX * w;
          const wz = ramp.center.z + fwdZ * l + sideZ * w;
          const sp = new Sprite(atlas.boostTile);
          // Yellow tint distinguishes a launch ramp from the pink boost strips,
          // brightening toward the lip so it reads as a takeoff.
          sp.tint = l > halfL - STEP * 1.5 ? 0xffffff : 0xffd400;
          const sc = worldToScreen(wx, wz);
          sp.x = Math.round(sc.x - TILE_W / 2);
          sp.y = Math.round(sc.y - TILE_H / 2);
          sp.zIndex = wx + wz - 0.5;
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
