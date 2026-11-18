import type { MapDefinition } from '../types/game.ts';
import { box, ramp, teamSpawns } from './helpers.ts';

export const FOUNDRY_MAP: MapDefinition = {
  id: 'foundry',
  name: 'Foundry',
  subtitle: 'Heavy Steel Mill',
  environment: 'industrial',
  description:
    'Multi-level industrial steel foundry featuring central blast pillars, elevated steel catwalks, and shipping container flanks.',
  previewImage: '/src/assets/images/map_foundry_1794933858323.jpg',
  recommendedModes: ['tdm', 'hardpoint', 'domination', 'kill_confirmed'],
  bounds: { minX: -32, maxX: 32, minZ: -38, maxZ: 38 },
  lighting: {
    skyTop: '#1d2633',
    skyHorizon: '#43342c',
    fogColor: '#362d2a',
    fogDensity: 0.011,
    sunColor: '#ffbe7b',
    sunIntensity: 2.2,
    sunPosition: { x: 28, y: 42, z: 18 },
    hemiSky: '#7c93b0',
    hemiGround: '#3b2b22',
    hemiIntensity: 0.85,
  },
  floorMaterial: 'concrete',
  colliders: [
    // Perimeter foundry walls
    box('w_n', 0, 0, -38, 64, 10, 2, 'metal', '#29303b'),
    box('w_s', 0, 0, 38, 64, 10, 2, 'metal', '#29303b'),
    box('w_w', -32, 0, 0, 2, 10, 76, 'metal', '#29303b'),
    box('w_e', 32, 0, 0, 2, 10, 76, 'metal', '#29303b'),
    // Central furnace structure + pillars
    box('c_furnace', 0, 0, 0, 6, 4.2, 6, 'metal', '#3a2c24'),
    box('p_nw', -9, 0, -10, 2.4, 8, 2.4, 'concrete', '#49505a'),
    box('p_ne', 9, 0, -10, 2.4, 8, 2.4, 'concrete', '#49505a'),
    box('p_sw', -9, 0, 10, 2.4, 8, 2.4, 'concrete', '#49505a'),
    box('p_se', 9, 0, 10, 2.4, 8, 2.4, 'concrete', '#49505a'),
    // Elevated catwalks (West and East)
    box('cat_w', -22, 3.0, 0, 6, 0.4, 34, 'metal', '#3c4654'),
    box('cat_e', 22, 3.0, 0, 6, 0.4, 34, 'metal', '#3c4654'),
    // Cross catwalk bridge on North & South
    box('cat_n_bridge', 0, 3.0, -16, 38, 0.4, 3.5, 'metal', '#3c4654'),
    // Shipping containers for tactical cover
    box('cont_1', -12, 0, -21, 7, 3.0, 3.2, 'crate', '#b45309'),
    box('cont_2', 12, 0, 21, 7, 3.0, 3.2, 'crate', '#1d4ed8'),
    box('cont_3', -13, 0, 18, 3.2, 3.0, 7, 'crate', '#374151'),
    box('cont_4', 13, 0, -18, 3.2, 3.0, 7, 'crate', '#9a3412'),
    // Mid low cover barriers & destructible crates
    box('bar_a', 0, 0, -26, 10, 1.5, 1.4, 'concrete', '#525b68'),
    box('bar_b', 0, 0, 26, 10, 1.5, 1.4, 'concrete', '#525b68'),
    box('dest_1', -5, 0, 0, 1.6, 1.6, 1.6, 'wood', '#926c44', { destructible: true, maxHp: 90 }),
    box('dest_2', 5, 0, 0, 1.6, 1.6, 1.6, 'wood', '#926c44', { destructible: true, maxHp: 90 }),
    box('dest_3', 0, 0, -11, 1.8, 1.5, 1.8, 'wood', '#926c44', { destructible: true, maxHp: 90 }),
    box('dest_4', 0, 0, 11, 1.8, 1.5, 1.8, 'wood', '#926c44', { destructible: true, maxHp: 90 }),
  ],
  ramps: [
    ramp('r_wn', -22, -21, 4.5, 8, 0, 3.2, 'south', 'metal'),
    ramp('r_ws', -22, 21, 4.5, 8, 0, 3.2, 'north', 'metal'),
    ramp('r_en', 22, -21, 4.5, 8, 0, 3.2, 'south', 'metal'),
    ramp('r_es', 22, 21, 4.5, 8, 0, 3.2, 'north', 'metal'),
  ],
  spawns: teamSpawns(-32, 32),
  hardpoints: [
    { id: 'hp_1', label: 'Center Furnace', x: 0, y: 0, z: 0, radius: 5.5 },
    { id: 'hp_2', label: 'West Catwalk', x: -22, y: 3.4, z: 0, radius: 4.5 },
    { id: 'hp_3', label: 'East Bay', x: 22, y: 3.4, z: 0, radius: 4.5 },
    { id: 'hp_4', label: 'North Bridge', x: 0, y: 3.4, z: -16, radius: 4.5 },
  ],
  dominationPoints: [
    { id: 'dom_a', label: 'A', x: 0, y: 0, z: -22, radius: 4.5 },
    { id: 'dom_b', label: 'B', x: 0, y: 0, z: 0, radius: 5.2 },
    { id: 'dom_c', label: 'C', x: 0, y: 0, z: 22, radius: 4.5 },
  ],
  ctfBases: { alpha: { x: 0, y: 0, z: -31 }, bravo: { x: 0, y: 0, z: 31 } },
};
