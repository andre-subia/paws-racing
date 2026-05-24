import type { TrackDef } from '../track.js';
import { alleycatSprawl } from './alleycat_sprawl.js';
import { catnipSpeedway } from './catnip_speedway.js';
import { litterBoxLoop } from './litter_box_loop.js';
import { neoKibbleCity } from './neo_kibble_city.js';

export const TRACKS: Record<string, TrackDef> = {
  [neoKibbleCity.id]: neoKibbleCity,
  [catnipSpeedway.id]: catnipSpeedway,
  [alleycatSprawl.id]: alleycatSprawl,
  [litterBoxLoop.id]: litterBoxLoop,
};

export function getTrack(id: string): TrackDef {
  return TRACKS[id] ?? neoKibbleCity;
}

export { alleycatSprawl, catnipSpeedway, litterBoxLoop, neoKibbleCity };
