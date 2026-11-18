import type { MapDefinition } from '../types/game.ts';
import { box, ramp, teamSpawns } from './helpers.ts';

export const DUSTBASIN_MAP: MapDefinition = {
  id: 'dustbasin',
  name: 'Dustbasin',
  subtitle: 'Arid Canyon Outpost',
  environment: 'desert',
  description:
    'Sun-drenched sandstone canyon outpost built around a central communications bunker with long sniper lanes and ridge flanks.',
  previewImage: '/src/assets/images/map_dustbasin_1794933858710.jpg',
  recommendedModes: ['ffa', 'tdm', 'kill_confirmed', '2v2'],
  bounds: { minX: -36, maxX: 36, minZ: -40, maxZ: 40 },
  lighting: {
    skyTop: '#2c6eb5',
    skyHorizon: '#ebd1a7',
    fogColor: '#dcc098',
    fogDensity: 0.0085,
    sunColor: '#ffe0a3',
    sunIntensity: 2.5,
    sunPosition: { x: 38, y: 50, z: -20 },
    hemiSky: '#9ec9f2',
    hemiGround: '#8b6a44',
    hemiIntensity: 0.95,
  },
  floorMaterial: 'sand',
  colliders: [
    // Canyon rock walls
    box('rock_n', 0, 0, -40, 72, 9, 3, 'sand', '#a87d52'),
    box('rock_s', 0, 0, 40, 72, 9, 3, 'sand', '#a87d52'),
    box('rock_w', -36, 0, 0, 3, 9, 80, 'sand', '#a87d52'),
    box('rock_e', 36, 0, 0, 3, 9, 80, 'sand', '#a87d52'),
    // Central communications bunker (roof accessible via ramps)
    box('bunker_roof', 0, 3.0, 0, 12, 0.5, 12, 'concrete', '#928876'),
    box('bunker_w1', -5.5, 0, -3.5, 1.2, 3.0, 4.5, 'concrete', '#7c7364'),
    box('bunker_w2', 5.5, 0, 3.5, 1.2, 3.0, 4.5, 'concrete', '#7c7364'),
    box('bunker_w3', -3.5, 0, 5.5, 4.5, 3.0, 1.2, 'concrete', '#7c7364'),
    box('bunker_w4', 3.5, 0, -5.5, 4.5, 3.0, 1.2, 'concrete', '#7c7364'),
    // Sandstone monoliths & ruins
    box('mono_w1', -18, 0, -10, 5, 4.5, 5, 'sand', '#b5895a'),
    box('mono_w2', -18, 0, 10, 5, 4.5, 5, 'sand', '#b5895a'),
    box('mono_e1', 18, 0, -10, 5, 4.5, 5, 'sand', '#b5895a'),
    box('mono_e2', 18, 0, 10, 5, 4.5, 5, 'sand', '#b5895a'),
    // Sniper watch platforms
    box('ridge_w', -27, 2.8, 0, 7, 0.4, 18, 'sand', '#9c7349'),
    box('ridge_e', 27, 2.8, 0, 7, 0.4, 18, 'sand', '#9c7349'),
    // Low desert walls & crates
    box('wall_na', -10, 0, -24, 8, 1.6, 1.4, 'sand', '#b5895a'),
    box('wall_nb', 10, 0, -24, 8, 1.6, 1.4, 'sand', '#b5895a'),
    box('wall_sa', -10, 0, 24, 8, 1.6, 1.4, 'sand', '#b5895a'),
    box('wall_sb', 10, 0, 24, 8, 1.6, 1.4, 'sand', '#b5895a'),
    box('dest_d1', 0, 0, -15, 2, 1.6, 2, 'crate', '#7a6345', { destructible: true, maxHp: 90 }),
    box('dest_d2', 0, 0, 15, 2, 1.6, 2, 'crate', '#7a6345', { destructible: true, maxHp: 90 }),
  ],
  ramps: [
    ramp('r_bunk_n', 0, -9.5, 4.0, 7, 0, 3.2, 'south', 'concrete'),
    ramp('r_bunk_s', 0, 9.5, 4.0, 7, 0, 3.2, 'north', 'concrete'),
    ramp('r_rw', -27, -12.5, 4.5, 7, 0, 3.0, 'south', 'sand'),
    ramp('r_re', 27, 12.5, 4.5, 7, 0, 3.0, 'north', 'sand'),
  ],
  spawns: teamSpawns(-33, 33),
  hardpoints: [
    { id: 'hp_1', label: 'Comms Bunker', x: 0, y: 0, z: 0, radius: 5.2 },
    { id: 'hp_2', label: 'Bunker Roof', x: 0, y: 3.5, z: 0, radius: 5.0 },
    { id: 'hp_3', label: 'West Ridge', x: -27, y: 3.2, z: 0, radius: 4.5 },
    { id: 'hp_4', label: 'East Ridge', x: 27, y: 3.2, z: 0, radius: 4.5 },
  ],
  dominationPoints: [
    { id: 'dom_a', label: 'A', x: 0, y: 0, z: -23, radius: 4.5 },
    { id: 'dom_b', label: 'B', x: 0, y: 3.5, z: 0, radius: 4.5 },
    { id: 'dom_c', label: 'C', x: 0, y: 0, z: 23, radius: 4.5 },
  ],
  ctfBases: { alpha: { x: 0, y: 0, z: -33 }, bravo: { x: 0, y: 0, z: 33 } },
};
