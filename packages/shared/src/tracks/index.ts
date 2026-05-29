import type { TrackDef } from '../track.js';
import { alleycatSprawl } from './alleycat_sprawl.js';
import { catnipCanyon } from './catnip_canyon.js';
import { catnipSpeedway } from './catnip_speedway.js';
import { litterBoxLoop } from './litter_box_loop.js';
import { neoKibbleCity } from './neo_kibble_city.js';
import { tomcatSkyway } from './tomcat_skyway.js';
import { whiskerHeights } from './whisker_heights.js';

export const TRACKS: Record<string, TrackDef> = {
  [neoKibbleCity.id]: neoKibbleCity,
  [catnipSpeedway.id]: catnipSpeedway,
  [alleycatSprawl.id]: alleycatSprawl,
  [litterBoxLoop.id]: litterBoxLoop,
  [whiskerHeights.id]: whiskerHeights,
  [catnipCanyon.id]: catnipCanyon,
  [tomcatSkyway.id]: tomcatSkyway,
};

export function getTrack(id: string): TrackDef {
  return TRACKS[id] ?? neoKibbleCity;
}

export {
  alleycatSprawl,
  catnipCanyon,
  catnipSpeedway,
  litterBoxLoop,
  neoKibbleCity,
  tomcatSkyway,
  whiskerHeights,
};
