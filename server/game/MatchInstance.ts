import crypto from 'crypto';
import type { WebSocket } from 'ws';
import type {
  BotDifficulty,
  ChatMessage,
  FlagRuntimeState,
  GameModeId,
  KillFeedEntry,
  MapId,
  MatchMutators,
  MatchResultSummary,
  MatchSummaryInfo,
  MovementState,
  ObjectiveRuntimeState,
  PlayerSnapshot,
  RegionId,
  ServerMessage,
  SprayDecal,
  TagDrop,
  TeamId,
  Vec3,
  WeaponId,
} from '../../shared/types/game.ts';
import { GAME_MODES } from '../../shared/constants/modes.ts';
import { MAPS, MULTIPLAYER_MAPS } from '../../shared/constants/maps.ts';
import { WEAPONS } from '../../shared/constants/weapons.ts';
import { recordMatchCompletion } from '../database/db.ts';
import { getSurfaceHeightAt, raycastMapGeometry, raycastPlayerHitbox } from './physics.ts';
import {
  createAntiCheatState,
  type PlayerAntiCheatState,
  resetServerAmmo,
  startServerReload,
  validateMovementStep,
  validateWeaponShot,
} from '../security/anticheat.ts';

interface ServerPlayer {
  id: string;
  username: string;
  isBot: boolean;
  botDifficulty?: BotDifficulty;
  ws?: WebSocket;
  team: TeamId;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  vx: number;
  vy: number;
  vz: number;
  hp: number;
  maxHp: number;
  alive: boolean;
  spawnProtectedUntil: number;
  respawnAt: number;
  movementState: MovementState;
  weaponId: WeaponId;
  weaponSkin: string;
  operatorSkin: string;
  isAds: boolean;
  isReloading: boolean;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  headshots: number;
  damageDealt: number;
  shotsFired: number;
  shotsHit: number;
  streak: number;
  ping: number;
  clanTag?: string | null;
  ac: PlayerAntiCheatState;
  damageContributors: Map<string, number>; // attackerId -> timestamp
  // Bot AI fields
  botTargetYaw?: number;
  botStrafeDir?: number;
  botNextDecisionAt?: number;
  botNextShotAt?: number;
}

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

export class MatchInstance {
  public readonly roomId: string;
  public readonly roomCode?: string;
  public readonly isPrivate: boolean;
  public readonly password?: string;
  public readonly ranked: boolean;
  public hostId: string;
  public mode: GameModeId;
  public mapId: MapId;
  public region: RegionId;
  public maxPlayers: number;
  public mutators: MatchMutators;
  public state: 'waiting' | 'countdown' | 'active' | 'ended' = 'waiting';

  private players = new Map<string, ServerPlayer>();
  private destructibles = new Map<string, number>();
  private objectives: ObjectiveRuntimeState[] = [];
  private hardpointIndex = 0;
  private hardpointNextRotateAt = 0;
  private tags: TagDrop[] = [];
  private flags: FlagRuntimeState[] = [];
  private decals: SprayDecal[] = [];
  private alphaScore = 0;
  private bravoScore = 0;
  private alphaRounds = 0;
  private bravoRounds = 0;
  private roundEndingAt = 0;
  private domTickAcc = 0;
  private hpTickAcc = 0;

  private matchId = '';
  private startedAtIso = '';
  private timeRemainingSec = 420;
  private countdownEndsAt = 0;
  private endedAt = 0;
  private mapVoteOptions: MapId[] = [];
  private mapVotes = new Map<string, MapId>(); // userId -> mapId
  private tickHandle: NodeJS.Timeout | null = null;
  private lastTickAt = Date.now();
  private onEmptyCallback?: (roomId: string) => void;

  constructor(opts: {
    roomId: string;
    roomCode?: string;
    isPrivate: boolean;
    password?: string;
    ranked?: boolean;
    hostId: string;
    mode: GameModeId;
    mapId: MapId;
    region: RegionId;
    maxPlayers?: number;
    mutators?: MatchMutators;
    onEmpty?: (roomId: string) => void;
  }) {
    this.roomId = opts.roomId;
    this.roomCode = opts.roomCode;
    this.isPrivate = opts.isPrivate;
    this.password = opts.password;
    this.ranked = Boolean(opts.ranked);
    this.hostId = opts.hostId;
    this.mode = opts.mode;
    this.mapId = opts.mapId;
    this.region = opts.region;
    this.mutators = opts.mutators || {};
    const modeCfg = GAME_MODES[this.mode];
    this.maxPlayers = opts.maxPlayers ?? modeCfg.maxPlayers;
    this.timeRemainingSec = this.mutators.durationSec ?? modeCfg.durationSec;
    this.onEmptyCallback = opts.onEmpty;

    this.initMapEntities();
    if (!this.isPrivate) {
      this.startMatch();
    } else if (this.mutators.botsCount && this.mutators.botsCount > 0) {
      this.syncBots(this.mutators.botsCount, this.mutators.botDifficulty ?? 'medium');
    }

    this.tickHandle = setInterval(() => this.tick(), 40); // 25 Hz authoritative server tick
  }

  public dispose() {
    if (this.tickHandle) {
      clearInterval(this.tickHandle);
      this.tickHandle = null;
    }
  }

  public getHumanCount(): number {
    let c = 0;
    for (const p of this.players.values()) if (!p.isBot) c++;
    return c;
  }

  public getPlayerCount(): number {
    return this.players.size;
  }

  public getSummary(): MatchSummaryInfo {
    const modeCfg = GAME_MODES[this.mode];
    return {
      roomId: this.roomId,
      roomCode: this.roomCode,
      isPrivate: this.isPrivate,
      hasPassword: Boolean(this.password),
      hostId: this.hostId,
      mode: this.mode,
      mapId: this.mapId,
      region: this.region,
      state: this.state,
      playerCount: this.players.size,
      maxPlayers: this.maxPlayers,
      timeRemainingSec: Math.max(0, Math.ceil(this.timeRemainingSec)),
      scoreLimit: this.mutators.scoreLimit ?? modeCfg.scoreLimit,
      alphaScore: this.alphaScore,
      bravoScore: this.bravoScore,
      alphaRounds: this.alphaRounds,
      bravoRounds: this.bravoRounds,
      mutators: this.mutators,
    };
  }

