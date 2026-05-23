import { INPUT_FLAGS, SIM_HZ } from '@paws/shared';
import type { Room } from 'colyseus.js';

const KEY_MAP: Record<string, number> = {
  KeyW: INPUT_FLAGS.THROTTLE,
  ArrowUp: INPUT_FLAGS.THROTTLE,
  KeyS: INPUT_FLAGS.BRAKE,
  ArrowDown: INPUT_FLAGS.BRAKE,
  KeyA: INPUT_FLAGS.LEFT,
  ArrowLeft: INPUT_FLAGS.LEFT,
  KeyD: INPUT_FLAGS.RIGHT,
  ArrowRight: INPUT_FLAGS.RIGHT,
  Space: INPUT_FLAGS.DRIFT,
  ShiftLeft: INPUT_FLAGS.DRIFT,
  KeyB: INPUT_FLAGS.LOOK_BACK,
};

export interface InputController {
  stop: () => void;
}

/**
 * Samples keyboard at SIM_HZ and sends `input` messages to the room with
 * monotonically increasing seq numbers. No client-side prediction yet; that
 * lands in Week 2.
 */
export function startInputLoop(room: Room): InputController {
  const pressed = new Set<string>();
  let seq = 0;
  let tick = 0;

  const onDown = (e: KeyboardEvent) => {
    if (KEY_MAP[e.code] !== undefined) {
      pressed.add(e.code);
      // Avoid scrolling on arrows / space.
      e.preventDefault();
    }
  };
  const onUp = (e: KeyboardEvent) => {
    if (KEY_MAP[e.code] !== undefined) pressed.delete(e.code);
  };
  window.addEventListener('keydown', onDown);
  window.addEventListener('keyup', onUp);

  const interval = window.setInterval(() => {
    let flags = 0;
    for (const code of pressed) flags |= KEY_MAP[code] ?? 0;
    seq += 1;
    tick += 1;
    room.send('input', { seq, tick, flags });
  }, 1000 / SIM_HZ);

  return {
    stop: () => {
      window.clearInterval(interval);
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
    },
  };
}
