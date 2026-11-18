import type { GameModeId, MapDefinition, MatchMutators, TeamId, Vec3, WeaponId } from '../../shared/types/game.ts';
import { GAME_MODES } from '../../shared/constants/modes.ts';
import { WEAPONS } from '../../shared/constants/weapons.ts';
import { raycastMapGeometry, raycastPlayerHitbox } from '../../shared/physics/ballistics.ts';
import { validateWeaponShot } from '../security/anticheat.ts';
import type { ServerPlayer } from './types.ts';

export function assignTeam(mode: GameModeId, players: Map<string, ServerPlayer>, preferred?: TeamId): TeamId {
  const modeCfg = GAME_MODES[mode];
  if (!modeCfg.teamBased) return 'none';
  let alpha = 0;
  let bravo = 0;
  for (const p of players.values()) {
    if (p.team === 'alpha') alpha++;
    else if (p.team === 'bravo') bravo++;
  }
  if (preferred === 'alpha' && alpha <= bravo) return 'alpha';
  if (preferred === 'bravo' && bravo <= alpha) return 'bravo';
  return alpha <= bravo ? 'alpha' : 'bravo';
}

export function chooseSafeSpawn(
  mode: GameModeId,
  map: MapDefinition,
  players: Map<string, ServerPlayer>,
  team: TeamId
): { x: number; y: number; z: number; yaw: number } {
  const modeCfg = GAME_MODES[mode];
  const candidates = map.spawns.filter((s) =>
    modeCfg.teamBased ? s.team === team : s.team === 'none' || s.team === 'alpha' || s.team === 'bravo'
  );
  const list = candidates.length > 0 ? candidates : map.spawns;

  let best = list[0];
  let bestScore = -Infinity;

  for (const sp of list) {
    let minEnemyDist = 999;
    for (const other of players.values()) {
      if (!other.alive) continue;
      if (modeCfg.teamBased && other.team === team) continue;
      const dist = Math.hypot(other.x - sp.x, other.z - sp.z);
      if (dist < minEnemyDist) minEnemyDist = dist;
    }
    const jitter = Math.random() * 2.5;
    if (minEnemyDist + jitter > bestScore) {
      bestScore = minEnemyDist + jitter;
      best = sp;
    }
  }

  return { x: best.x, y: best.y, z: best.z, yaw: best.yaw };
}

export interface ShotResolutionHit {
  target: ServerPlayer;
  damage: number;
  headshot: boolean;
  direction: Vec3;
}

export function resolveServerShot(params: {
  attacker: ServerPlayer;
  msg: { weaponId: WeaponId; origin: Vec3; direction: Vec3; pelletDirections?: Vec3[] };
  mode: GameModeId;
  map: MapDefinition;
  players: Map<string, ServerPlayer>;
  destructibles: Map<string, number>;
  mutators: MatchMutators;
}): {
  origin: Vec3;
  endPoints: Vec3[];
  tracerColor: string;
  weaponId: WeaponId;
  hits: ShotResolutionHit[];
} | null {
  const { attacker, msg, mode, map, players, destructibles, mutators } = params;
  const weapon = WEAPONS[msg.weaponId];
  if (!weapon) return null;

  if (
    mutators.allowedWeaponCategory &&
    mutators.allowedWeaponCategory !== 'all' &&
    weapon.category !== mutators.allowedWeaponCategory &&
    weapon.slot === 'primary'
  ) {
    return null;
  }

  const valid = validateWeaponShot(attacker.ac, weapon.id, attacker.id);
  if (!valid.allowed) return null;

  const expectedEyeY =
    attacker.y + (attacker.movementState === 'crouch' || attacker.movementState === 'slide' ? 1.1 : 1.62);
  const originDist = Math.hypot(msg.origin.x - attacker.x, msg.origin.y - expectedEyeY, msg.origin.z - attacker.z);
  const origin: Vec3 =
    originDist < 1.8 ? msg.origin : { x: attacker.x, y: expectedEyeY, z: attacker.z };

  const dirs =
    weapon.pellets > 1 && msg.pelletDirections && msg.pelletDirections.length === weapon.pellets
      ? msg.pelletDirections
      : [msg.direction];

  attacker.shotsFired += 1;
  const modeCfg = GAME_MODES[mode];
  const endPoints: Vec3[] = [];
  const hits: ShotResolutionHit[] = [];
  let anyPlayerHit = false;

  for (const rawDir of dirs) {
    const len = Math.hypot(rawDir.x, rawDir.y, rawDir.z) || 1;
    const dir: Vec3 = { x: rawDir.x / len, y: rawDir.y / len, z: rawDir.z / len };

    const worldHit = raycastMapGeometry(origin, dir, map, destructibles, 180);
    let maxDist = worldHit ? worldHit.distance : 160;

    let hitTarget: ServerPlayer | null = null;
    let hitZone: 'head' | 'body' | 'limb' = 'body';

    for (const target of players.values()) {
      if (target.id === attacker.id || !target.alive) continue;
      if (modeCfg.teamBased && target.team === attacker.team) continue;
      const isCrouch = target.movementState === 'crouch' || target.movementState === 'slide';
      const res = raycastPlayerHitbox(origin, dir, { x: target.x, y: target.y, z: target.z }, isCrouch, maxDist);
      if (res && res.distance < maxDist) {
        maxDist = res.distance;
        hitTarget = target;
        hitZone = res.zone;
      }
    }

    endPoints.push({
      x: origin.x + dir.x * maxDist,
      y: origin.y + dir.y * maxDist,
      z: origin.z + dir.z * maxDist,
    });

    if (hitTarget) {
      anyPlayerHit = true;
      if (Date.now() < hitTarget.spawnProtectedUntil) continue;
      if (mutators.headshotOnly && hitZone !== 'head') continue;

      let baseDmg =
        hitZone === 'head'
          ? weapon.damageHead
          : hitZone === 'limb'
          ? weapon.damageLimb
          : weapon.damageBody;

      if (maxDist > weapon.rangeFalloffStart) {
        const t = Math.min(
          1,
          (maxDist - weapon.rangeFalloffStart) /
            Math.max(1, weapon.rangeFalloffEnd - weapon.rangeFalloffStart)
        );
        const mult = 1 - t * (1 - weapon.minDamageMultiplier);
        baseDmg *= mult;
      }

      const dmg = Math.max(1, Math.round(baseDmg));
      hits.push({ target: hitTarget, damage: dmg, headshot: hitZone === 'head', direction: dir });
    } else if (worldHit && worldHit.destructible) {
      const curHp = destructibles.get(worldHit.colliderId) ?? 0;
      if (curHp > 0) {
        destructibles.set(worldHit.colliderId, Math.max(0, curHp - weapon.damageBody));
      }
    }
  }

  if (anyPlayerHit) attacker.shotsHit += 1;

  return {
    origin,
    endPoints,
    tracerColor: weapon.tracerColor,
    weaponId: weapon.id,
    hits,
  };
}
