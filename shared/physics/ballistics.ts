import type { MapDefinition, Vec3 } from '../types/game.ts';

export function rayIntersectsAABB(
  origin: Vec3,
  dir: Vec3,
  min: Vec3,
  max: Vec3,
  maxDist: number
): number | null {
  let tmin = 0;
  let tmax = maxDist;

  const axes: Array<'x' | 'y' | 'z'> = ['x', 'y', 'z'];
  for (const axis of axes) {
    const o = origin[axis];
    const d = dir[axis];
    const bmin = min[axis];
    const bmax = max[axis];

    if (Math.abs(d) < 1e-8) {
      if (o < bmin || o > bmax) return null;
    } else {
      const invD = 1 / d;
      let t1 = (bmin - o) * invD;
      let t2 = (bmax - o) * invD;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
      }
      if (t1 > tmin) tmin = t1;
      if (t2 < tmax) tmax = t2;
      if (tmin > tmax) return null;
    }
  }

  return tmin >= 0 && tmin <= maxDist ? tmin : null;
}

export function rayIntersectsSphere(
  origin: Vec3,
  dir: Vec3,
  center: Vec3,
  radius: number,
  maxDist: number
): number | null {
  const ocx = origin.x - center.x;
  const ocy = origin.y - center.y;
  const ocz = origin.z - center.z;
  const b = ocx * dir.x + ocy * dir.y + ocz * dir.z;
  const c = ocx * ocx + ocy * ocy + ocz * ocz - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const sqrtD = Math.sqrt(disc);
  const t = -b - sqrtD;
  if (t >= 0 && t <= maxDist) return t;
  const t2 = -b + sqrtD;
  if (t2 >= 0 && t2 <= maxDist) return t2;
  return null;
}

export interface WorldHitResult {
  distance: number;
  colliderId: string;
  destructible: boolean;
}

export function raycastMapGeometry(
  origin: Vec3,
  dir: Vec3,
  map: MapDefinition,
  destructibles: Map<string, number>,
  maxDist = 180
): WorldHitResult | null {
  let closest: WorldHitResult | null = null;

  // Ground plane y = 0
  if (dir.y < -1e-5 && origin.y > 0) {
    const tGround = -origin.y / dir.y;
    if (tGround > 0 && tGround < maxDist) {
      closest = { distance: tGround, colliderId: 'ground', destructible: false };
    }
  }

  for (const col of map.colliders) {
    if (col.decorativeOnly) continue;
    if (col.destructible) {
      const hp = destructibles.get(col.id) ?? 0;
      if (hp <= 0) continue;
    }
    const dist = rayIntersectsAABB(origin, dir, col.min, col.max, closest ? closest.distance : maxDist);
    if (dist !== null && (!closest || dist < closest.distance)) {
      closest = {
        distance: dist,
        colliderId: col.id,
        destructible: Boolean(col.destructible),
      };
    }
  }

  return closest;
}

export type HitZone = 'head' | 'body' | 'limb';

export function raycastPlayerHitbox(
  origin: Vec3,
  dir: Vec3,
  targetPos: Vec3,
  isCrouching: boolean,
  maxDist: number
): { distance: number; zone: HitZone } | null {
  const heightScale = isCrouching ? 0.68 : 1.0;

  // 1. Head sphere (radius 0.25)
  const headY = targetPos.y + 1.56 * heightScale;
  const headHit = rayIntersectsSphere(
    origin,
    dir,
    { x: targetPos.x, y: headY, z: targetPos.z },
    0.25,
    maxDist
  );

  // 2. Upper torso AABB
  const torsoMin: Vec3 = {
    x: targetPos.x - 0.36,
    y: targetPos.y + 0.72 * heightScale,
    z: targetPos.z - 0.36,
  };
  const torsoMax: Vec3 = {
    x: targetPos.x + 0.36,
    y: targetPos.y + 1.38 * heightScale,
    z: targetPos.z + 0.36,
  };
  const torsoHit = rayIntersectsAABB(origin, dir, torsoMin, torsoMax, maxDist);

  // 3. Lower limbs AABB
  const legMin: Vec3 = {
    x: targetPos.x - 0.32,
    y: targetPos.y,
    z: targetPos.z - 0.32,
  };
  const legMax: Vec3 = {
    x: targetPos.x + 0.32,
    y: targetPos.y + 0.72 * heightScale,
    z: targetPos.z + 0.32,
  };
  const legHit = rayIntersectsAABB(origin, dir, legMin, legMax, maxDist);

  let best: { distance: number; zone: HitZone } | null = null;
  if (headHit !== null) best = { distance: headHit, zone: 'head' };
  if (torsoHit !== null && (!best || torsoHit < best.distance)) best = { distance: torsoHit, zone: 'body' };
  if (legHit !== null && (!best || legHit < best.distance)) best = { distance: legHit, zone: 'limb' };
  return best;
}

export function getSurfaceHeightAt(map: MapDefinition, x: number, z: number, currentY: number): number {
  let maxY = 0;

  for (const r of map.ramps) {
    const halfW = r.width / 2;
    const halfL = r.length / 2;
    if (x >= r.x - halfW && x <= r.x + halfW && z >= r.z - halfL && z <= r.z + halfL) {
      let t = 0;
      if (r.direction === 'north') t = (r.z + halfL - z) / r.length;
      else if (r.direction === 'south') t = (z - (r.z - halfL)) / r.length;
      else if (r.direction === 'east') t = (x - (r.x - halfW)) / r.width;
      else if (r.direction === 'west') t = (r.x + halfW - x) / r.width;
      t = Math.max(0, Math.min(1, t));
      const ry = r.yStart + t * (r.yEnd - r.yStart);
      if (ry <= currentY + 1.0 && ry > maxY) maxY = ry;
    }
  }

  for (const c of map.colliders) {
    if (x >= c.min.x - 0.3 && x <= c.max.x + 0.3 && z >= c.min.z - 0.3 && z <= c.max.z + 0.3) {
      if (c.max.y <= currentY + 0.65 && c.max.y > maxY) {
        maxY = c.max.y;
      }
    }
  }

  return maxY;
}
