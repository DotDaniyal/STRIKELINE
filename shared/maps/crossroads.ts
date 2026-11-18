import type { MapDefinition } from '../types/game.ts';
import { box, ramp, teamSpawns } from './helpers.ts';

export const CROSSROADS_MAP: MapDefinition = {
  id: 'crossroads',
  name: 'Crossroads',
  subtitle: 'Urban Civic Plaza',
  environment: 'urban',
  description:
    'Modern urban courtyard flanked by two-story concrete complexes, an elevated skybridge, and dense street-level cover.',
  previewImage: '/src/assets/images/map_crossroads_1794933858662.jpg',
  recommendedModes: ['hardpoint', 'domination', 'ctf', 'tdm'],
  bounds: { minX: -34, maxX: 34, minZ: -38, maxZ: 38 },
  lighting: {
    skyTop: '#5b7694',
    skyHorizon: '#b9c6d4',
    fogColor: '#9fb0c2',
    fogDensity: 0.008,
    sunColor: '#fff5e0',
    sunIntensity: 2.0,
    sunPosition: { x: -30, y: 48, z: 22 },
    hemiSky: '#b7d0ea',
    hemiGround: '#4a4e57',
    hemiIntensity: 0.9,
  },
  floorMaterial: 'asphalt',
  colliders: [
    box('w_n', 0, 0, -38, 68, 7, 2, 'concrete', '#58606d'),
    box('w_s', 0, 0, 38, 68, 7, 2, 'concrete', '#58606d'),
    box('w_w', -34, 0, 0, 2, 7, 76, 'concrete', '#58606d'),
    box('w_e', 34, 0, 0, 2, 7, 76, 'concrete', '#58606d'),
    // West 2-story building deck & walls
    box('bld_w_deck', -20, 3.2, 0, 12, 0.4, 24, 'concrete', '#646d7a'),
    box('bld_w_col1', -15, 0, -10, 1.5, 3.2, 1.5, 'concrete', '#49505b'),
    box('bld_w_col2', -15, 0, 10, 1.5, 3.2, 1.5, 'concrete', '#49505b'),
    box('bld_w_parapet', -14.3, 3.4, 0, 0.6, 1.1, 20, 'concrete', '#565e69'),
    // East 2-story building deck & walls
    box('bld_e_deck', 20, 3.2, 0, 12, 0.4, 24, 'concrete', '#646d7a'),
    box('bld_e_col1', 15, 0, -10, 1.5, 3.2, 1.5, 'concrete', '#49505b'),
    box('bld_e_col2', 15, 0, 10, 1.5, 3.2, 1.5, 'concrete', '#49505b'),
    box('bld_e_parapet', 14.3, 3.4, 0, 0.6, 1.1, 20, 'concrete', '#565e69'),
    // Elevated Skybridge connecting East & West
    box('skybridge', 0, 3.2, 0, 28, 0.4, 4.2, 'metal', '#475569'),
    box('sky_rail_n', 0, 3.6, -1.9, 26, 0.9, 0.3, 'glass', '#7dd3fc'),
    box('sky_rail_s', 0, 3.6, 1.9, 26, 0.9, 0.3, 'glass', '#7dd3fc'),
    // Central plaza fountain/planter cover
    box('plaza_mid', 0, 0, 0, 5.5, 1.4, 5.5, 'concrete', '#6c7582'),
    box('plaza_n', -5, 0, -14, 3.5, 1.8, 2.2, 'crate', '#4d6b53'),
    box('plaza_s', 5, 0, 14, 3.5, 1.8, 2.2, 'crate', '#4d6b53'),
    box('bar_nw', -8, 0, -24, 7, 1.5, 1.4, 'concrete', '#5c6470'),
    box('bar_se', 8, 0, 24, 7, 1.5, 1.4, 'concrete', '#5c6470'),
    box('kiosk_n', 7, 0, -17, 3.5, 2.8, 3.5, 'metal', '#334155'),
    box('kiosk_s', -7, 0, 17, 3.5, 2.8, 3.5, 'metal', '#334155'),
    box('dest_c1', -4, 0, -5, 1.5, 1.5, 1.5, 'wood', '#8f6b43', { destructible: true, maxHp: 85 }),
    box('dest_c2', 4, 0, 5, 1.5, 1.5, 1.5, 'wood', '#8f6b43', { destructible: true, maxHp: 85 }),
  ],
  ramps: [
    ramp('r_wn', -20, -16, 4.2, 8, 0, 3.4, 'south', 'concrete'),
    ramp('r_ws', -20, 16, 4.2, 8, 0, 3.4, 'north', 'concrete'),
    ramp('r_en', 20, -16, 4.2, 8, 0, 3.4, 'south', 'concrete'),
    ramp('r_es', 20, 16, 4.2, 8, 0, 3.4, 'north', 'concrete'),
  ],
  spawns: teamSpawns(-32, 32),
  hardpoints: [
    { id: 'hp_1', label: 'Central Plaza', x: 0, y: 0, z: 0, radius: 5.5 },
    { id: 'hp_2', label: 'Skybridge', x: 0, y: 3.6, z: 0, radius: 4.5 },
    { id: 'hp_3', label: 'West Terrace', x: -20, y: 3.6, z: 0, radius: 4.8 },
    { id: 'hp_4', label: 'East Terrace', x: 20, y: 3.6, z: 0, radius: 4.8 },
  ],
  dominationPoints: [
    { id: 'dom_a', label: 'A', x: 0, y: 0, z: -22, radius: 4.5 },
    { id: 'dom_b', label: 'B', x: 0, y: 3.6, z: 0, radius: 4.2 },
    { id: 'dom_c', label: 'C', x: 0, y: 0, z: 22, radius: 4.5 },
  ],
  ctfBases: { alpha: { x: 0, y: 0, z: -31 }, bravo: { x: 0, y: 0, z: 31 } },
};