  private initMapEntities() {
    const map = MAPS[this.mapId];
    this.destructibles.clear();
    for (const c of map.colliders) {
      if (c.destructible) {
        this.destructibles.set(c.id, c.maxHp ?? 90);
      }
    }

    this.objectives = [];
    this.tags = [];
    this.flags = [];
    this.decals = [];

    if (this.mode === 'hardpoint' && map.hardpoints.length > 0) {
      this.hardpointIndex = 0;
      this.hardpointNextRotateAt = Date.now() + 45000;
      this.objectives = map.hardpoints.map((hp, i) => ({
        ...hp,
        owner: 'none',
        capturingTeam: 'none',
        progress: 0,
        contested: false,
        active: i === 0,
      }));
    } else if (this.mode === 'domination' && map.dominationPoints.length > 0) {
      this.objectives = map.dominationPoints.map((dp) => ({
        ...dp,
        owner: 'none',
        capturingTeam: 'none',
        progress: 0,
        contested: false,
        active: true,
      }));
    } else if (this.mode === 'ctf') {
      this.flags = [
        {
          team: 'alpha',
          x: map.ctfBases.alpha.x,
          y: map.ctfBases.alpha.y,
          z: map.ctfBases.alpha.z,
          carrierId: null,
          atBase: true,
        },
        {
          team: 'bravo',
          x: map.ctfBases.bravo.x,
          y: map.ctfBases.bravo.y,
          z: map.ctfBases.bravo.z,
          carrierId: null,
          atBase: true,
        },
      ];
    }
  }

  public addHumanPlayer(opts: {
    id: string;
    username: string;
    ws: WebSocket;
    weaponId: WeaponId;
    weaponSkin: string;
    operatorSkin: string;
    clanTag?: string | null;
    preferredTeam?: TeamId;
  }): ServerPlayer | null {
    if (this.players.size >= this.maxPlayers && !this.players.has(opts.id)) {
      // If room is full of bots, remove one bot to make room for human player
      const botToKick = Array.from(this.players.values()).find((p) => p.isBot);
      if (botToKick) {
        this.players.delete(botToKick.id);
      } else {
        return null;
      }
    }

    const team = this.assignTeam(opts.preferredTeam);
    const spawn = this.chooseSafeSpawn(team);
    const ac = createAntiCheatState();
    ac.lastPos = { x: spawn.x, y: spawn.y, z: spawn.z };

    const player: ServerPlayer = {
      id: opts.id,
      username: opts.username,
      isBot: false,
      ws: opts.ws,
      team,
      x: spawn.x,
      y: spawn.y,
      z: spawn.z,
      yaw: spawn.yaw,
      pitch: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      hp: 100,
      maxHp: 100,
      alive: true,
      spawnProtectedUntil: Date.now() + 2000,
      respawnAt: 0,
      movementState: 'idle',
      weaponId: opts.weaponId,
      weaponSkin: opts.weaponSkin,
      operatorSkin: opts.operatorSkin,
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
      ping: 24,
      clanTag: opts.clanTag,
      ac,
      damageContributors: new Map(),
    };

    this.players.set(player.id, player);
    this.sendTo(player, {
      type: 'room_joined',
      match: this.getSummary(),
      yourId: player.id,
      yourTeam: player.team,
    });
    return player;
  }

  public syncBots(count: number, difficulty: BotDifficulty) {
    // Remove existing bots
    for (const [id, p] of this.players.entries()) {
      if (p.isBot) this.players.delete(id);
    }
    const clamped = Math.max(0, Math.min(this.maxPlayers - this.getHumanCount(), count));
    const weapons: WeaponId[] = ['vanguard_ar', 'spectre_smg', 'warden_dmr', 'helix_burst'];
    for (let i = 0; i < clamped; i++) {
      const team = this.assignTeam();
      const spawn = this.chooseSafeSpawn(team);
      const id = `bot_${i}_${crypto.randomBytes(3).toString('hex')}`;
      const ac = createAntiCheatState();
      ac.lastPos = { x: spawn.x, y: spawn.y, z: spawn.z };
      this.players.set(id, {
        id,
        username: BOT_NAMES[i % BOT_NAMES.length],
        isBot: true,
        botDifficulty: difficulty,
        team,
        x: spawn.x,
        y: spawn.y,
        z: spawn.z,
        yaw: spawn.yaw,
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
        weaponId: weapons[i % weapons.length],
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
        botTargetYaw: spawn.yaw,
        botStrafeDir: i % 2 === 0 ? 1 : -1,
        botNextDecisionAt: 0,
        botNextShotAt: Date.now() + 1500,
      });
    }
  }

  public removePlayer(userId: string) {
    const p = this.players.get(userId);
    if (!p) return;
    // Drop flag if carrying
    for (const flag of this.flags) {
      if (flag.carrierId === userId) {
        flag.carrierId = null;
        flag.x = p.x;
        flag.y = p.y;
        flag.z = p.z;
      }
    }
    this.players.delete(userId);

    if (this.hostId === userId) {
      const nextHuman = Array.from(this.players.values()).find((pl) => !pl.isBot);
      if (nextHuman) this.hostId = nextHuman.id;
    }

    if (this.getHumanCount() === 0) {
      this.dispose();
      this.onEmptyCallback?.(this.roomId);
    }
  }

  public kickPlayer(requesterId: string, targetId: string) {
    if (requesterId !== this.hostId) return;
    const target = this.players.get(targetId);
    if (!target) return;
    if (!target.isBot) {
      this.sendTo(target, { type: 'room_left', reason: 'Removed by room host.' });
    }
    this.removePlayer(targetId);
  }

