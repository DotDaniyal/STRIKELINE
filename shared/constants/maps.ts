import type { MapBoxCollider, MapDefinition, MapId, MapRamp, SpawnPoint } from '../types/game.ts';

function box(
  id: string,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  material: MapBoxCollider['material'],
  color?: string,
  opts?: { destructible?: boolean; maxHp?: number }
): MapBoxCollider {
  return {
    id,
    min: { x: x - w / 2, y, z: z - d / 2 },
    max: { x: x + w / 2, y: y + h, z: z + d / 2 },
    material,
    color,
    destructible: opts?.destructible,
    maxHp: opts?.maxHp,
  };
}

function ramp(
  id: string,
  x: number,
  z: number,
  width: number,
  length: number,
  yStart: number,
  yEnd: number,
  direction: MapRamp['direction'],
  material: MapRamp['material'] = 'metal'
): MapRamp {
  return { id, x, z, width, length, yStart, yEnd, direction, material };
}

function teamSpawns(alphaBaseZ: number, bravoBaseZ: number): SpawnPoint[] {
  return [
    { x: -12, y: 0, z: alphaBaseZ, yaw: 0, team: 'alpha' },
    { x: -4, y: 0, z: alphaBaseZ + 2, yaw: 0, team: 'alpha' },
    { x: 4, y: 0, z: alphaBaseZ + 2, yaw: 0, team: 'alpha' },
    { x: 12, y: 0, z: alphaBaseZ, yaw: 0, team: 'alpha' },
    { x: -12, y: 0, z: bravoBaseZ, yaw: Math.PI, team: 'bravo' },
    { x: -4, y: 0, z: bravoBaseZ - 2, yaw: Math.PI, team: 'bravo' },
    { x: 4, y: 0, z: bravoBaseZ - 2, yaw: Math.PI, team: 'bravo' },
    { x: 12, y: 0, z: bravoBaseZ, yaw: Math.PI, team: 'bravo' },
    // Neutral FFA spawns
    { x: -22, y: 0, z: -12, yaw: -Math.PI / 2, team: 'none' },
    { x: 22, y: 0, z: 12, yaw: Math.PI / 2, team: 'none' },
    { x: -22, y: 0, z: 14, yaw: -Math.PI / 3, team: 'none' },
    { x: 22, y: 0, z: -14, yaw: (Math.PI * 2) / 3, team: 'none' },
    { x: 0, y: 0, z: alphaBaseZ, yaw: 0, team: 'none' },
    { x: 0, y: 0, z: bravoBaseZ, yaw: Math.PI, team: 'none' },
  ];
}

export const MAPS: Record<MapId, MapDefinition> = {
  foundry: {
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
  },

  crossroads: {
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
  },

  dustbasin: {
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
  },

  depot: {
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
  },

  bastion: {
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
  },

  apex_arena: {
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
  },

  training_range: {
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
  },
};

export const MULTIPLAYER_MAPS: MapDefinition[] = Object.values(MAPS).filter(
  (m) => m.id !== 'training_range'
);
