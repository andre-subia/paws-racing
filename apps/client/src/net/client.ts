import { ROOM_NAMES, type RaceState, type VehicleId } from '@paws/shared';
import { Client, type Room } from 'colyseus.js';
import { config } from '../config.ts';

let client: Client | null = null;

function getClient(): Client {
  if (!client) client = new Client(config.serverUrl);
  return client;
}

export interface JoinOptions {
  name: string;
  vehicle: VehicleId;
}

export async function joinRace(options: JoinOptions): Promise<Room<RaceState>> {
  const c = getClient();
  return c.joinOrCreate<RaceState>(ROOM_NAMES.RACE, options);
}
