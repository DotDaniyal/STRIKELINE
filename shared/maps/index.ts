import type { MapDefinition, MapId } from '../types/game.ts';
import { APEX_ARENA_MAP } from './apexArena.ts';
import { BASTION_MAP } from './bastion.ts';
import { CROSSROADS_MAP } from './crossroads.ts';
import { DEPOT_MAP } from './depot.ts';
import { DUSTBASIN_MAP } from './dustbasin.ts';
import { FOUNDRY_MAP } from './foundry.ts';
import { TRAINING_RANGE_MAP } from './trainingRange.ts';

export {
  FOUNDRY_MAP,
  CROSSROADS_MAP,
  DUSTBASIN_MAP,
  DEPOT_MAP,
  BASTION_MAP,
  APEX_ARENA_MAP,
  TRAINING_RANGE_MAP,
};

export const MAPS: Record<MapId, MapDefinition> = {
  foundry: FOUNDRY_MAP,
  crossroads: CROSSROADS_MAP,
  dustbasin: DUSTBASIN_MAP,
  depot: DEPOT_MAP,
  bastion: BASTION_MAP,
  apex_arena: APEX_ARENA_MAP,
  training_range: TRAINING_RANGE_MAP,
};

export const MULTIPLAYER_MAPS: MapDefinition[] = Object.values(MAPS).filter(
  (m) => m.id !== 'training_range'
);
