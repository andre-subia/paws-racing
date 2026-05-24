import { ArraySchema, MapSchema, Schema, type } from '@colyseus/schema';

export type RacePhase = 'waiting' | 'countdown' | 'racing' | 'finished';

export class Vec3Schema extends Schema {
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 0;
}

export class QuatSchema extends Schema {
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 0;
  @type('number') w = 1;
}

export class PlayerState extends Schema {
  @type('string') id = '';
  @type('string') name = '';
  @type('string') vehicle = 'scout';
  @type('boolean') ready = false;
  @type('boolean') host = false;
  @type('boolean') connected = true;

  // Network/sim
  @type('number') lastSeq = 0;
  @type(Vec3Schema) position = new Vec3Schema();
  @type(QuatSchema) rotation = new QuatSchema();
  @type(Vec3Schema) velocity = new Vec3Schema();
  @type('number') speed = 0;
  @type('boolean') drifting = false;
  @type('number') driftCharge = 0;

  // Race progress
  @type('number') lap = 0;
  @type('number') checkpoint = -1;
  @type('number') finishedAt = 0;
  @type('number') position_rank = 0;

  // Boost state (set by server when a boost pad triggers)
  @type('number') boostUntil = 0;
  @type('number') boostSpeed = 0;
}

export class RaceState extends Schema {
  @type('string') phase: RacePhase = 'waiting';
  @type('string') trackId = 'neo_kibble_city';
  @type('string') code = '';
  @type('string') hostId = '';
  @type('number') countdownEndsAt = 0;
  @type('number') tick = 0;
  @type('number') serverTime = 0;
  @type('number') laps = 5;
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type(['string']) finishOrder = new ArraySchema<string>();
}
