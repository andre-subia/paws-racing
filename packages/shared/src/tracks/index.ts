import type { TrackDef } from '../track.js';
import { neoKibbleCity } from './neo_kibble_city.js';

export const TRACKS: Record<string, TrackDef> = {
  [neoKibbleCity.id]: neoKibbleCity,
};

export function getTrack(id: string): TrackDef {
  return TRACKS[id] ?? neoKibbleCity;
}

export { neoKibbleCity };
