import { Container, Sprite } from 'pixi.js';
import { TILE_H, TILE_W, worldToScreen } from './projection.js';
import type { SpriteAtlas } from './sprites.js';

const BODY_SCALE = 1.0;

/**
 * Visual representation of a single bike. The cat is a side-view sprite, so
 * to keep it iso-aligned without going upside-down we:
 *   - mirror horizontally when the bike is heading screen-left
 *   - rotate by the screen-projected forward angle (folded into ±90°) so it
 *     always tilts along the iso travel axis instead of sitting flat.
 */
export class BikeView {
  container: Container;
  private body: Sprite;
  private shadow: Sprite;
  private label: Container;
  private atlas: SpriteAtlas;
  private vehicle: string;

  constructor(atlas: SpriteAtlas, vehicle: string, label: Container, highlighted = false) {
    this.atlas = atlas;
    this.vehicle = vehicle;
    this.label = label;

    this.container = new Container();
    this.shadow = new Sprite(atlas.shadow);
    this.shadow.anchor.set(0.5, 0.5);
    this.shadow.y = 10;
    this.shadow.scale.set(BODY_SCALE * 1.4);
    this.container.addChild(this.shadow);

    const tex = atlas.bikes[vehicle] ?? atlas.bikes.scout!;
    this.body = new Sprite(tex);
    this.body.anchor.set(0.5, 0.65);
    this.body.scale.set(BODY_SCALE);
    this.container.addChild(this.body);

    if (label) {
      this.container.addChild(label);
    }

    if (highlighted) {
      this.body.tint = 0xffffff;
    }
  }

  setVehicle(vehicle: string) {
    if (this.vehicle === vehicle) return;
    this.vehicle = vehicle;
    const tex = this.atlas.bikes[vehicle] ?? this.atlas.bikes.scout!;
    this.body.texture = tex;
  }

  update(x: number, z: number, yaw: number) {
    const sc = worldToScreen(x, z);
    this.container.x = Math.round(sc.x);
    this.container.y = Math.round(sc.y - TILE_H * 0.25);
    this.container.zIndex = x + z;

    // Project world forward into screen space.
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    const sxDir = (fx - fz) * TILE_W;
    const syDir = (fx + fz) * TILE_H;

    // Mirror horizontally when heading screen-left so the cat keeps facing
    // the direction of travel. Then tilt by the iso angle folded into the
    // (-π/2, π/2) range so the sprite never goes upside down.
    const flipSign = sxDir < 0 ? -1 : 1;
    const isoTilt = Math.atan2(syDir * flipSign, Math.abs(sxDir));

    this.body.scale.x = BODY_SCALE * flipSign;
    this.body.scale.y = BODY_SCALE;
    this.body.rotation = isoTilt;
  }

  destroy() {
    this.container.destroy({ children: true });
  }
}
