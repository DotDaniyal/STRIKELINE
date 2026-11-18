import type { MapDefinition } from '../types/game.ts';
import { box, ramp, teamSpawns } from './helpers.ts';

export const BASTION_MAP: MapDefinition = {
  id: 'bastion',
  name: 'Bastion Yard',
  subtitle: 'Military Shoot-House',
  environment: 'military',
  description:
    'Tactical live-fire compound featuring modular shoot-house walls, flanking watchtowers, and crisp sightline discipline.',
  previewImage: '/src/assets/images/hero_armory_backdrop_1794933859969.jpg',
  recommendedModes: ['tdm', 'ctf', '2v2', 'domination'],
  bounds: { minX: -30, maxX: 30, minZ: -36, maxZ: 36 },
  lighting: {
    skyTop: '#2b4764',
    skyHorizon: '#8ca5bd',
    fogColor: '#7b92a8',
    fogDensity: 0.009,
    sunColor: '#fef3c7',
    sunIntensity: 2.1,
    sunPosition: { x: -24, y: 45, z: 28 },
    hemiSky: '#93c5fd',
    hemiGround: '#475569',
    hemiIntensity: 0.85,
  },
  floorMaterial: 'concrete',
  colliders: [
    box('w_n', 0, 0, -36, 60, 7, 2, 'concrete', '#475569'),
    box('w_s', 0, 0, 36, 60, 7, 2, 'concrete', '#475569'),
    box('w_w', -30, 0, 0, 2, 7, 72, 'concrete', '#475569'),
    box('w_e', 30, 0, 0, 2, 7, 72, 'concrete', '#475569'),
    // Shoot-house central compound
    box('sh_nw', -7, 0, -6, 6, 3.0, 1.2, 'wood', '#786246'),
    box('sh_ne', 7, 0, -6, 6, 3.0, 1.2, 'wood', '#786246'),
    box('sh_sw', -7, 0, 6, 6, 3.0, 1.2, 'wood', '#786246'),
    box('sh_se', 7, 0, 6, 6, 3.0, 1.2, 'wood', '#786246'),
    box('sh_mid', 0, 0, 0, 2.6, 2.2, 2.6, 'hazard', '#d97706'),
    // Watchtower decks
    box('tw_w', -21, 3.2, 0, 7, 0.4, 14, 'metal', '#334155'),
    box('tw_e', 21, 3.2, 0, 7, 0.4, 14, 'metal', '#334155'),
    // Spawn defense bunkers
    box('def_a', 0, 0, -24, 12, 1.8, 1.6, 'concrete', '#64748b'),
    box('def_b', 0, 0, 24, 12, 1.8, 1.6, 'concrete', '#64748b'),
  ],
  ramps: [
    ramp('r_twn', -21, -10.5, 4, 7, 0, 3.4, 'south', 'metal'),
    ramp('r_te', 21, 10.5, 4, 7, 0, 3.4, 'north', 'metal'),
  ],
  spawns: teamSpawns(-30, 30),
  hardpoints: [
    { id: 'hp_1', label: 'Shoot-House Core', x: 0, y: 0, z: 0, radius: 5.0 },
    { id: 'hp_2', label: 'West Watchtower', x: -21, y: 3.6, z: 0, radius: 4.5 },
    { id: 'hp_3', label: 'East Watchtower', x: 21, y: 3.6, z: 0, radius: 4.5 },
  ],
  dominationPoints: [
    { id: 'dom_a', label: 'A', x: 0, y: 0, z: -20, radius: 4.5 },
    { id: 'dom_b', label: 'B', x: 0, y: 0, z: 0, radius: 4.8 },
    { id: 'dom_c', label: 'C', x: 0, y: 0, z: 20, radius: 4.5 },
  ],
  ctfBases: { alpha: { x: 0, y: 0, z: -29 }, bravo: { x: 0, y: 0, z: 29 } },
};
