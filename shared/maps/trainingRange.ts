import type { MapDefinition } from '../types/game.ts';
import { box } from './helpers.ts';

export const TRAINING_RANGE_MAP: MapDefinition = {
  id: 'training_range',
  name: 'Proving Grounds',
  subtitle: 'Ballistics & Aim Lab',
  environment: 'range',
  description:
    'Dedicated weapon calibration range with distance markers (10m–50m), reactive moving targets, and flick drills.',
  previewImage: '/src/assets/images/hero_armory_backdrop_1794933859969.jpg',
  recommendedModes: ['training'],
  bounds: { minX: -20, maxX: 20, minZ: -38, maxZ: 14 },
  lighting: {
    skyTop: '#0f1621',
    skyHorizon: '#1f2b3d',
    fogColor: '#182230',
    fogDensity: 0.008,
    sunColor: '#f8fafc',
    sunIntensity: 1.9,
    sunPosition: { x: 12, y: 32, z: 18 },
    hemiSky: '#cbd5e1',
    hemiGround: '#1e293b',
    hemiIntensity: 1.0,
  },
  floorMaterial: 'concrete',
  colliders: [
    box('w_n', 0, 0, -38, 40, 8, 2, 'concrete', '#1e293b'),
    box('w_s', 0, 0, 14, 40, 8, 2, 'concrete', '#1e293b'),
    box('w_w', -20, 0, -12, 2, 8, 52, 'concrete', '#1e293b'),
    box('w_e', 20, 0, -12, 2, 8, 52, 'concrete', '#1e293b'),
    // Firing booth counter (low cover)
    box('booth_l', -6, 0, 2, 4, 1.15, 1.0, 'metal', '#334155'),
    box('booth_r', 6, 0, 2, 4, 1.15, 1.0, 'metal', '#334155'),
    // Recoil calibration wall on East side
    box('recoil_wall', 14, 0, -14, 1.2, 5, 10, 'concrete', '#cbd5e1'),
  ],
  ramps: [],
  spawns: [{ x: 0, y: 0, z: 8, yaw: 0, team: 'none' }],
  hardpoints: [],
  dominationPoints: [],
  ctfBases: { alpha: { x: 0, y: 0, z: 8 }, bravo: { x: 0, y: 0, z: -30 } },
};
