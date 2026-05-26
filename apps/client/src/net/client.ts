import { ROOM_NAMES, type RaceState, type TrackId, type VehicleId } from '@paws/shared';
import { Client, type Room } from 'colyseus.js';
import { config } from '../config.ts';
import { generateCode } from './codes.ts';

let client: Client | null = null;

function getClient(): Client {
  if (!client) client = new Client(config.serverUrl);
  return client;
}

export interface JoinOptions {
  name: string;
  vehicle: VehicleId;
}

/**
 * Quick race: join any open public room or create a new one. Public rooms
 * carry an empty `code` so filterBy(['code']) distinguishes them from private
 * rooms (which have a non-empty code).
 */
export async function quickRace(options: JoinOptions): Promise<Room<RaceState>> {
  return getClient().joinOrCreate<RaceState>(ROOM_NAMES.RACE, { ...options, code: '' });
}

/**
 * Create a new private room with a client-generated 5-letter code. Generating
 * client-side is necessary because Colyseus' filterBy matches against the
 * original create options — a server-side code wouldn't be in those options.
 */
export async function createRoom(
  options: JoinOptions & { trackId?: TrackId; laps?: number; bots?: number },
): Promise<Room<RaceState>> {
  const code = generateCode();
  return getClient().create<RaceState>(ROOM_NAMES.RACE, { ...options, code });
}

/** Join an existing private room by 5-letter code. Fails if not found. */
export async function joinByCode(
  options: JoinOptions & { code: string },
): Promise<Room<RaceState>> {
  return getClient().join<RaceState>(ROOM_NAMES.RACE, options);
}
