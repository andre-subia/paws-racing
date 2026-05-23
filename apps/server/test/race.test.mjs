// Unit tests for the race sim helpers — checkpoint progression, lap counting,
// boost pad triggers, and bike collision. Built JS only (run after build).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  advanceCheckpoint,
  resolveBikeCollisions,
  tickBoostPads,
} from '../dist/sim/race.js';
import { neoKibbleCity } from '@paws/shared';

const LAPS = 3;

/** Build a minimal stand-in for the Colyseus PlayerState. */
function fakePlayer() {
  return {
    id: 'p1',
    lap: 0,
    checkpoint: -1,
    finishedAt: 0,
    position_rank: 0,
  };
}

/** A bike that we can teleport to specific positions for testing. */
function fakeBike(x = 0, z = 0) {
  return { x, y: 0.5, z, yaw: 0, vx: 0, vz: 0, speed: 0, drifting: false };
}

/**
 * Walk the player through every checkpoint of the track in order, advancing
 * the bike slightly past each gate so the signed-distance crosses 0.
 */
function lapOnce(track, player, bike, mem, serverTime) {
  // Skip the START checkpoint id (0) because the player starts before it;
  // the first crossing of id 0 starts lap 1. Walk through all in order.
  for (let i = 0; i < track.checkpoints.length; i++) {
    const cp = track.checkpoints[i];
    // Step 1: place bike slightly BEFORE the gate (behind in travel direction).
    const fwdX = -Math.sin(cp.yaw);
    const fwdZ = -Math.cos(cp.yaw);
    bike.x = cp.center.x - fwdX * 0.5;
    bike.z = cp.center.z - fwdZ * 0.5;
    advanceCheckpoint(track, player, bike, mem, LAPS, serverTime);
    // Step 2: place bike slightly AFTER the gate (in front along travel).
    bike.x = cp.center.x + fwdX * 0.5;
    bike.z = cp.center.z + fwdZ * 0.5;
    const r = advanceCheckpoint(track, player, bike, mem, LAPS, serverTime);
    if (r.finished) return r;
  }
  return { crossed: false, finished: false };
}

test('checkpoint advances in order through one lap', () => {
  const player = fakePlayer();
  const bike = fakeBike();
  const mem = { lastSignedDist: -1 };
  lapOnce(neoKibbleCity, player, bike, mem, 1000);
  assert.equal(player.lap, 1);
  // After completing the loop we cross id 0 again — but we only did ONE pass,
  // so checkpoint should be N-1 here.
  assert.equal(player.checkpoint, neoKibbleCity.checkpoints.length - 1);
});

test('three full laps finish the race', () => {
  const player = fakePlayer();
  const bike = fakeBike();
  const mem = { lastSignedDist: -1 };
  // Convention: a "3 lap" race takes 4 start-line crossings —
  //   cross 1: lap=1 (race begins)
  //   cross 2: lap=2 (lap 1 done)
  //   cross 3: lap=3 (lap 2 done)
  //   cross 4: FINISH (lap 3 done)
  // Each lapOnce makes exactly one circuit (one crossing of id 0 plus the
  // other gates), so we need four iterations.
  for (let i = 0; i < 4; i++) {
    lapOnce(neoKibbleCity, player, bike, mem, 1000 + i * 1000);
    if (player.finishedAt > 0) break;
  }
  assert.ok(player.finishedAt > 0, `expected finishedAt > 0, got ${player.finishedAt}`);
});

test('lateral miss does not count as a checkpoint cross', () => {
  const player = fakePlayer();
  const bike = fakeBike();
  const mem = { lastSignedDist: -1 };
  const cp = neoKibbleCity.checkpoints[0];
  const sideX = -Math.cos(cp.yaw);
  const sideZ = Math.sin(cp.yaw);
  const fwdX = -Math.sin(cp.yaw);
  const fwdZ = -Math.cos(cp.yaw);
  // Way off to the side, then walk forward across the gate plane.
  bike.x = cp.center.x + sideX * (cp.width + 10) - fwdX * 0.5;
  bike.z = cp.center.z + sideZ * (cp.width + 10) - fwdZ * 0.5;
  advanceCheckpoint(neoKibbleCity, player, bike, mem, LAPS, 1000);
  bike.x = cp.center.x + sideX * (cp.width + 10) + fwdX * 0.5;
  bike.z = cp.center.z + sideZ * (cp.width + 10) + fwdZ * 0.5;
  advanceCheckpoint(neoKibbleCity, player, bike, mem, LAPS, 1000);
  assert.equal(player.lap, 0);
  assert.equal(player.checkpoint, -1);
});

test('boost pad triggers at most once before cooldown', () => {
  const bike = fakeBike();
  const pad = neoKibbleCity.boostPads[0];
  bike.x = pad.center.x;
  bike.z = pad.center.z;
  const cooldowns = new Map();
  const first = tickBoostPads(neoKibbleCity, bike, cooldowns, 1000);
  assert.ok(first, 'first call should trigger');
  const second = tickBoostPads(neoKibbleCity, bike, cooldowns, 1500);
  assert.equal(second, null, 'still inside cooldown');
  const later = tickBoostPads(neoKibbleCity, bike, cooldowns, 1000 + pad.cooldown * 1000 + 1);
  assert.ok(later, 'after cooldown should trigger again');
});

test('overlapping bikes are pushed apart', () => {
  const bikes = new Map([
    ['a', fakeBike(0, 0)],
    ['b', fakeBike(0.5, 0)],
  ]);
  resolveBikeCollisions(['a', 'b'], bikes);
  const a = bikes.get('a');
  const b = bikes.get('b');
  const dist = Math.hypot(b.x - a.x, b.z - a.z);
  assert.ok(dist >= 1.8 - 0.001, `expected separation, got ${dist}`);
});
