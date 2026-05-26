import { INPUT_FLAGS } from '@paws/shared';
import { useEffect } from 'react';
import { setTouchFlag } from '../net/input.ts';

/**
 * On-screen controls for touch devices. Each button sets/clears the matching
 * input flag through `setTouchFlag`, which the input loop merges with the
 * keyboard state every tick.
 */
export function TouchControls() {
  // If a finger leaves the screen mid-press (touchcancel) we still need to
  // release the flag, otherwise the bike "keeps holding the button".
  useEffect(() => () => {
    setTouchFlag(INPUT_FLAGS.THROTTLE, false);
    setTouchFlag(INPUT_FLAGS.BRAKE, false);
    setTouchFlag(INPUT_FLAGS.LEFT, false);
    setTouchFlag(INPUT_FLAGS.RIGHT, false);
    setTouchFlag(INPUT_FLAGS.DRIFT, false);
  }, []);

  const press = (flag: number) => (e: React.PointerEvent | React.TouchEvent) => {
    e.preventDefault();
    setTouchFlag(flag, true);
  };
  const release = (flag: number) => (e: React.PointerEvent | React.TouchEvent) => {
    e.preventDefault();
    setTouchFlag(flag, false);
  };

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* Bottom-left: steering pair (HP + minimap stack above it). */}
      <div className="absolute bottom-6 left-6 flex gap-4">
        <button
          type="button"
          aria-label="Steer left"
          onPointerDown={press(INPUT_FLAGS.LEFT)}
          onPointerUp={release(INPUT_FLAGS.LEFT)}
          onPointerCancel={release(INPUT_FLAGS.LEFT)}
          onPointerLeave={release(INPUT_FLAGS.LEFT)}
          className="touch-btn cyan h-20 w-20 text-2xl"
        >
          ◀
        </button>
        <button
          type="button"
          aria-label="Steer right"
          onPointerDown={press(INPUT_FLAGS.RIGHT)}
          onPointerUp={release(INPUT_FLAGS.RIGHT)}
          onPointerCancel={release(INPUT_FLAGS.RIGHT)}
          onPointerLeave={release(INPUT_FLAGS.RIGHT)}
          className="touch-btn cyan h-20 w-20 text-2xl"
        >
          ▶
        </button>
      </div>

      {/* Bottom-right: throttle + brake + drift. */}
      <div className="absolute bottom-7 right-7 flex items-end gap-4">
        <button
          type="button"
          aria-label="Drift"
          onPointerDown={press(INPUT_FLAGS.DRIFT)}
          onPointerUp={release(INPUT_FLAGS.DRIFT)}
          onPointerCancel={release(INPUT_FLAGS.DRIFT)}
          onPointerLeave={release(INPUT_FLAGS.DRIFT)}
          className="touch-btn violet h-14 w-14 text-[10px]"
        >
          DRFT
        </button>
        <div className="flex flex-col gap-3">
          <button
            type="button"
            aria-label="Throttle"
            onPointerDown={press(INPUT_FLAGS.THROTTLE)}
            onPointerUp={release(INPUT_FLAGS.THROTTLE)}
            onPointerCancel={release(INPUT_FLAGS.THROTTLE)}
            onPointerLeave={release(INPUT_FLAGS.THROTTLE)}
            className="touch-btn orange h-24 w-24 text-base"
          >
            GAS
          </button>
          <button
            type="button"
            aria-label="Brake"
            onPointerDown={press(INPUT_FLAGS.BRAKE)}
            onPointerUp={release(INPUT_FLAGS.BRAKE)}
            onPointerCancel={release(INPUT_FLAGS.BRAKE)}
            onPointerLeave={release(INPUT_FLAGS.BRAKE)}
            className="touch-btn red h-14 w-24 text-[10px]"
          >
            BRK
          </button>
        </div>
      </div>
    </div>
  );
}
