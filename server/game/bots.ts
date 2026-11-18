import crypto from 'crypto';
import type {
  BotDifficulty,
  MapDefinition,
  ObjectiveRuntimeState,
  TeamId,
  Vec3,
  WeaponId,
} from '../../shared/types/game.ts';
import { getSurfaceHeightAt, raycastMapGeometry } from '../../shared/physics/ballistics.ts';
import { createAntiCheatState, startServerReload } from '../security/anticheat.ts';
import type { ServerPlayer } from './types.ts';

const BOT_NAMES = [
  'Atlas [BOT]',
  'Valkyrie [BOT]',
  'Cipher [BOT]',
  'Kestrel [BOT]',
  'Nomad [BOT]',
  'Specter [BOT]',
  'Titan [BOT]',
  'Raven [BOT]',
];

export function createBotPlayer(params: {
  index: number;
  difficulty: BotDifficulty;
  team: TeamId;
  spawn: { x: number; y: number; z: number; yaw: number };
}): ServerPlayer {
  const weapons: WeaponId[] = ['vanguard_ar', 'spectre_smg', 'warden_dmr', 'helix_burst'];
  const id = `bot_${params.index}_${crypto.randomBytes(3).toString('hex')}`;
  const ac = createAntiCheatState();
  ac.lastPos = { x: params.spawn.x, y: params.spawn.y, z: params.spawn.z };

  return {
    id,
    username: BOT_NAMES[params.index % BOT_NAMES.length],
    isBot: true,
    botDifficulty: params.difficulty,
    team: params.team,
    x: params.spawn.x,
    y: params.spawn.y,
    z: params.spawn.z,
    yaw: params.spawn.yaw,
    pitch: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    hp: 100,
    maxHp: 100,
    alive: true,
    spawnProtectedUntil: Date.now() + 2000,
    respawnAt: 0,
    movementState: 'walk',
    weaponId: weapons[params.index % weapons.length],
    weaponSkin: 'skin_standard_matte',
    operatorSkin: 'op_slate_vanguard',
    isAds: false,
    isReloading: false,
    kills: 0,
    deaths: 0,
    assists: 0,
    score: 0,
    headshots: 0,
    damageDealt: 0,
    shotsFired: 0,
    shotsHit: 0,
    streak: 0,
    ping: 0,
    ac,
    damageContributors: new Map(),
    botTargetYaw: params.spawn.yaw,
    botStrafeDir: params.index % 2 === 0 ? 1 : -1,
    botNextDecisionAt: 0,
    botNextShotAt: Date.now() + 1500,
  };
}

function moveBotWithBounds(
  bot: ServerPlayer,
  dx: number,
  dz: number,
  map: MapDefinition,
  destructibles: Map<string, number>
): boolean {
  const nextX = Math.max(map.bounds.minX + 1.5, Math.min(map.bounds.maxX - 1.5, bot.x + dx));
  const nextZ = Math.max(map.bounds.minZ + 1.5, Math.min(map.bounds.maxZ - 1.5, bot.z + dz));
  const surfaceY = getSurfaceHeightAt(map, nextX, nextZ, bot.y);

  for (const c of map.colliders) {
    if (c.destructible && (destructibles.get(c.id) ?? 0) <= 0) continue;
    if (
      nextX >= c.min.x - 0.45 &&
      nextX <= c.max.x + 0.45 &&
      nextZ >= c.min.z - 0.45 &&
      nextZ <= c.max.z + 0.45
    ) {
      if (c.min.y < bot.y + 1.6 && c.max.y > bot.y + 0.65) {
        return false;
      }
    }
  }

  bot.x = nextX;
  bot.z = nextZ;
  bot.y = surfaceY;
  bot.ac.lastPos = { x: nextX, y: surfaceY, z: nextZ };
  return true;
}