  public updateSettings(
    requesterId: string,
    opts: { mode?: GameModeId; mapId?: MapId; maxPlayers?: number; mutators?: MatchMutators }
  ) {
    if (requesterId !== this.hostId || this.state === 'active') return;
    if (opts.mode && GAME_MODES[opts.mode]) this.mode = opts.mode;
    if (opts.mapId && MAPS[opts.mapId]) this.mapId = opts.mapId;
    if (opts.maxPlayers) this.maxPlayers = Math.max(2, Math.min(12, opts.maxPlayers));
    if (opts.mutators) this.mutators = { ...this.mutators, ...opts.mutators };
    const modeCfg = GAME_MODES[this.mode];
    this.timeRemainingSec = this.mutators.durationSec ?? modeCfg.durationSec;
    this.initMapEntities();
    if (typeof this.mutators.botsCount === 'number') {
      this.syncBots(this.mutators.botsCount, this.mutators.botDifficulty ?? 'medium');
    }
    // Re-balance teams
    for (const p of this.players.values()) {
      p.team = this.assignTeam();
      this.respawnPlayer(p);
    }
  }

  public startMatch() {
    const modeCfg = GAME_MODES[this.mode];
    this.matchId = 'm_' + crypto.randomUUID();
    this.startedAtIso = new Date().toISOString();
    this.state = 'countdown';
    this.countdownEndsAt = Date.now() + 3000;
    this.alphaScore = 0;
    this.bravoScore = 0;
    this.alphaRounds = 0;
    this.bravoRounds = 0;
    this.timeRemainingSec = this.mutators.durationSec ?? modeCfg.durationSec;
    this.mapVotes.clear();
    this.initMapEntities();

    if (typeof this.mutators.botsCount === 'number' && this.mutators.botsCount > 0) {
      this.syncBots(this.mutators.botsCount, this.mutators.botDifficulty ?? 'medium');
    }

    for (const p of this.players.values()) {
      p.kills = 0;
      p.deaths = 0;
      p.assists = 0;
      p.score = 0;
      p.headshots = 0;
      p.damageDealt = 0;
      p.shotsFired = 0;
      p.shotsHit = 0;
      p.streak = 0;
      p.team = this.assignTeam(p.team);
      this.respawnPlayer(p);
    }
  }

  private assignTeam(preferred?: TeamId): TeamId {
    const modeCfg = GAME_MODES[this.mode];
    if (!modeCfg.teamBased) return 'none';
    let alpha = 0;
    let bravo = 0;
    for (const p of this.players.values()) {
      if (p.team === 'alpha') alpha++;
      else if (p.team === 'bravo') bravo++;
    }
    if (preferred === 'alpha' && alpha <= bravo) return 'alpha';
    if (preferred === 'bravo' && bravo <= alpha) return 'bravo';
    return alpha <= bravo ? 'alpha' : 'bravo';
  }

