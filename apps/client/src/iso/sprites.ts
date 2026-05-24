import {
  Assets,
  Color,
  Graphics,
  Matrix,
  Renderer,
  RenderTexture,
  Texture,
} from 'pixi.js';
import { VEHICLES } from '@paws/shared';
import { TILE_H, TILE_W } from './projection.js';

/**
 * Sprite atlas. Track tiles + checkpoint markers are still procedurally baked;
 * each vehicle's body is a PNG loaded from VEHICLES[id].spritePath that the
 * BikeView rotates / flips at runtime.
 */

export interface SpriteAtlas {
  /** Single body texture per vehicle id. */
  bikes: Record<string, Texture>;
  tile: Texture;
  whiteTile: Texture;
  boostTile: Texture;
  checkpointMarker: Texture;
  startMarker: Texture;
  shadow: Texture;
}

export async function buildAtlas(renderer: Renderer): Promise<SpriteAtlas> {
  const specs = Object.values(VEHICLES);
  const textures = await Promise.all(
    specs.map(async (spec) => {
      const tex = (await Assets.load(spec.spritePath)) as Texture;
      tex.source.scaleMode = 'nearest';
      return [spec.id, tex] as const;
    }),
  );
  const bikes: Record<string, Texture> = {};
  for (const [id, tex] of textures) bikes[id] = tex;

  return {
    bikes,
    tile: buildTile(renderer, '#3b2470', '#52339c', '#1f0e3f'),
    whiteTile: buildTile(renderer, '#f5f5f5', '#ffffff', '#b8b8b8'),
    boostTile: buildTile(renderer, '#ff3aa3', '#ff7ed3', '#7c1b54'),
    checkpointMarker: buildCheckpoint(renderer, '#9b59ff'),
    startMarker: buildCheckpoint(renderer, '#ffb142'),
    shadow: buildShadow(renderer),
  };
}

function buildTile(
  renderer: Renderer,
  topColor: string,
  highlightColor: string,
  edgeColor: string,
): Texture {
  const g = new Graphics();
  const hw = TILE_W / 2;
  const hh = TILE_H / 2;
  g.poly([0, 0, hw, hh, 0, TILE_H, -hw, hh, 0, 0]).fill({ color: topColor });
  g.moveTo(-hw, hh).lineTo(0, 0).lineTo(hw, hh).stroke({ width: 1, color: highlightColor });
  g.moveTo(-hw, hh).lineTo(0, TILE_H).lineTo(hw, hh).stroke({ width: 1, color: edgeColor });

  const rt = RenderTexture.create({
    width: TILE_W,
    height: TILE_H,
    resolution: 1,
    antialias: false,
  });
  rt.source.scaleMode = 'nearest';
  const matrix = new Matrix();
  matrix.tx = hw;
  matrix.ty = 0;
  renderer.render({ container: g, target: rt, clear: true, transform: matrix });
  g.destroy();
  return rt;
}

function buildCheckpoint(renderer: Renderer, color: string): Texture {
  const W = 6;
  const H = 32;
  const g = new Graphics();
  const c = new Color(color);
  g.rect(0, 0, W, H).fill({ color: c.toNumber() });
  g.rect(0, 0, W, 4).fill({ color: '#ffffff' });
  g.rect(0, H - 4, W, 4).fill({ color: c.multiply(new Color('#666666')).toNumber() });
  const rt = RenderTexture.create({ width: W, height: H, resolution: 1, antialias: false });
  rt.source.scaleMode = 'nearest';
  renderer.render({ container: g, target: rt, clear: true });
  g.destroy();
  return rt;
}

function buildShadow(renderer: Renderer): Texture {
  const W = 40;
  const H = 18;
  const g = new Graphics();
  g.ellipse(W / 2, H / 2, W / 2 - 2, H / 2 - 2).fill({ color: 0x000000, alpha: 0.5 });
  const rt = RenderTexture.create({ width: W, height: H, resolution: 1, antialias: false });
  rt.source.scaleMode = 'nearest';
  renderer.render({ container: g, target: rt, clear: true });
  g.destroy();
  return rt;
}