export function updateBotsAI(params: {
  dt: number;
  now: number;
  map: MapDefinition;
  teamBased: boolean;
  players: Map<string, ServerPlayer>;
  objectives: ObjectiveRuntimeState[];
  destructibles: Map<string, number>;
  onBotShoot: (botId: string, weaponId: WeaponId, origin: Vec3, direction: Vec3) => void;
}) {
  const { dt, now, map, teamBased, players, objectives, destructibles, onBotShoot } = params;

  for (const bot of players.values()) {
    if (!bot.isBot || !bot.alive) continue;

    const diff = bot.botDifficulty ?? 'medium';
    const reactionSpread = diff === 'hard' ? 0.025 : diff === 'medium' ? 0.055 : 0.1;
    const fireCadenceMs = diff === 'hard' ? 240 : diff === 'medium' ? 420 : 680;
    const moveSpeed = diff === 'hard' ? 5.8 : diff === 'medium' ? 4.8 : 3.8;

    let nearestEnemy: ServerPlayer | null = null;
    let nearestDist = 48;
    const botEye: Vec3 = { x: bot.x, y: bot.y + 1.58, z: bot.z };

    for (const other of players.values()) {
      if (other.id === bot.id || !other.alive) continue;
      if (teamBased && other.team === bot.team) continue;
      const d = Math.hypot(other.x - bot.x, other.y - bot.y, other.z - bot.z);
      if (d > nearestDist) continue;
      const dx = (other.x - bot.x) / d;
      const dy = (other.y + 1.35 - botEye.y) / d;
      const dz = (other.z - bot.z) / d;
      const wall = raycastMapGeometry(botEye, { x: dx, y: dy, z: dz }, map, destructibles, d);
      if (!wall || wall.distance >= d - 0.5) {
        nearestDist = d;
        nearestEnemy = other;
      }
    }

    if (nearestEnemy) {
      const dx = nearestEnemy.x - bot.x;
      const dz = nearestEnemy.z - bot.z;
      bot.yaw = Math.atan2(-dx, -dz);
      bot.pitch = Math.atan2(nearestEnemy.y + 1.3 - botEye.y, Math.hypot(dx, dz));
      bot.isAds = nearestDist > 14;

      if (!bot.botNextDecisionAt || now > bot.botNextDecisionAt) {
        bot.botStrafeDir = Math.random() > 0.5 ? 1 : -1;
        bot.botNextDecisionAt = now + 700 + Math.random() * 800;
      }
      const strafeX = Math.cos(bot.yaw) * (bot.botStrafeDir ?? 1) * moveSpeed * 0.7;
      const strafeZ = -Math.sin(bot.yaw) * (bot.botStrafeDir ?? 1) * moveSpeed * 0.7;
      moveBotWithBounds(bot, strafeX * dt, strafeZ * dt, map, destructibles);

      if (!bot.botNextShotAt || now >= bot.botNextShotAt) {
        bot.botNextShotAt = now + fireCadenceMs + Math.random() * 140;
        const dist = Math.hypot(dx, nearestEnemy.y + 1.35 - botEye.y, dz) || 1;
        const aimDir: Vec3 = {
          x: dx / dist + (Math.random() - 0.5) * reactionSpread,
          y: (nearestEnemy.y + 1.35 - botEye.y) / dist + (Math.random() - 0.5) * reactionSpread,
          z: dz / dist + (Math.random() - 0.5) * reactionSpread,
        };
        onBotShoot(bot.id, bot.weaponId, botEye, aimDir);
        if ((bot.ac.ammoInMag[bot.weaponId] ?? 0) <= 0) {
          startServerReload(bot.ac, bot.weaponId);
        }
      }
    } else {
      bot.isAds = false;
      const goal = objectives.find((o) => o.active) ?? { x: 0, z: 0 };
      if (!bot.botNextDecisionAt || now > bot.botNextDecisionAt) {
        const gx = goal.x + (Math.random() - 0.5) * 18;
        const gz = goal.z + (Math.random() - 0.5) * 18;
        bot.botTargetYaw = Math.atan2(-(gx - bot.x), -(gz - bot.z));
        bot.botNextDecisionAt = now + 1800 + Math.random() * 1400;
      }
      bot.yaw = bot.botTargetYaw ?? bot.yaw;
      const fwdX = -Math.sin(bot.yaw) * moveSpeed;
      const fwdZ = -Math.cos(bot.yaw) * moveSpeed;
      const moved = moveBotWithBounds(bot, fwdX * dt, fwdZ * dt, map, destructibles);
      if (!moved) {
        bot.botTargetYaw = bot.yaw + Math.PI * 0.65;
      }
    }
  }
}
