import { Application, Container } from 'pixi.js';
import { worldToScreen, type ScreenPoint } from './projection.js';

/**
 * The Pixi viewport: an Application sized to the device, with two Containers:
 *
 *   - `world`: holds the track + bikes + props. Moved by the camera.
 *   - `overlay`: holds HUD-like things rendered in screen space (rank, mini-map).
 *     We mostly use DOM for HUD, so this is light.
 *
 * Pixel-perfect rendering: we render at the native pixel size and integer-snap
 * the camera offset. PixelArt sprite scaling is handled at sprite creation
 * time (textures use `nearest` scale mode).
 */
export class Viewport {
  app: Application;
  world: Container;
  overlay: Container;
  private cameraX = 0;
  private cameraZ = 0;
  private cameraOffsetX = 0;
  private cameraOffsetY = 0;

  private constructor(app: Application) {
    this.app = app;
    this.world = new Container();
    this.overlay = new Container();
    app.stage.addChild(this.world);
    app.stage.addChild(this.overlay);
  }

  /**
   * Snap the camera to the target each frame so the player stays pinned to
   * screen center. Any lerp causes the bike to drift forward at high speed,
   * which reads as a duplicate/smear against the integer-snapped background.
   */
  followTarget(x: number, z: number, _dt: number) {
    this.cameraX = x;
    this.cameraZ = z;
    this.applyCamera();
  }

  setTargetSnap(x: number, z: number) {
    this.cameraX = x;
    this.cameraZ = z;
    this.applyCamera();
  }

  /** Resize hook — re-centers the camera and tells Pixi to match the parent. */
  resize() {
    const parent = (this.app.canvas as HTMLCanvasElement).parentElement;
    if (parent) {
      this.app.renderer.resize(parent.clientWidth, parent.clientHeight);
    }
    this.cameraOffsetX = Math.floor(this.app.screen.width / 2);
    this.cameraOffsetY = Math.floor(this.app.screen.height / 2);
    this.applyCamera();
  }

  private applyCamera() {
    const p: ScreenPoint = { x: 0, y: 0 };
    worldToScreen(this.cameraX, this.cameraZ, p);
    // Integer snap to avoid sub-pixel jitter on pixel-art sprites.
    this.world.x = Math.round(this.cameraOffsetX - p.x);
    this.world.y = Math.round(this.cameraOffsetY - p.y);
  }

  private destroyed = false;

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    // Pixi v8 quirk: passing extra options through the plugin chain crashes if
    // any plugin's destroy hook was already torn down (StrictMode double-mount).
    // Letting Pixi use defaults + manual canvas removal is the safe path.
    try {
      const canvas = this.app.canvas;
      this.app.destroy({ removeView: true }, { children: true });
      // Belt-and-suspenders DOM cleanup in case removeView no-ops.
      if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
    } catch (err) {
      console.warn('viewport destroy', err);
    }
  }

  static async create(parent: HTMLElement): Promise<Viewport> {
    const app = new Application();
    await app.init({
      // NOTE: not passing `resizeTo` on purpose. Pixi v8's ResizePlugin has a
      // destroy hook that crashes in StrictMode's double-mount because
      // `_cancelResize` ends up undefined. We handle resize manually below.
      width: parent.clientWidth || window.innerWidth,
      height: parent.clientHeight || window.innerHeight,
      backgroundColor: 0x0b0418,
      antialias: false,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      preference: 'webgl',
    });
    parent.appendChild(app.canvas);

    const v = new Viewport(app);
    v.resize();
    return v;
  }
}
