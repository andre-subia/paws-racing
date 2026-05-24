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

  const baseBtn =
    'pointer-events-auto select-none touch-none flex items-center justify-center font-pixel text-xl text-white/90 rounded-full border-2 active:scale-95 active:bg-white/20';

  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      {/* Bottom-left: steering pair. */}
      <div className="absolute bottom-6 left-6 flex gap-3">
        <button
          type="button"
          aria-label="Steer left"
          onPointerDown={press(INPUT_FLAGS.LEFT)}
          onPointerUp={release(INPUT_FLAGS.LEFT)}
          onPointerCancel={release(INPUT_FLAGS.LEFT)}
          onPointerLeave={release(INPUT_FLAGS.LEFT)}
          className={`${baseBtn} h-20 w-20 border-neon-cyan/60 bg-neon-cyan/15`}
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
          className={`${baseBtn} h-20 w-20 border-neon-cyan/60 bg-neon-cyan/15`}
        >
          ▶
        </button>
      </div>

      {/* Bottom-right: throttle + brake + drift. */}
      <div className="absolute bottom-6 right-6 flex items-end gap-3">
        <button
          type="button"
          aria-label="Drift"
          onPointerDown={press(INPUT_FLAGS.DRIFT)}
          onPointerUp={release(INPUT_FLAGS.DRIFT)}
          onPointerCancel={release(INPUT_FLAGS.DRIFT)}
          onPointerLeave={release(INPUT_FLAGS.DRIFT)}
          className={`${baseBtn} h-14 w-14 border-neon-violet/60 bg-neon-violet/15 text-sm`}
        >
          DRFT
        </button>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            aria-label="Throttle"
            onPointerDown={press(INPUT_FLAGS.THROTTLE)}
            onPointerUp={release(INPUT_FLAGS.THROTTLE)}
            onPointerCancel={release(INPUT_FLAGS.THROTTLE)}
            onPointerLeave={release(INPUT_FLAGS.THROTTLE)}
            className={`${baseBtn} h-24 w-24 border-neon-orange/70 bg-neon-orange/25 text-lg`}
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
            className={`${baseBtn} h-14 w-24 border-red-400/60 bg-red-500/20 text-sm`}
          >
            BRK
          </button>
        </div>
      </div>
    </div>
  );
}
