import crypto from 'crypto';
import type { WebSocket } from 'ws';
import type {
  BotDifficulty,
  ChatMessage,
  GameModeId,
  KillFeedEntry,
  MapId,
  MatchMutators,
  MatchResultSummary,
  MatchSummaryInfo,
  MovementState,
  PlayerSnapshot,
  RegionId,
  ServerMessage,
  SprayDecal,
  TeamId,
  Vec3,
  WeaponId,
} from '../../shared/types/game.ts';
import { GAME_MODES } from '../../shared/constants/modes.ts';
import { MAPS, MULTIPLAYER_MAPS } from '../../shared/maps/index.ts';
import { WEAPONS } from '../../shared/constants/weapons.ts';
import { recordMatchCompletion } from '../persistence/index.ts';
import {
  createAntiCheatState,
  resetServerAmmo,
  startServerReload,
  validateMovementStep,
} from '../security/anticheat.ts';
import { createBotPlayer, updateBotsAI } from './bots.ts';
import { assignTeam, chooseSafeSpawn, resolveServerShot } from './combat.ts';
import {
  check2v2RoundEnd,
  createInitialModeState,
  hasReachedWinCondition,
  updateModeObjectives,
} from './modes.ts';
import type { ModeRuntimeState, ServerPlayer } from './types.ts';

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
  private modeState: ModeRuntimeState;
  private decals: SprayDecal[] = [];

  private matchId = '';
  private startedAtIso = '';
  private timeRemainingSec = 420;
  private countdownEndsAt = 0;
  private endedAt = 0;
  private mapVoteOptions: MapId[] = [];
  private mapVotes = new Map<string, MapId>();
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
    this.modeState = createInitialModeState(this.mode, MAPS[this.mapId]);

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
      alphaScore: this.modeState.alphaScore,
      bravoScore: this.modeState.bravoScore,
      alphaRounds: this.modeState.alphaRounds,
      bravoRounds: this.modeState.bravoRounds,
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
    this.decals = [];
    this.modeState = createInitialModeState(this.mode, map);
  }

  public addHumanPlayer(opts: {
    id: string;
    username: string;
    ws?: WebSocket;
    weaponId: WeaponId;
    weaponSkin: string;
    operatorSkin: string;
    clanTag?: string | null;
    preferredTeam?: TeamId;
  }): ServerPlayer | null {
    if (this.players.size >= this.maxPlayers && !this.players.has(opts.id)) {
      const botToKick = Array.from(this.players.values()).find((p) => p.isBot);
      if (botToKick) {
        this.players.delete(botToKick.id);
      } else {
        return null;
      }
    }

    const team = assignTeam(this.mode, this.players, opts.preferredTeam);
    const spawn = chooseSafeSpawn(this.mode, MAPS[this.mapId], this.players, team);
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
    for (const [id, p] of this.players.entries()) {
      if (p.isBot) this.players.delete(id);
    }
    const clamped = Math.max(0, Math.min(this.maxPlayers - this.getHumanCount(), count));
    const map = MAPS[this.mapId];
    for (let i = 0; i < clamped; i++) {
      const team = assignTeam(this.mode, this.players);
      const spawn = chooseSafeSpawn(this.mode, map, this.players, team);
      const bot = createBotPlayer({ index: i, difficulty, team, spawn });
      this.players.set(bot.id, bot);
    }
  }

  public removePlayer(userId: string) {
    const p = this.players.get(userId);
    if (!p) return;
    for (const flag of this.modeState.flags) {
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
    for (const p of this.players.values()) {
      p.team = assignTeam(this.mode, this.players);
      this.respawnPlayer(p);
    }
  }

  public startMatch() {
    const modeCfg = GAME_MODES[this.mode];
    this.matchId = 'm_' + crypto.randomUUID();
    this.startedAtIso = new Date().toISOString();
    this.state = 'countdown';
    this.countdownEndsAt = Date.now() + 3000;
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
      p.team = assignTeam(this.mode, this.players, p.team);
      this.respawnPlayer(p);
    }
  }

  private respawnPlayer(p: ServerPlayer) {
    const spawn = chooseSafeSpawn(this.mode, MAPS[this.mapId], this.players, p.team);
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

    const resolution = resolveServerShot({
      attacker,
      msg,
      mode: this.mode,
      map: MAPS[this.mapId],
      players: this.players,
      destructibles: this.destructibles,
      mutators: this.mutators,
    });
    if (!resolution) return;

    for (const hit of resolution.hits) {
      this.applyDamage(attacker, hit.target, hit.damage, hit.headshot, resolution.weaponId, hit.direction);
    }

    this.broadcast({
      type: 'shot_fired',
      shooterId: attacker.id,
      weaponId: resolution.weaponId,
      origin: resolution.origin,
      endPoints: resolution.endPoints,
      tracerColor: resolution.tracerColor,
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

    const isKc = this.mode === 'kill_confirmed' || this.mode === 'team_kill_confirmed';
    if (!isKc) {
      attacker.score += headshot ? 125 : 100;
      if (this.mode === 'ffa' || this.mode === 'tdm') {
        if (attacker.team === 'alpha') this.modeState.alphaScore += 1;
        else if (attacker.team === 'bravo') this.modeState.bravoScore += 1;
      }
    } else {
      attacker.score += 50;
      this.modeState.tags.push({
        id: 'tag_' + crypto.randomBytes(4).toString('hex'),
        x: victim.x,
        y: victim.y + 0.5,
        z: victim.z,
        victimTeam: victim.team,
        victimId: victim.id,
      });
    }

    for (const flag of this.modeState.flags) {
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

    if (hasReachedWinCondition(this.mode, this.modeState, this.players, this.mutators.scoreLimit)) {
      this.endMatch();
    }
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

    this.timeRemainingSec -= dt;
    if (this.timeRemainingSec <= 0) {
      this.endMatch();
      return;
    }

    const modeCfg = GAME_MODES[this.mode];
    for (const p of this.players.values()) {
      if (!p.alive && !modeCfg.roundBased && now >= p.respawnAt) {
        this.respawnPlayer(p);
      }
    }

    updateBotsAI({
      dt,
      now,
      map: MAPS[this.mapId],
      teamBased: modeCfg.teamBased,
      players: this.players,
      objectives: this.modeState.objectives,
      destructibles: this.destructibles,
      onBotShoot: (botId, weaponId, origin, direction) =>
        this.handleShot(botId, { weaponId, origin, direction }),
    });

    updateModeObjectives(this.mode, MAPS[this.mapId], this.modeState, this.players, dt, now);

    if (this.mode === '2v2') {
      check2v2RoundEnd(this.modeState, this.players, now, () => {
        for (const p of this.players.values()) this.respawnPlayer(p);
      });
    }

    if (hasReachedWinCondition(this.mode, this.modeState, this.players, this.mutators.scoreLimit)) {
      this.endMatch();
      return;
    }

    this.broadcastSnapshot(now);
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
        this.modeState.alphaScore > this.modeState.bravoScore
          ? 'alpha'
          : this.modeState.bravoScore > this.modeState.alphaScore
          ? 'bravo'
          : 'none';
    } else if (allPlayers[0]) {
      winnerPlayerId = allPlayers[0].id;
    }

    const mvp = allPlayers[0];
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
      alphaScore: this.modeState.alphaScore,
      bravoScore: this.modeState.bravoScore,
      durationSec,
      mvpPlayerId: mvp?.id ?? '',
      mvpUsername: mvp?.username ?? '-',
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
      objectives: this.modeState.objectives,
      tags: this.modeState.tags,
      flags: this.modeState.flags,
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