  private chooseSafeSpawn(team: TeamId): { x: number; y: number; z: number; yaw: number } {
    const map = MAPS[this.mapId];
    const modeCfg = GAME_MODES[this.mode];
    const candidates = map.spawns.filter((s) =>
      modeCfg.teamBased ? s.team === team : s.team === 'none' || s.team === 'alpha' || s.team === 'bravo'
    );
    const list = candidates.length > 0 ? candidates : map.spawns;

    let best = list[0];
    let bestScore = -Infinity;

    for (const sp of list) {
      let minEnemyDist = 999;
      for (const other of this.players.values()) {
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

  private respawnPlayer(p: ServerPlayer) {
    const spawn = this.chooseSafeSpawn(p.team);
    p.x = spawn.x;
    p.y = spawn.y;
    p.z = spawn.z;
    p.yaw = spawn.yaw;
    p.pitch = 0;
    p.vx = 0;
    p.vy = 0;
    p.vz = 0;
    p.hp = p.maxHp;
    p.alive = true;
    p.spawnProtectedUntil = Date.now() + 2000;
    p.respawnAt = 0;
    p.isReloading = false;
    p.damageContributors.clear();
    p.ac.lastPos = { x: spawn.x, y: spawn.y, z: spawn.z };
    resetServerAmmo(p.ac);

    this.broadcast({
      type: 'player_respawned',
      playerId: p.id,
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: p.yaw,
      team: p.team,
    });
  }

  public handlePlayerInput(
    playerId: string,
    msg: {
      x: number;
      y: number;
      z: number;
      yaw: number;
      pitch: number;
      vx: number;
      vy: number;
      vz: number;
      movementState: MovementState;
      weaponId: WeaponId;
      isAds: boolean;
      isReloading: boolean;
    }
  ) {
    const p = this.players.get(playerId);
    if (!p || !p.alive || this.state === 'ended') return;

    const map = MAPS[this.mapId];
    const check = validateMovementStep(
      p.ac,
      p.id,
      { x: msg.x, y: msg.y, z: msg.z },
      map,
      this.mutators.speedMultiplier ?? 1.0
    );

    p.x = check.clampedPos.x;
    p.y = check.clampedPos.y;
    p.z = check.clampedPos.z;
    p.yaw = Number.isFinite(msg.yaw) ? msg.yaw : p.yaw;
    p.pitch = Number.isFinite(msg.pitch) ? Math.max(-1.55, Math.min(1.55, msg.pitch)) : p.pitch;
    p.vx = msg.vx;
    p.vy = msg.vy;
    p.vz = msg.vz;
    p.movementState = msg.movementState;
    if (WEAPONS[msg.weaponId]) {
      p.weaponId = msg.weaponId;
    }
    p.isAds = Boolean(msg.isAds);
    p.isReloading = Boolean(msg.isReloading);
  }

  public handleReload(playerId: string, weaponId: WeaponId) {
    const p = this.players.get(playerId);
    if (!p || !p.alive) return;
    startServerReload(p.ac, weaponId);
    p.isReloading = true;
  }

  public handleSwapWeapon(playerId: string, weaponId: WeaponId) {
    const p = this.players.get(playerId);
    if (!p || !WEAPONS[weaponId]) return;
    p.weaponId = weaponId;
    p.isReloading = false;
  }

  public handleSpray(
    playerId: string,
    msg: { x: number; y: number; z: number; nx: number; ny: number; nz: number; sprayId: string }
  ) {
    const p = this.players.get(playerId);
    if (!p || !p.alive) return;
    const decal: SprayDecal = {
      id: 'spr_' + crypto.randomBytes(4).toString('hex'),
      sprayId: msg.sprayId,
      playerId,
      x: msg.x,
      y: msg.y,
      z: msg.z,
      nx: msg.nx,
      ny: msg.ny,
      nz: msg.nz,
      createdAt: Date.now(),
    };
    this.decals.push(decal);
    if (this.decals.length > 24) this.decals.shift();
    this.broadcast({ type: 'spray_placed', decal });
  }

  public handleShot(
    playerId: string,
    msg: { weaponId: WeaponId; origin: Vec3; direction: Vec3; pelletDirections?: Vec3[] }
  ) {
    const attacker = this.players.get(playerId);
    if (!attacker || !attacker.alive || this.state !== 'active') return;

    const weapon = WEAPONS[msg.weaponId];
    if (!weapon) return;

    if (
      this.mutators.allowedWeaponCategory &&
      this.mutators.allowedWeaponCategory !== 'all' &&
      weapon.category !== this.mutators.allowedWeaponCategory &&
      weapon.slot === 'primary'
    ) {
      return;
    }

    const valid = validateWeaponShot(attacker.ac, weapon.id, attacker.id);
    if (!valid.allowed) return;

    // Validate origin near player's eye position
    const expectedEyeY = attacker.y + (attacker.movementState === 'crouch' || attacker.movementState === 'slide' ? 1.1 : 1.62);
    const originDist = Math.hypot(msg.origin.x - attacker.x, msg.origin.y - expectedEyeY, msg.origin.z - attacker.z);
    const origin: Vec3 =
      originDist < 1.8
        ? msg.origin
        : { x: attacker.x, y: expectedEyeY, z: attacker.z };

    const dirs =
      weapon.pellets > 1 && msg.pelletDirections && msg.pelletDirections.length === weapon.pellets
        ? msg.pelletDirections
        : [msg.direction];

    attacker.shotsFired += 1;
    const map = MAPS[this.mapId];
    const modeCfg = GAME_MODES[this.mode];
    const endPoints: Vec3[] = [];
    let anyPlayerHit = false;

    for (const rawDir of dirs) {
      const len = Math.hypot(rawDir.x, rawDir.y, rawDir.z) || 1;
      const dir: Vec3 = { x: rawDir.x / len, y: rawDir.y / len, z: rawDir.z / len };

      const worldHit = raycastMapGeometry(origin, dir, map, this.destructibles, 180);
      let maxDist = worldHit ? worldHit.distance : 160;

      let hitTarget: ServerPlayer | null = null;
      let hitZone: 'head' | 'body' | 'limb' = 'body';

      for (const target of this.players.values()) {
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
        if (this.mutators.headshotOnly && hitZone !== 'head') continue;

        let baseDmg =
          hitZone === 'head'
            ? weapon.damageHead
            : hitZone === 'limb'
            ? weapon.damageLimb
            : weapon.damageBody;

        // Distance falloff
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
        this.applyDamage(attacker, hitTarget, dmg, hitZone === 'head', weapon.id, dir);
      } else if (worldHit && worldHit.destructible) {
        const curHp = this.destructibles.get(worldHit.colliderId) ?? 0;
        if (curHp > 0) {
          this.destructibles.set(worldHit.colliderId, Math.max(0, curHp - weapon.damageBody));
        }
      }
    }

    if (anyPlayerHit) attacker.shotsHit += 1;

    this.broadcast({
      type: 'shot_fired',
      shooterId: attacker.id,
      weaponId: weapon.id,
      origin,
      endPoints,
      tracerColor: weapon.tracerColor,
    });
  }

  private applyDamage(
    attacker: ServerPlayer,
    victim: ServerPlayer,
    damage: number,
    headshot: boolean,
    weaponId: WeaponId,
    shotDir: Vec3
  ) {
    if (!victim.alive) return;
    victim.hp = Math.max(0, victim.hp - damage);
    attacker.damageDealt += damage;
    victim.damageContributors.set(attacker.id, Date.now());

    const killed = victim.hp <= 0;

    if (!attacker.isBot) {
      this.sendTo(attacker, {
        type: 'hit_confirm',
        targetId: victim.id,
        targetName: victim.username,
        damage,
        headshot,
        killed,
      });
    }

    if (!victim.isBot) {
      this.sendTo(victim, {
        type: 'damage_taken',
        attackerId: attacker.id,
        attackerName: attacker.username,
        attackerPos: { x: attacker.x, y: attacker.y, z: attacker.z },
        damage,
        hpRemaining: victim.hp,
        headshot,
      });
    }

    if (killed) {
      this.handleElimination(attacker, victim, weaponId, headshot, shotDir);
    }
  }

  private handleElimination(
    attacker: ServerPlayer,
    victim: ServerPlayer,
    weaponId: WeaponId,
    headshot: boolean,
    shotDir: Vec3
  ) {
    const modeCfg = GAME_MODES[this.mode];
    victim.alive = false;
    victim.deaths += 1;
    victim.streak = 0;
    const respawnDelay = modeCfg.roundBased ? 999 : modeCfg.respawnDelaySec;
    victim.respawnAt = Date.now() + respawnDelay * 1000;

    attacker.kills += 1;
    attacker.streak += 1;
    if (headshot) attacker.headshots += 1;

    // Assists
    const now = Date.now();
    for (const [contribId, ts] of victim.damageContributors.entries()) {
      if (contribId !== attacker.id && now - ts < 6000) {
        const ally = this.players.get(contribId);
        if (ally) {
          ally.assists += 1;
          ally.score += 50;
        }
      }
    }

    // Score attribution
    const isKc = this.mode === 'kill_confirmed' || this.mode === 'team_kill_confirmed';
    if (!isKc) {
      attacker.score += headshot ? 125 : 100;
      if (this.mode === 'ffa' || this.mode === 'tdm') {
        if (attacker.team === 'alpha') this.alphaScore += 1;
        else if (attacker.team === 'bravo') this.bravoScore += 1;
      }
    } else {
      attacker.score += 50; // Kill points; tag confirmation adds team score
      this.tags.push({
        id: 'tag_' + crypto.randomBytes(4).toString('hex'),
        x: victim.x,
        y: victim.y + 0.5,
        z: victim.z,
        victimTeam: victim.team,
        victimId: victim.id,
      });
    }

    // Drop CTF flag if carrier died
    for (const flag of this.flags) {
      if (flag.carrierId === victim.id) {
        flag.carrierId = null;
        flag.x = victim.x;
        flag.y = victim.y;
        flag.z = victim.z;
      }
    }

    const entry: KillFeedEntry = {
      id: 'kf_' + crypto.randomBytes(4).toString('hex'),
      attackerId: attacker.id,
      attackerName: attacker.username,
      attackerTeam: attacker.team,
      victimId: victim.id,
      victimName: victim.username,
      victimTeam: victim.team,
      weaponId,
      headshot,
      timestamp: now,
    };
    this.broadcast({ type: 'kill_feed', entry });

    this.broadcast({
      type: 'player_died',
      victimId: victim.id,
      attackerId: attacker.id,
      attackerName: attacker.username,
      weaponId,
      headshot,
      respawnInSec: respawnDelay,
      killerHp: attacker.hp,
      impulse: { x: shotDir.x * 8, y: 2.5, z: shotDir.z * 8 },
    });

    this.checkWinConditions();
  }

  public handleVoteMap(userId: string, mapId: MapId) {
    if (this.state !== 'ended' || !this.mapVoteOptions.includes(mapId)) return;
    this.mapVotes.set(userId, mapId);
    this.broadcast({ type: 'map_vote_update', votes: this.getVoteCounts() });
  }

  private getVoteCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const m of this.mapVoteOptions) counts[m] = 0;
    for (const m of this.mapVotes.values()) counts[m] = (counts[m] ?? 0) + 1;
    return counts;
  }

  public getPlayerTeam(userId: string): TeamId {
    return this.players.get(userId)?.team ?? 'none';
  }

  public getActiveChatPlayers(channel: 'match' | 'team', senderTeam: TeamId): ServerPlayer[] {
    const out: ServerPlayer[] = [];
    for (const p of this.players.values()) {
      if (p.isBot) continue;
      if (channel === 'team' && p.team !== senderTeam) continue;
      out.push(p);
    }
    return out;
  }

  public broadcastChat(message: ChatMessage, senderTeam: TeamId) {
    const targets =
      message.channel === 'team'
        ? this.getActiveChatPlayers('team', senderTeam)
        : this.getActiveChatPlayers('match', senderTeam);
    for (const t of targets) {
      this.sendTo(t, { type: 'chat_message', message });
    }
  }

  private tick() {
    const now = Date.now();
    const dt = Math.min(0.1, (now - this.lastTickAt) / 1000);
    this.lastTickAt = now;

    if (this.state === 'waiting') {
      this.broadcastSnapshot(now);
      return;
    }

    if (this.state === 'countdown') {
      if (now >= this.countdownEndsAt) {
        this.state = 'active';
      }
      this.broadcastSnapshot(now);
      return;
    }

    if (this.state === 'ended') {
      if (!this.isPrivate && now >= this.endedAt + 14000) {
        // Rotate to winning voted map
        const counts = this.getVoteCounts();
        let nextMap = this.mapVoteOptions[0] ?? this.mapId;
        let topVotes = -1;
        for (const [m, c] of Object.entries(counts)) {
          if (c > topVotes) {
            topVotes = c;
            nextMap = m as MapId;
          }
        }
        this.mapId = nextMap;
        this.startMatch();
      }
      return;
    }

    // Active match simulation
    this.timeRemainingSec -= dt;
    if (this.timeRemainingSec <= 0) {
      this.endMatch();
      return;
    }

    // Respawns
    for (const p of this.players.values()) {
      if (!p.alive && !GAME_MODES[this.mode].roundBased && now >= p.respawnAt) {
        this.respawnPlayer(p);
      }
    }

    // Bot AI simulation
    this.updateBots(dt, now);

    // Objective simulation
    this.updateObjectives(dt, now);

    // 2v2 round check
    if (this.mode === '2v2') {
      this.checkRoundEnd(now);
    }

    this.checkWinConditions();
    this.broadcastSnapshot(now);
  }

  private updateBots(dt: number, now: number) {
    const map = MAPS[this.mapId];
    const modeCfg = GAME_MODES[this.mode];

    for (const bot of this.players.values()) {
      if (!bot.isBot || !bot.alive) continue;

      const diff = bot.botDifficulty ?? 'medium';
      const reactionSpread = diff === 'hard' ? 0.025 : diff === 'medium' ? 0.055 : 0.1;
      const fireCadenceMs = diff === 'hard' ? 240 : diff === 'medium' ? 420 : 680;
      const moveSpeed = diff === 'hard' ? 5.8 : diff === 'medium' ? 4.8 : 3.8;

      // Find nearest visible enemy
      let nearestEnemy: ServerPlayer | null = null;
      let nearestDist = 48;
      const botEye: Vec3 = { x: bot.x, y: bot.y + 1.58, z: bot.z };

      for (const other of this.players.values()) {
        if (other.id === bot.id || !other.alive) continue;
        if (modeCfg.teamBased && other.team === bot.team) continue;
        const d = Math.hypot(other.x - bot.x, other.y - bot.y, other.z - bot.z);
        if (d > nearestDist) continue;
        const dx = (other.x - bot.x) / d;
        const dy = (other.y + 1.35 - botEye.y) / d;
        const dz = (other.z - bot.z) / d;
        const wall = raycastMapGeometry(botEye, { x: dx, y: dy, z: dz }, map, this.destructibles, d);
        if (!wall || wall.distance >= d - 0.5) {
          nearestDist = d;
          nearestEnemy = other;
        }
      }

      if (nearestEnemy) {
        const dx = nearestEnemy.x - bot.x;
        const dz = nearestEnemy.z - bot.z;
        const targetYaw = Math.atan2(-dx, -dz);
        bot.yaw = targetYaw;
        bot.pitch = Math.atan2(nearestEnemy.y + 1.3 - botEye.y, Math.hypot(dx, dz));
        bot.isAds = nearestDist > 14;

        // Strafe while engaging
        if (!bot.botNextDecisionAt || now > bot.botNextDecisionAt) {
          bot.botStrafeDir = Math.random() > 0.5 ? 1 : -1;
          bot.botNextDecisionAt = now + 700 + Math.random() * 800;
        }
        const strafeX = Math.cos(bot.yaw) * (bot.botStrafeDir ?? 1) * moveSpeed * 0.7;
        const strafeZ = -Math.sin(bot.yaw) * (bot.botStrafeDir ?? 1) * moveSpeed * 0.7;
        this.moveBotWithBounds(bot, strafeX * dt, strafeZ * dt, map);

        if (!bot.botNextShotAt || now >= bot.botNextShotAt) {
          bot.botNextShotAt = now + fireCadenceMs + Math.random() * 140;
          const dist = Math.hypot(dx, nearestEnemy.y + 1.35 - botEye.y, dz) || 1;
          const aimDir: Vec3 = {
            x: dx / dist + (Math.random() - 0.5) * reactionSpread,
            y: (nearestEnemy.y + 1.35 - botEye.y) / dist + (Math.random() - 0.5) * reactionSpread,
            z: dz / dist + (Math.random() - 0.5) * reactionSpread,
          };
          this.handleShot(bot.id, { weaponId: bot.weaponId, origin: botEye, direction: aimDir });
          if ((bot.ac.ammoInMag[bot.weaponId] ?? 0) <= 0) {
            startServerReload(bot.ac, bot.weaponId);
          }
        }
      } else {
        bot.isAds = false;
        // Move toward center / active objective
        const goal = this.objectives.find((o) => o.active) ?? { x: 0, z: 0 };
        if (!bot.botNextDecisionAt || now > bot.botNextDecisionAt) {
          const gx = goal.x + (Math.random() - 0.5) * 18;
          const gz = goal.z + (Math.random() - 0.5) * 18;
          bot.botTargetYaw = Math.atan2(-(gx - bot.x), -(gz - bot.z));
          bot.botNextDecisionAt = now + 1800 + Math.random() * 1400;
        }
        bot.yaw = bot.botTargetYaw ?? bot.yaw;
        const fwdX = -Math.sin(bot.yaw) * moveSpeed;
        const fwdZ = -Math.cos(bot.yaw) * moveSpeed;
        const moved = this.moveBotWithBounds(bot, fwdX * dt, fwdZ * dt, map);
        if (!moved) {
          bot.botTargetYaw = bot.yaw + Math.PI * 0.65;
        }
      }
    }
  }

  private moveBotWithBounds(bot: ServerPlayer, dx: number, dz: number, map: typeof MAPS[MapId]): boolean {
    const nextX = Math.max(map.bounds.minX + 1.5, Math.min(map.bounds.maxX - 1.5, bot.x + dx));
    const nextZ = Math.max(map.bounds.minZ + 1.5, Math.min(map.bounds.maxZ - 1.5, bot.z + dz));
    const surfaceY = getSurfaceHeightAt(map, nextX, nextZ, bot.y);

    // Check if blocked by solid box taller than step height
    for (const c of map.colliders) {
      if (c.destructible && (this.destructibles.get(c.id) ?? 0) <= 0) continue;
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

  private updateObjectives(dt: number, now: number) {
    const map = MAPS[this.mapId];

    // Hardpoint
    if (this.mode === 'hardpoint' && this.objectives.length > 0) {
      if (now >= this.hardpointNextRotateAt) {
        this.hardpointIndex = (this.hardpointIndex + 1) % this.objectives.length;
        this.hardpointNextRotateAt = now + 45000;
        this.objectives.forEach((o, i) => {
          o.active = i === this.hardpointIndex;
        });
      }
      const activeObj = this.objectives[this.hardpointIndex];
      let alphaIn = 0;
      let bravoIn = 0;
      const occupants: ServerPlayer[] = [];
      for (const p of this.players.values()) {
        if (!p.alive) continue;
        const d = Math.hypot(p.x - activeObj.x, p.z - activeObj.z);
        if (d <= activeObj.radius && Math.abs(p.y - activeObj.y) < 2.2) {
          if (p.team === 'alpha') alphaIn++;
          else if (p.team === 'bravo') bravoIn++;
          occupants.push(p);
        }
      }
      activeObj.contested = alphaIn > 0 && bravoIn > 0;
      activeObj.owner =
        activeObj.contested
          ? 'none'
          : alphaIn > 0
          ? 'alpha'
          : bravoIn > 0
          ? 'bravo'
          : 'none';

      this.hpTickAcc += dt;
      if (this.hpTickAcc >= 1.0) {
        this.hpTickAcc -= 1.0;
        if (activeObj.owner === 'alpha') {
          this.alphaScore += 2;
          occupants.filter((o) => o.team === 'alpha').forEach((o) => (o.score += 15));
        } else if (activeObj.owner === 'bravo') {
          this.bravoScore += 2;
          occupants.filter((o) => o.team === 'bravo').forEach((o) => (o.score += 15));
        }
      }
    }

    // Domination
    if (this.mode === 'domination') {
      for (const obj of this.objectives) {
        let alphaIn = 0;
        let bravoIn = 0;
        for (const p of this.players.values()) {
          if (!p.alive) continue;
          if (Math.hypot(p.x - obj.x, p.z - obj.z) <= obj.radius && Math.abs(p.y - obj.y) < 2.2) {
            if (p.team === 'alpha') alphaIn++;
            else if (p.team === 'bravo') bravoIn++;
          }
        }
        obj.contested = alphaIn > 0 && bravoIn > 0;
        if (!obj.contested) {
          if (alphaIn > 0 && obj.owner !== 'alpha') {
            obj.capturingTeam = 'alpha';
            obj.progress = Math.min(100, obj.progress + dt * 28 * alphaIn);
            if (obj.progress >= 100) {
              obj.owner = 'alpha';
              obj.progress = 100;
            }
          } else if (bravoIn > 0 && obj.owner !== 'bravo') {
            obj.capturingTeam = 'bravo';
            obj.progress = Math.min(100, obj.progress + dt * 28 * bravoIn);
            if (obj.progress >= 100) {
              obj.owner = 'bravo';
              obj.progress = 100;
            }
          } else {
            obj.capturingTeam = 'none';
          }
        }
      }
      this.domTickAcc += dt;
      if (this.domTickAcc >= 1.5) {
        this.domTickAcc -= 1.5;
        for (const obj of this.objectives) {
          if (obj.owner === 'alpha') this.alphaScore += 1;
          else if (obj.owner === 'bravo') this.bravoScore += 1;
        }
      }
    }

    // Kill Confirmed tags
    if (this.mode === 'kill_confirmed' || this.mode === 'team_kill_confirmed') {
      for (let i = this.tags.length - 1; i >= 0; i--) {
        const tag = this.tags[i];
        for (const p of this.players.values()) {
          if (!p.alive) continue;
          if (Math.hypot(p.x - tag.x, p.z - tag.z) <= 2.1 && Math.abs(p.y + 0.8 - tag.y) < 2.0) {
            const isDeny =
              this.mode === 'team_kill_confirmed'
                ? p.team === tag.victimTeam
                : p.id === tag.victimId;
            if (isDeny) {
              p.score += 50;
            } else {
              p.score += 100;
              if (this.mode === 'team_kill_confirmed') {
                if (p.team === 'alpha') this.alphaScore += 1;
                else if (p.team === 'bravo') this.bravoScore += 1;
              }
            }
            this.tags.splice(i, 1);
            break;
          }
        }
      }
    }

    // Capture the Flag
    if (this.mode === 'ctf') {
      for (const flag of this.flags) {
        const home = flag.team === 'alpha' ? map.ctfBases.alpha : map.ctfBases.bravo;
        if (flag.carrierId) {
          const carrier = this.players.get(flag.carrierId);
          if (!carrier || !carrier.alive) {
            flag.carrierId = null;
          } else {
            flag.x = carrier.x;
            flag.y = carrier.y + 0.5;
            flag.z = carrier.z;
            flag.atBase = false;

            const carrierHome = carrier.team === 'alpha' ? map.ctfBases.alpha : map.ctfBases.bravo;
            const ownFlag = this.flags.find((f) => f.team === carrier.team);
            if (ownFlag?.atBase && Math.hypot(carrier.x - carrierHome.x, carrier.z - carrierHome.z) <= 2.5) {
              // Capture!
              if (carrier.team === 'alpha') this.alphaScore += 1;
              else this.bravoScore += 1;
              carrier.score += 250;
              flag.carrierId = null;
              flag.x = home.x;
              flag.y = home.y;
              flag.z = home.z;
              flag.atBase = true;
            }
          }
        } else {
          for (const p of this.players.values()) {
            if (!p.alive) continue;
            if (Math.hypot(p.x - flag.x, p.z - flag.z) <= 2.2 && Math.abs(p.y - flag.y) < 2.2) {
              if (p.team !== flag.team) {
                flag.carrierId = p.id;
                flag.atBase = false;
                break;
              } else if (!flag.atBase) {
                // Return own dropped flag
                flag.x = home.x;
                flag.y = home.y;
                flag.z = home.z;
                flag.atBase = true;
                p.score += 75;
                break;
              }
            }
          }
        }
      }
    }
  }

  private checkRoundEnd(now: number) {
    if (this.roundEndingAt > 0) {
      if (now >= this.roundEndingAt) {
        this.roundEndingAt = 0;
        for (const p of this.players.values()) this.respawnPlayer(p);
      }
      return;
    }

    const alphaAlive = Array.from(this.players.values()).some((p) => p.team === 'alpha' && p.alive);
    const bravoAlive = Array.from(this.players.values()).some((p) => p.team === 'bravo' && p.alive);
    const hasAlpha = Array.from(this.players.values()).some((p) => p.team === 'alpha');
    const hasBravo = Array.from(this.players.values()).some((p) => p.team === 'bravo');
    if (!hasAlpha || !hasBravo) return;

    if (!alphaAlive || !bravoAlive) {
      if (!bravoAlive && alphaAlive) {
        this.alphaRounds += 1;
        this.alphaScore = this.alphaRounds;
      } else if (!alphaAlive && bravoAlive) {
        this.bravoRounds += 1;
        this.bravoScore = this.bravoRounds;
      }
      this.roundEndingAt = now + 2600;
    }
  }

  private checkWinConditions() {
    if (this.state !== 'active') return;
    const modeCfg = GAME_MODES[this.mode];
    const limit = this.mutators.scoreLimit ?? modeCfg.scoreLimit;

    if (modeCfg.teamBased) {
      if (this.alphaScore >= limit || this.bravoScore >= limit) {
        this.endMatch();
      }
    } else if (this.mode === 'kill_confirmed') {
      for (const p of this.players.values()) {
        if (Math.floor(p.score / 100) >= limit) {
          this.endMatch();
          return;
        }
      }
    } else {
      for (const p of this.players.values()) {
        if (p.kills >= limit) {
          this.endMatch();
          return;
        }
      }
    }
  }

  private endMatch() {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.endedAt = Date.now();
    const modeCfg = GAME_MODES[this.mode];
    const durationSec = Math.max(
      1,
      (this.mutators.durationSec ?? modeCfg.durationSec) - Math.max(0, Math.floor(this.timeRemainingSec))
    );

    const allPlayers = Array.from(this.players.values()).sort((a, b) => b.score - a.score || b.kills - a.kills);
    let winnerTeam: TeamId = 'none';
    let winnerPlayerId: string | undefined;

    if (modeCfg.teamBased) {
      winnerTeam =
        this.alphaScore > this.bravoScore ? 'alpha' : this.bravoScore > this.alphaScore ? 'bravo' : 'none';
    } else if (allPlayers[0]) {
      winnerPlayerId = allPlayers[0].id;
    }

    const mvp = allPlayers[0];

    // Pick 3 map vote options
    const others = MULTIPLAYER_MAPS.map((m) => m.id).filter((id) => id !== this.mapId);
    this.mapVoteOptions = [this.mapId, ...others.slice(0, 2)];

    const playerResults = allPlayers.map((p) => {
      const won = modeCfg.teamBased ? winnerTeam !== 'none' && p.team === winnerTeam : p.id === winnerPlayerId;
      const xpEarned = Math.round(80 + p.kills * 25 + p.assists * 10 + p.headshots * 15 + (won ? 120 : 40));
      const creditsEarned = Math.round(25 + p.kills * 8 + (won ? 45 : 15));
      const eloDelta = this.ranked ? (won ? 24 : -16) : 0;
      const accuracy = p.shotsFired > 0 ? Math.round((p.shotsHit / p.shotsFired) * 1000) / 10 : 0;

      return {
        id: p.id,
        isBot: p.isBot,
        username: p.username,
        team: p.team,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        score: p.score,
        headshots: p.headshots,
        damage: p.damageDealt,
        shotsFired: p.shotsFired,
        shotsHit: p.shotsHit,
        accuracy,
        won,
        xpEarned,
        creditsEarned,
        eloDelta,
      };
    });

    if (this.getHumanCount() > 0 && !this.isPrivate) {
      recordMatchCompletion({
        matchId: this.matchId,
        mode: this.mode,
        mapId: this.mapId,
        winnerTeam,
        durationSec,
        startedAt: this.startedAtIso,
        endedAt: new Date().toISOString(),
        participants: playerResults.map((pr) => ({
          userId: pr.id,
          isBot: pr.isBot,
          username: pr.username,
          team: pr.team,
          kills: pr.kills,
          deaths: pr.deaths,
          assists: pr.assists,
          score: pr.score,
          headshots: pr.headshots,
          damage: pr.damage,
          shotsFired: pr.shotsFired,
          shotsHit: pr.shotsHit,
          won: pr.won,
          xpEarned: pr.xpEarned,
          creditsEarned: pr.creditsEarned,
          eloDelta: pr.eloDelta,
        })),
      });
    }

    const result: MatchResultSummary = {
      matchId: this.matchId,
      mode: this.mode,
      mapId: this.mapId,
      winnerTeam,
      winnerPlayerId,
      alphaScore: this.alphaScore,
      bravoScore: this.bravoScore,
      durationSec,
      mvpPlayerId: mvp?.id ?? '',
      mvpUsername: mvp?.username ?? '—',
      players: playerResults.map((pr) => ({
        id: pr.id,
        username: pr.username,
        team: pr.team,
        kills: pr.kills,
        deaths: pr.deaths,
        assists: pr.assists,
        score: pr.score,
        headshots: pr.headshots,
        damage: pr.damage,
        accuracy: pr.accuracy,
        xpEarned: pr.xpEarned,
        creditsEarned: pr.creditsEarned,
      })),
      mapVoteOptions: this.mapVoteOptions,
      mapVotes: this.getVoteCounts(),
    };

    this.broadcast({ type: 'match_ended', result });
  }

  private broadcastSnapshot(now: number) {
    const players: PlayerSnapshot[] = Array.from(this.players.values()).map((p) => ({
      id: p.id,
      username: p.username,
      isBot: p.isBot,
      botDifficulty: p.botDifficulty,
      team: p.team,
      x: p.x,
      y: p.y,
      z: p.z,
      yaw: p.yaw,
      pitch: p.pitch,
      vx: p.vx,
      vy: p.vy,
      vz: p.vz,
      hp: p.hp,
      maxHp: p.maxHp,
      alive: p.alive,
      spawnProtected: now < p.spawnProtectedUntil,
      movementState: p.movementState,
      weaponId: p.weaponId,
      weaponSkin: p.weaponSkin,
      operatorSkin: p.operatorSkin,
      isAds: p.isAds,
      isReloading: p.isReloading,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      score: p.score,
      headshots: p.headshots,
      streak: p.streak,
      ping: p.ping,
      clanTag: p.clanTag,
    }));

    const destructiblesObj: Record<string, number> = {};
    for (const [k, v] of this.destructibles.entries()) destructiblesObj[k] = v;

    this.broadcast({
      type: 'match_state',
      match: this.getSummary(),
      players,
      objectives: this.objectives,
      tags: this.tags,
      flags: this.flags,
      destructibles: destructiblesObj,
      serverTime: now,
    });
  }

  private sendTo(p: ServerPlayer, msg: ServerMessage) {
    if (p.ws && p.ws.readyState === 1) {
      p.ws.send(JSON.stringify(msg));
    }
  }

  private broadcast(msg: ServerMessage) {
    const raw = JSON.stringify(msg);
    for (const p of this.players.values()) {
      if (p.ws && p.ws.readyState === 1) {
        p.ws.send(raw);
      }
    }
  }
}
