// Functional test for the AI driver: a bot started on the grid and driven by
// computeBotInput + stepBike should make real forward progress — crossing the
// start line and completing laps within a sane time budget. This catches an
// inverted steering sign (bot spins / drives backward) end-to-end.
import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceCheckpoint } from '../dist/sim/race.js';
import { computeBotInput } from '../dist/sim/bot.js';
import { SIM_DT, stepBike, VEHICLES, getTrack, TRACK_IDS } from '@paws/shared';

/** Drive a bot around `track` for `seconds` and return its lap count. */
function driveBot(track, vehicle, skill, seconds) {
  const spec = VEHICLES[vehicle];
  const spawn = track.spawnPoints[0];
  const bike = {
    x: spawn.x,
    y: track.surfaceY + 0.5,
    z: spawn.z,
    yaw: spawn.yaw,
    vx: 0,
    vz: 0,
    speed: 0,
    drifting: false,
    vy: 0,
    jumpHeld: false,
    wallImpact: 0,
  };
  const player = { id: 'bot-1', lap: 0, checkpoint: -1, finishedAt: 0, position_rank: 0 };
  const mem = { lastSignedDist: -1 };
  const ticks = Math.round(seconds / SIM_DT);
  let wallTicks = 0;
  for (let i = 0; i < ticks; i++) {
    const flags = computeBotInput(track, bike, spec, skill);
    stepBike(bike, flags, SIM_DT, spec, track);
    if (bike.wallImpact > 0.1) wallTicks++;
    advanceCheckpoint(track, player, bike, mem, 99, i * SIM_DT * 1000);
  }
  return { lap: player.lap, wallPct: wallTicks / ticks };
}

test('a bot completes multiple laps on every track without grinding walls', () => {
  for (const id of TRACK_IDS) {
    const track = getTrack(id);
    const { lap, wallPct } = driveBot(track, 'inferno', 1.0, 90);
    // ~60s/lap design pace → a competent bot clears at least 2 laps in 90s.
    assert.ok(lap >= 2, `bot should finish >=2 laps on ${id}, got ${lap}`);
    // It should hold a clean racing line, not scrape the boundary.
    assert.ok(wallPct < 0.1, `bot grinds the wall too much on ${id}: ${(wallPct * 100).toFixed(0)}%`);
  }
});
