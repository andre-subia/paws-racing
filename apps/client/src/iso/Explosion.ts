import { Container, Sprite, type Texture } from 'pixi.js';
import { TILE_H, worldToScreen } from './projection.js';

const FPS = 16;
const SPRITE_SCALE = 0.85;

/**
 * One-shot explosion animation pinned to a world position. Steps through 9
 * frames at FPS speed and reports `done` so the scene can dispose of it.
 */
export class Explosion {
  container: Container;
  done = false;
  private sprite: Sprite;
  private frames: Texture[];
  private elapsed = 0;
  private currentFrame = -1;
  private worldX: number;
  private worldZ: number;

  constructor(frames: Texture[], worldX: number, worldZ: number) {
    this.frames = frames;
    this.worldX = worldX;
    this.worldZ = worldZ;
    this.container = new Container();
    this.sprite = new Sprite(frames[0]!);
    this.sprite.anchor.set(0.5, 0.7);
    this.sprite.scale.set(SPRITE_SCALE);
    this.container.addChild(this.sprite);
    this.applyPosition();
  }

  private applyPosition() {
    const sc = worldToScreen(this.worldX, this.worldZ);
    this.container.x = Math.round(sc.x);
    this.container.y = Math.round(sc.y - TILE_H * 0.25);
    this.container.zIndex = this.worldX + this.worldZ + 0.5;
  }

  update(dt: number) {
    if (this.done) return;
    this.elapsed += dt;
    const idx = Math.floor(this.elapsed * FPS);
    if (idx >= this.frames.length) {
      this.done = true;
      return;
    }
    if (idx !== this.currentFrame) {
      this.currentFrame = idx;
      this.sprite.texture = this.frames[idx]!;
    }
  }

  destroy() {
    this.container.destroy({ children: true });
  }
}
