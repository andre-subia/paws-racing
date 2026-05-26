import {
  type BikeState,
  INPUT_FLAGS,
  type InputFlags,
  type TrackDef,
  type VehicleSpec,
} from '@paws/shared';

/**
 * How many centerline samples ahead the bot aims for. The loop is sampled
 * densely on corners and sparsely on straights, so a fixed offset naturally
 * yields a shorter look-ahead (tighter line) through corners and a longer one
 * on straights. 5 tracks the centerline faithfully (no wall grinding) while
 * still reading the corner early; larger values cut chords into the inside wall.
 */
const LOOKAHEAD_SAMPLES = 5;

/** Find the index of the centerline sample nearest the bike (cheap O(n)). */
function nearestLoopIndex(loop: TrackDef['loop'], x: number, z: number): number {
  let best = 0;
  let bestD2 = Number.POSITIVE_INFINITY;
  for (let i = 0; i < loop.length; i++) {
    const p = loop[i]!;
    const dx = p.x - x;
    const dz = p.z - z;
    const d2 = dx * dx + dz * dz;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  }
  return best;
}

/**
 * Steer-to-look-ahead bot driver. Produces an {@link InputFlags} bitfield for
 * one bike each tick by aiming at a point ahead on the track centerline:
 *   - steer toward the look-ahead point (LEFT raises yaw, RIGHT lowers it,
 *     matching `stepBike`'s `(left - right) * turnRate` convention);
 *   - hold throttle up to a skill-scaled top speed;
 *   - brake + drift through sharp corners so it doesn't barrel into a wall.
 *
 * `skill` is 0..1; higher lets the bot carry more speed.
 */
export function computeBotInput(
  track: TrackDef,
  bike: BikeState,
  spec: VehicleSpec,
  skill: number,
): InputFlags {
  const loop = track.loop;
  const n = loop.length;
  const idx = nearestLoopIndex(loop, bike.x, bike.z);
  const aim = loop[(idx + LOOKAHEAD_SAMPLES) % n]!;

  let tx = aim.x - bike.x;
  let tz = aim.z - bike.z;
  const td = Math.hypot(tx, tz) || 1;
  tx /= td;
  tz /= td;

  // Desired yaw so the bike's forward (-sin yaw, -cos yaw) points at the aim.
  const desiredYaw = Math.atan2(-tx, -tz);
  let err = desiredYaw - bike.yaw;
  while (err > Math.PI) err -= 2 * Math.PI;
  while (err < -Math.PI) err += 2 * Math.PI;
  const absErr = Math.abs(err);

  let flags = 0;

  // Steering. Small dead zone avoids twitchy weaving on straights.
  const DEAD = 0.05;
  if (err > DEAD) flags |= INPUT_FLAGS.LEFT;
  else if (err < -DEAD) flags |= INPUT_FLAGS.RIGHT;

  // Drift through corners first — it boosts steer authority (steerScale 1.5),
  // so the bot can hold speed through a bend instead of scrubbing it off.
  const drifting = absErr > 0.3 && bike.speed > 10;
  if (drifting) flags |= INPUT_FLAGS.DRIFT;

  // Throttle vs. brake. The bike has no lateral slide, so we rarely need to
  // brake — only when a genuinely hard corner would fling us into the wall.
  // Otherwise drive up to the skill-capped top speed.
  const maxSpeed = spec.topSpeed * (0.82 + 0.18 * skill);
  const hardCorner = absErr > 1.0 && bike.speed > spec.topSpeed * 0.6;
  if (hardCorner) {
    flags |= INPUT_FLAGS.BRAKE;
  } else if (bike.speed < maxSpeed) {
    flags |= INPUT_FLAGS.THROTTLE;
  }

  return flags;
}
