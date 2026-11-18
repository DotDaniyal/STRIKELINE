import type { MapDefinition } from '../types/game.ts';
import { box, ramp, teamSpawns } from './helpers.ts';

export const DEPOT_MAP: MapDefinition = {
  id: 'depot',
  name: 'Cargo Depot',
  subtitle: 'Tight Container Warehouse',
  environment: 'warehouse',
  description:
    'High-tempo close-quarters cargo warehouse packed with stacked containers, tight SMG lanes, and an overhead gantry.',
  previewImage: '/src/assets/images/map_depot_1794933859246.jpg',
  recommendedModes: ['ffa', 'kill_confirmed', 'team_kill_confirmed', '2v2'],
  bounds: { minX: -26, maxX: 26, minZ: -30, maxZ: 30 },
  lighting: {
    skyTop: '#0f1722',
    skyHorizon: '#1d2d3d',
    fogColor: '#16212e',
    fogDensity: 0.015,
    sunColor: '#93c5fd',
    sunIntensity: 1.6,
    sunPosition: { x: 18, y: 36, z: 16 },
    hemiSky: '#60a5fa',
    hemiGround: '#3f2c1c',
    hemiIntensity: 0.9,
  },
  floorMaterial: 'concrete',
  colliders: [
    box('w_n', 0, 0, -30, 52, 8, 2, 'metal', '#1f2937'),
    box('w_s', 0, 0, 30, 52, 8, 2, 'metal', '#1f2937'),
    box('w_w', -26, 0, 0, 2, 8, 60, 'metal', '#1f2937'),
    box('w_e', 26, 0, 0, 2, 8, 60, 'metal', '#1f2937'),
    // Container maze
    box('c_1', -9, 0, -10, 3.4, 3.2, 8.5, 'crate', '#b91c1c'),
    box('c_2', 9, 0, -10, 3.4, 3.2, 8.5, 'crate', '#0369a1'),
    box('c_3', -9, 0, 10, 3.4, 3.2, 8.5, 'crate', '#0369a1'),
    box('c_4', 9, 0, 10, 3.4, 3.2, 8.5, 'crate', '#b91c1c'),
    box('c_mid', 0, 0, 0, 8.5, 3.2, 3.4, 'crate', '#d97706'),
    // Double stacked edge containers
    box('c_w_top', -18, 0, 0, 3.5, 6.2, 12, 'crate', '#334155'),
    box('c_e_top', 18, 0, 0, 3.5, 6.2, 12, 'crate', '#334155'),
    // Overhead steel gantry
    box('gantry_mid', 0, 3.2, 0, 32, 0.35, 3.4, 'metal', '#475569'),
    // Cover pallets
    box('pal_1', -15, 0, -18, 3, 1.5, 3, 'wood', '#855e3c'),
    box('pal_2', 15, 0, 18, 3, 1.5, 3, 'wood', '#855e3c'),
    box('dest_w1', 0, 0, -14, 1.6, 1.6, 1.6, 'wood', '#926c44', { destructible: true, maxHp: 75 }),
    box('dest_w2', 0, 0, 14, 1.6, 1.6, 1.6, 'wood', '#926c44', { destructible: true, maxHp: 75 }),
  ],
  ramps: [
    ramp('r_gw', -19, 0, 3.6, 7.5, 0, 3.4, 'east', 'metal'),
    ramp('r_ge', 19, 0, 3.6, 7.5, 0, 3.4, 'west', 'metal'),
  ],
  spawns: teamSpawns(-25, 25),
  hardpoints: [
    { id: 'hp_1', label: 'Center Stack', x: 0, y: 0, z: 0, radius: 5.5 },
    { id: 'hp_2', label: 'Gantry Overlook', x: 0, y: 3.6, z: 0, radius: 4.5 },
    { id: 'hp_3', label: 'North Bay', x: 0, y: 0, z: -18, radius: 4.8 },
    { id: 'hp_4', label: 'South Bay', x: 0, y: 0, z: 18, radius: 4.8 },
  ],
  dominationPoints: [
    { id: 'dom_a', label: 'A', x: 0, y: 0, z: -18, radius: 4.2 },
    { id: 'dom_b', label: 'B', x: 0, y: 3.6, z: 0, radius: 4.0 },
    { id: 'dom_c', label: 'C', x: 0, y: 0, z: 18, radius: 4.2 },
  ],
  ctfBases: { alpha: { x: 0, y: 0, z: -24 }, bravo: { x: 0, y: 0, z: 24 } },
};
