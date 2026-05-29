// Vertical (jump) physics: a drift TAP hops the bike off the ground and
// gravity brings it back; holding drift does NOT re-hop; ramps launch higher.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BIKE_GROUND_OFFSET,
  INPUT_FLAGS,
  SIM_DT,
  emptyBikeState,
  getTrack,
  stepBike,
  VEHICLES,
} from '@paws/shared';

const spec = VEHICLES.scout;
const flat = getTrack('neo_kibble_city');
const groundY = flat.surfaceY + BIKE_GROUND_OFFSET;

function freshBike() {
  const b = emptyBikeState();
  b.y = groundY;
  return b;
}

test('a drift tap hops the bike off the ground, then it lands', () => {
  const bike = freshBike();
  // One tick with DRIFT pressed (rising edge) → upward velocity.
  stepBike(bike, INPUT_FLAGS.DRIFT, SIM_DT, spec, flat);
  assert.ok(bike.y > groundY, `should leave the ground, y=${bike.y}`);
  assert.ok(bike.vy > 0, `should be rising, vy=${bike.vy}`);

  // Release and coast — gravity must bring it back to the ground.
  let maxY = bike.y;
  for (let i = 0; i < 120; i++) {
    stepBike(bike, 0, SIM_DT, spec, flat);
    if (bike.y > maxY) maxY = bike.y;
    if (bike.y <= groundY && i > 2) break;
  }
  assert.ok(maxY - groundY > 0.5, `should reach real height, peak=${maxY - groundY}`);
  assert.ok(Math.abs(bike.y - groundY) < 1e-6, `should land back on the ground, y=${bike.y}`);
});

test('holding drift does not pogo — only the press edge hops', () => {
  const bike = freshBike();
  stepBike(bike, INPUT_FLAGS.DRIFT, SIM_DT, spec, flat); // hop
  // Hold drift the whole way down; it must land and stay grounded (no re-hop).
  for (let i = 0; i < 200; i++) stepBike(bike, INPUT_FLAGS.DRIFT, SIM_DT, spec, flat);
  assert.ok(Math.abs(bike.y - groundY) < 1e-6, `held drift should stay grounded, y=${bike.y}`);
  assert.equal(bike.vy, 0);
});

test('a ramp launches higher than a manual hop', () => {
  const track = getTrack('whisker_heights');
  const gy = track.surfaceY + BIKE_GROUND_OFFSET;
  const ramp = track.ramps[0];
  const bike = emptyBikeState();
  bike.x = ramp.center.x;
  bike.z = ramp.center.z;
  bike.y = gy;
  // Cross the ramp grounded with no input → it should launch us upward.
  stepBike(bike, 0, SIM_DT, spec, track);
  assert.ok(bike.vy > 0, `ramp should launch upward, vy=${bike.vy}`);
  let peak = bike.y;
  for (let i = 0; i < 200; i++) {
    stepBike(bike, 0, SIM_DT, spec, track);
    if (bike.y > peak) peak = bike.y;
    if (bike.y <= gy && i > 2) break;
  }
  assert.ok(peak - gy > 1.5, `ramp air should be substantial, peak=${peak - gy}`);
});
