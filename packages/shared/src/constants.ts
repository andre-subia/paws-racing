export const SIM_HZ = 30;
export const SIM_DT = 1 / SIM_HZ;
export const BROADCAST_HZ = 20;
export const BROADCAST_DT = 1 / BROADCAST_HZ;

export const MAX_PLAYERS_PER_ROOM = 8;
export const LAPS_PER_RACE = 3;
export const COUNTDOWN_MS = 3000;
export const RECONNECT_GRACE_S = 20;

export const ROOM_NAMES = {
  LOBBY: 'lobby',
  RACE: 'race',
} as const;

export type RoomName = (typeof ROOM_NAMES)[keyof typeof ROOM_NAMES];

export type VehicleId = 'scout' | 'bruiser';

export interface VehicleSpec {
  id: VehicleId;
  label: string;
  accel: number;
  topSpeed: number;
  turnRate: number;
  driftGrip: number;
}

export const VEHICLES: Record<VehicleId, VehicleSpec> = {
  scout: {
    id: 'scout',
    label: 'Scout',
    accel: 22,
    topSpeed: 48,
    turnRate: 2.6,
    driftGrip: 0.55,
  },
  bruiser: {
    id: 'bruiser',
    label: 'Bruiser',
    accel: 14,
    topSpeed: 58,
    turnRate: 2.0,
    driftGrip: 0.45,
  },
};

export const TRACK_IDS = ['neo_kibble_city'] as const;
export type TrackId = (typeof TRACK_IDS)[number];
