export const SIM_HZ = 30;
export const SIM_DT = 1 / SIM_HZ;
// Match broadcast to the sim rate so clients receive every simulated frame
// (no 50ms aliasing gap). With 8 racers this is ~50KB/s extra per client —
// trivial on LAN and worth the buttery-smooth remote motion.
export const BROADCAST_HZ = 30;
export const BROADCAST_DT = 1 / BROADCAST_HZ;

export const MAX_PLAYERS_PER_ROOM = 8;
export const LAPS_DEFAULT = 5;
export const LAPS_MIN = 1;
export const LAPS_MAX = 9;
/** Legacy alias — read `state.laps` for the live value. */
export const LAPS_PER_RACE = LAPS_DEFAULT;
export const COUNTDOWN_MS = 3000;
export const RECONNECT_GRACE_S = 20;

export const ROOM_NAMES = {
  LOBBY: 'lobby',
  RACE: 'race',
} as const;

export type RoomName = (typeof ROOM_NAMES)[keyof typeof ROOM_NAMES];

export type VehicleId = 'scout' | 'bruiser' | 'drifter' | 'inferno';

export interface VehicleSpec {
  id: VehicleId;
  label: string;
  accel: number;
  topSpeed: number;
  turnRate: number;
  driftGrip: number;
  /** Public path under apps/client/public for the body sprite. */
  spritePath: string;
}

export const VEHICLES: Record<VehicleId, VehicleSpec> = {
  scout: {
    id: 'scout',
    label: 'Scout',
    accel: 22,
    topSpeed: 48,
    turnRate: 2.6,
    driftGrip: 0.55,
    spritePath: '/assets/cats/cat1.png',
  },
  bruiser: {
    id: 'bruiser',
    label: 'Bruiser',
    accel: 14,
    topSpeed: 58,
    turnRate: 2.0,
    driftGrip: 0.45,
    spritePath: '/assets/cats/cat2.png',
  },
  drifter: {
    id: 'drifter',
    label: 'Drifter',
    accel: 19,
    topSpeed: 52,
    turnRate: 3.0,
    driftGrip: 0.65,
    spritePath: '/assets/cats/cat3.png',
  },
  inferno: {
    id: 'inferno',
    label: 'Inferno',
    accel: 26,
    topSpeed: 50,
    turnRate: 2.4,
    driftGrip: 0.5,
    spritePath: '/assets/cats/cat4.png',
  },
};

export const TRACK_IDS = [
  'neo_kibble_city',
  'catnip_speedway',
  'alleycat_sprawl',
  'litter_box_loop',
  'whisker_heights',
  'catnip_canyon',
  'tomcat_skyway',
] as const;
export type TrackId = (typeof TRACK_IDS)[number];
