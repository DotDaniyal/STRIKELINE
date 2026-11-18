import type { MapBoxCollider, MapRamp, SpawnPoint } from '../types/game.ts';

export function box(
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

export function ramp(
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

export function teamSpawns(alphaBaseZ: number, bravoBaseZ: number): SpawnPoint[] {
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
