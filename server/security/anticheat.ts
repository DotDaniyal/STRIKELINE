import type { MapDefinition, Vec3, WeaponId } from '../../shared/types/game.ts';
import { WEAPONS } from '../../shared/constants/weapons.ts';
import { recordAudit } from '../persistence/index.ts';

export interface PlayerAntiCheatState {
  lastPos: Vec3;
  lastMoveCheckAt: number;
  lastShotAt: number;
  shotsInBurst: number;
  ammoInMag: Record<WeaponId, number>;
  reloadingUntil: number;
  speedViolations: number;
  suspiciousFlags: number;
}

export function createAntiCheatState(): PlayerAntiCheatState {
  const ammoInMag = {} as Record<WeaponId, number>;
  for (const w of Object.values(WEAPONS)) {
    ammoInMag[w.id] = w.magSize;
  }
  return {
    lastPos: { x: 0, y: 0, z: 0 },
    lastMoveCheckAt: Date.now(),
    lastShotAt: 0,
    shotsInBurst: 0,
    ammoInMag,
    reloadingUntil: 0,
    speedViolations: 0,
    suspiciousFlags: 0,
  };
}

export function validateMovementStep(
  ac: PlayerAntiCheatState,
  userId: string,
  nextPos: Vec3,
  map: MapDefinition,
  speedMultiplier = 1.0
): { valid: boolean; clampedPos: Vec3 } {
  const now = Date.now();
  const dt = Math.max(0.016, Math.min(0.5, (now - ac.lastMoveCheckAt) / 1000));
  ac.lastMoveCheckAt = now;

  // Bounds clamp
  const clamped: Vec3 = {
    x: Math.max(map.bounds.minX + 0.5, Math.min(map.bounds.maxX - 0.5, nextPos.x)),
    y: Math.max(0, Math.min(18, nextPos.y)),
    z: Math.max(map.bounds.minZ + 0.5, Math.min(map.bounds.maxZ - 0.5, nextPos.z)),
  };

  if (!Number.isFinite(clamped.x) || !Number.isFinite(clamped.y) || !Number.isFinite(clamped.z)) {
    return { valid: false, clampedPos: { ...ac.lastPos } };
  }

  const dx = clamped.x - ac.lastPos.x;
  const dz = clamped.z - ac.lastPos.z;
  const horizDist = Math.hypot(dx, dz);

  // Max speed: sprint ~ 9.8 m/s, slide ~ 15.5 m/s, plus generous network jitter tolerance
  const maxAllowedSpeed = 19.5 * speedMultiplier;
  const maxStep = maxAllowedSpeed * dt + 2.2;

  if (horizDist > maxStep) {
    ac.speedViolations += 1;
    if (ac.speedViolations % 10 === 0) {
      recordAudit(userId, 'anticheat_speed_clamp', `Horizontal step ${horizDist.toFixed(2)}m > ${maxStep.toFixed(2)}m`);
    }
    const scale = maxStep / horizDist;
    const corrected: Vec3 = {
      x: ac.lastPos.x + dx * scale,
      y: clamped.y,
      z: ac.lastPos.z + dz * scale,
    };
    ac.lastPos = corrected;
    return { valid: false, clampedPos: corrected };
  }

  ac.lastPos = clamped;
  return { valid: true, clampedPos: clamped };
}

export function validateWeaponShot(
  ac: PlayerAntiCheatState,
  weaponId: WeaponId,
  userId: string
): { allowed: boolean; reason?: string } {
  const weapon = WEAPONS[weaponId];
  if (!weapon) return { allowed: false, reason: 'Unknown weapon' };

  const now = Date.now();
  if (now < ac.reloadingUntil) {
    return { allowed: false, reason: 'Reloading' };
  }

  const currentAmmo = ac.ammoInMag[weaponId] ?? weapon.magSize;
  if (currentAmmo <= 0) {
    return { allowed: false, reason: 'Empty magazine' };
  }

  // Enforce fire interval with 15% network jitter margin (and burst rifle handling)
  const minIntervalMs =
    weapon.fireMode === 'burst'
      ? 50
      : (60000 / weapon.rpm) * 0.82;

  if (now - ac.lastShotAt < minIntervalMs) {
    ac.suspiciousFlags += 1;
    if (ac.suspiciousFlags % 25 === 0) {
      recordAudit(userId, 'anticheat_firerate', `Fire rate violation on ${weaponId}`);
    }
    return { allowed: false, reason: 'Fire rate exceeded' };
  }

  ac.lastShotAt = now;
  ac.ammoInMag[weaponId] = currentAmmo - 1;
  return { allowed: true };
}

export function startServerReload(ac: PlayerAntiCheatState, weaponId: WeaponId) {
  const weapon = WEAPONS[weaponId];
  if (!weapon) return;
  ac.reloadingUntil = Date.now() + weapon.reloadTimeSec * 920;
  ac.ammoInMag[weaponId] = weapon.magSize;
}

export function resetServerAmmo(ac: PlayerAntiCheatState) {
  ac.reloadingUntil = 0;
  for (const w of Object.values(WEAPONS)) {
    ac.ammoInMag[w.id] = w.magSize;
  }
}
