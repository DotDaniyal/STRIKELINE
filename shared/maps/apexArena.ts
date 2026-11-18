import type { MapDefinition } from '../types/game.ts';
import { box, ramp, teamSpawns } from './helpers.ts';

export const APEX_ARENA_MAP: MapDefinition = {
  id: 'apex_arena',
  name: 'Apex Arena',
  subtitle: 'Symmetrical Esports Proving Ground',
  environment: 'arena',
  description:
    'Pure symmetrical 3-lane competitive esports arena designed for 2v2 duels, crisp head-glitches, and zero visual clutter.',
  previewImage: '/src/assets/images/map_crossroads_1794933858662.jpg',
  recommendedModes: ['2v2', 'ffa', 'tdm', 'ctf'],
  bounds: { minX: -24, maxX: 24, minZ: -28, maxZ: 28 },
  lighting: {
    skyTop: '#0d1522',
    skyHorizon: '#233247',
    fogColor: '#1b2738',
    fogDensity: 0.009,
    sunColor: '#e2e8f0',
    sunIntensity: 2.0,
    sunPosition: { x: 20, y: 40, z: 12 },
    hemiSky: '#94a3b8',
    hemiGround: '#1e293b',
    hemiIntensity: 0.95,
  },
  floorMaterial: 'hazard',
  colliders: [
    box('w_n', 0, 0, -28, 48, 6, 2, 'metal', '#1e293b'),
    box('w_s', 0, 0, 28, 48, 6, 2, 'metal', '#1e293b'),
    box('w_w', -24, 0, 0, 2, 6, 56, 'metal', '#1e293b'),
    box('w_e', 24, 0, 0, 2, 6, 56, 'metal', '#1e293b'),
    // Symmetrical competitive cover blocks
    box('mid_plat', 0, 1.4, 0, 8, 1.4, 8, 'concrete', '#334155'),
    box('blk_nw', -10, 0, -10, 4, 2.8, 4, 'metal', '#475569'),
    box('blk_ne', 10, 0, -10, 4, 2.8, 4, 'metal', '#475569'),
    box('blk_sw', -10, 0, 10, 4, 2.8, 4, 'metal', '#475569'),
    box('blk_se', 10, 0, 10, 4, 2.8, 4, 'metal', '#475569'),
    box('head_n', 0, 0, -14, 7, 1.25, 1.2, 'hazard', '#f59e0b'),
    box('head_s', 0, 0, 14, 7, 1.25, 1.2, 'hazard', '#06b6d4'),
  ],
  ramps: [
    ramp('r_mn', 0, -6.5, 4, 5, 0, 1.6, 'south', 'metal'),
    ramp('r_ms', 0, 6.5, 4, 5, 0, 1.6, 'north', 'metal'),
  ],
  spawns: teamSpawns(-22, 22),
  hardpoints: [
    { id: 'hp_1', label: 'Center Platform', x: 0, y: 1.6, z: 0, radius: 5.0 },
    { id: 'hp_2', label: 'West Lane', x: -16, y: 0, z: 0, radius: 4.5 },
    { id: 'hp_3', label: 'East Lane', x: 16, y: 0, z: 0, radius: 4.5 },
  ],
  dominationPoints: [
    { id: 'dom_a', label: 'A', x: 0, y: 0, z: -18, radius: 4.0 },
    { id: 'dom_b', label: 'B', x: 0, y: 1.6, z: 0, radius: 4.5 },
    { id: 'dom_c', label: 'C', x: 0, y: 0, z: 18, radius: 4.0 },
  ],
  ctfBases: { alpha: { x: 0, y: 0, z: -22 }, bravo: { x: 0, y: 0, z: 22 } },
};
