/**
 * 2:1 dimetric ("isometric") projection used everywhere in the renderer.
 *
 * World space comes from the server / shared sim — x and z are the ground
 * plane axes, y is "up". For the SNES-style camera we essentially ignore y
 * (everything is on the ground), and project (x, z) to screen pixels using a
 * classic tile of TILE_W x TILE_H. The result puts +x to screen-right-down and
 * +z to screen-left-down, so the player's "forward" (negative z when yaw=0)
 * heads up-and-left on the screen.
 *
 * Pixel-perfect rendering relies on integer-snapping the camera + the screen
 * scale; non-integer offsets produce sub-pixel sprite jitter.
 */

export const TILE_W = 64; // diamond width in screen pixels
export const TILE_H = 32; // diamond height in screen pixels

export interface ScreenPoint {
  x: number;
  y: number;
}

/** World (x, z) -> screen (sx, sy) before camera offset. */
export function worldToScreen(x: number, z: number, out?: ScreenPoint): ScreenPoint {
  const target = out ?? { x: 0, y: 0 };
  target.x = (x - z) * (TILE_W / 2);
  target.y = (x + z) * (TILE_H / 2);
  return target;
}

/** Inverse — screen (sx, sy) -> world (x, z). Useful for click-to-world. */
export function screenToWorld(sx: number, sy: number, out?: { x: number; z: number }) {
  const target = out ?? { x: 0, z: 0 };
  target.x = sx / TILE_W + sy / TILE_H;
  target.z = sy / TILE_H - sx / TILE_W;
  return target;
}

/**
 * Pick a sprite frame index in [0, frames) for a given world-yaw, where yaw 0
 * is "facing -z" (the bike's forward axis). Frames are numbered clockwise
 * around the bike, starting at "facing up-left on screen" (= yaw 0).
 */
export function yawToFrame(yaw: number, frames: number): number {
  const tau = Math.PI * 2;
  // Normalize yaw into [0, 2π).
  const norm = ((yaw % tau) + tau) % tau;
  return Math.round((norm / tau) * frames) % frames;
}
