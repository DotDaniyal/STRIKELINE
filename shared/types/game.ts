export type WeaponId =
  | 'vanguard_ar'
  | 'spectre_smg'
  | 'longshot_sr'
  | 'warden_dmr'
  | 'breacher_sg'
  | 'viper_pistol'
  | 'helix_burst';

export type WeaponCategory = 'assault' | 'smg' | 'sniper' | 'dmr' | 'shotgun' | 'pistol';
export type FireMode = 'auto' | 'semi' | 'burst';

export interface WeaponConfig {
  id: WeaponId;
  name: string;
  code: string;
  category: WeaponCategory;
  slot: 'primary' | 'secondary';
  fireMode: FireMode;
  burstCount?: number;
  burstIntervalMs?: number;
  damageBody: number;
  damageHead: number;
  damageLimb: number;
  rpm: number;
  magSize: number;
  reserveMax: number;
  reloadTimeSec: number;
  equipTimeSec: number;
  pellets: number;
  hipSpread: number;
  adsSpread: number;
  moveSpreadPenalty: number;
  airSpreadPenalty: number;
  recoilVertical: number;
  recoilHorizontal: number;
  recoilRecovery: number;
  adsFov: number;
  adsZoomSpeed: number;
  rangeFalloffStart: number;
  rangeFalloffEnd: number;
  minDamageMultiplier: number;
  moveSpeedMultiplier: number;
  tracerColor: string;
  description: string;
}

export type MapId =
  | 'foundry'
  | 'crossroads'
  | 'dustbasin'
  | 'depot'
  | 'bastion'
  | 'apex_arena'
  | 'training_range';

export type GameModeId =
  | 'ffa'
  | 'tdm'
  | 'hardpoint'
  | 'kill_confirmed'
  | 'team_kill_confirmed'
  | 'domination'
  | 'ctf'
  | '2v2'
  | 'training';

export type TeamId = 'alpha' | 'bravo' | 'none';
export type MovementState = 'idle' | 'walk' | 'sprint' | 'crouch' | 'slide' | 'jump' | 'fall';
export type BotDifficulty = 'easy' | 'medium' | 'hard';
export type RegionId = 'na-east' | 'na-west' | 'eu-central' | 'ap-east';

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export type MaterialTag =
  | 'concrete'
  | 'metal'
  | 'wood'
  | 'sand'
  | 'glass'
  | 'crate'
  | 'asphalt'
  | 'hazard';

export interface MapBoxCollider {
  id: string;
  min: Vec3;
  max: Vec3;
  material: MaterialTag;
  color?: string;
  destructible?: boolean;
  maxHp?: number;
  decorativeOnly?: boolean;
}

export interface MapRamp {
  id: string;
  x: number;
  z: number;
  width: number;
  length: number;
  yStart: number;
  yEnd: number;
  direction: 'north' | 'south' | 'east' | 'west'; // direction going UP
  material: MaterialTag;
}

export interface SpawnPoint {
  x: number;
  y: number;
  z: number;
  yaw: number;
  team: TeamId;
}

export interface ObjectivePoint {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  team?: TeamId;
}

export interface MapDefinition {
  id: MapId;
  name: string;
  subtitle: string;
  environment: 'industrial' | 'urban' | 'desert' | 'warehouse' | 'military' | 'arena' | 'range';
  description: string;
  previewImage: string;
  recommendedModes: GameModeId[];
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  lighting: {
    skyTop: string;
    skyHorizon: string;
    fogColor: string;
    fogDensity: number;
    sunColor: string;
    sunIntensity: number;
    sunPosition: Vec3;
    hemiSky: string;
    hemiGround: string;
    hemiIntensity: number;
  };
  floorMaterial: MaterialTag;
  colliders: MapBoxCollider[];
  ramps: MapRamp[];
  spawns: SpawnPoint[];
  hardpoints: ObjectivePoint[];
  dominationPoints: ObjectivePoint[];
  ctfBases: { alpha: Vec3; bravo: Vec3 };
}

export interface GameModeConfig {
  id: GameModeId;
  name: string;
  shortName: string;
  description: string;
  objectiveSummary: string;
  teamBased: boolean;
  maxPlayers: number;
  scoreLimit: number;
  durationSec: number;
  respawnDelaySec: number;
  roundBased?: boolean;
}

export interface CrosshairSettings {
  style: 'classic' | 'dot' | 't-shape' | 'circle-dot';
  color: string;
  size: number;
  thickness: number;
  gap: number;
  opacity: number;
  centerDot: boolean;
  outline: boolean;
  dynamicSpread: boolean;
}

export interface KeyBindings {
  forward: string;
  backward: string;
  left: string;
  right: string;
  jump: string;
  sprint: string;
  crouch: string;
  reload: string;
  primaryWeapon: string;
  secondaryWeapon: string;
  inspect: string;
  spray: string;
  scoreboard: string;
  chat: string;
  teamChat: string;
}

export interface PlayerSettings {
  sensitivity: number;
  adsSensitivityMultiplier: number;
  invertY: boolean;
  fov: number;
  headBob: boolean;
  showTracers: boolean;
  showFps: boolean;
  graphicsPreset: 'low' | 'medium' | 'high' | 'ultra';
  renderScale: number;
  maxFps: number;
  bloom: boolean;
  shadows: boolean;
  masterVolume: number;
  sfxVolume: number;
  weaponVolume: number;
  ambientVolume: number;
  uiVolume: number;
  voiceVolume: number;
  muted: boolean;
  language: 'en' | 'es' | 'fr' | 'de' | 'ja';
  uiScale: number;
  colorblindMode: 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia';
  mobileLayoutScale: number;
  gamepadSensitivity: number;
  gamepadDeadzone: number;
  crosshair: CrosshairSettings;
  keybinds: KeyBindings;
}

export type CosmeticCategory = 'weapon_skin' | 'operator_skin' | 'spray' | 'bundle';

export interface ShopItem {
  id: string;
  name: string;
  category: CosmeticCategory;
  rarity: 'standard' | 'tactical' | 'elite' | 'apex';
  price: number;
  description: string;
  previewColor: string;
  secondaryColor?: string;
  accentColor?: string;
  metalness?: number;
  roughness?: number;
  weaponId?: WeaponId;
  bundleItems?: string[];
  featured?: boolean;
}

export interface LoadoutConfig {
  id: string;
  name: string;
  primaryWeapon: WeaponId;
  secondaryWeapon: WeaponId;
  weaponSkins: Partial<Record<WeaponId, string>>;
  operatorSkin: string;
  sprayId: string;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string | null;
  isGuest: boolean;
  role: 'player' | 'moderator' | 'admin';
  level: number;
  xp: number;
  xpToNext: number;
  credits: number;
  kills: number;
  deaths: number;
  assists: number;
  wins: number;
  losses: number;
  headshots: number;
  damageDealt: number;
  shotsFired: number;
  shotsHit: number;
  playtimeSec: number;
  rankedElo: number;
  clanTag?: string | null;
  equippedOperator: string;
  equippedSpray: string;
  activeLoadoutId: string;
  inventory: string[];
  loadouts: LoadoutConfig[];
  settings: PlayerSettings;
}

export interface PlayerSnapshot {
  id: string;
  username: string;
  isBot: boolean;
  botDifficulty?: BotDifficulty;
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
  spawnProtected: boolean;
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
  streak: number;
  ping: number;
  clanTag?: string | null;
}

export interface KillFeedEntry {
  id: string;
  attackerId: string;
  attackerName: string;
  attackerTeam: TeamId;
  victimId: string;
  victimName: string;
  victimTeam: TeamId;
  weaponId: WeaponId;
  headshot: boolean;
  timestamp: number;
}

export interface ObjectiveRuntimeState {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  owner: TeamId;
  capturingTeam: TeamId;
  progress: number; // 0..100
  contested: boolean;
  active: boolean;
}

export interface TagDrop {
  id: string;
  x: number;
  y: number;
  z: number;
  victimTeam: TeamId;
  victimId: string;
}

export interface FlagRuntimeState {
  team: 'alpha' | 'bravo';
  x: number;
  y: number;
  z: number;
  carrierId: string | null;
  atBase: boolean;
}

export interface SprayDecal {
  id: string;
  sprayId: string;
  playerId: string;
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  createdAt: number;
}

export interface MatchMutators {
  headshotOnly?: boolean;
  lowGravity?: boolean;
  speedMultiplier?: number;
  allowedWeaponCategory?: WeaponCategory | 'all';
  botsCount?: number;
  botDifficulty?: BotDifficulty;
  scoreLimit?: number;
  durationSec?: number;
}

export interface MatchSummaryInfo {
  roomId: string;
  roomCode?: string;
  isPrivate: boolean;
  hasPassword: boolean;
  hostId: string;
  mode: GameModeId;
  mapId: MapId;
  region: RegionId;
  state: 'waiting' | 'countdown' | 'active' | 'ended';
  playerCount: number;
  maxPlayers: number;
  timeRemainingSec: number;
  scoreLimit: number;
  alphaScore: number;
  bravoScore: number;
  alphaRounds: number;
  bravoRounds: number;
  mutators: MatchMutators;
}

export interface ChatMessage {
  id: string;
  channel: 'match' | 'team' | 'party';
  senderId: string;
  senderName: string;
  senderTeam?: TeamId;
  text: string;
  timestamp: number;
}

export interface MatchResultSummary {
  matchId: string;
  mode: GameModeId;
  mapId: MapId;
  winnerTeam: TeamId;
  winnerPlayerId?: string;
  alphaScore: number;
  bravoScore: number;
  durationSec: number;
  mvpPlayerId: string;
  mvpUsername: string;
  players: Array<{
    id: string;
    username: string;
    team: TeamId;
    kills: number;
    deaths: number;
    assists: number;
    score: number;
    headshots: number;
    damage: number;
    accuracy: number;
    xpEarned: number;
    creditsEarned: number;
  }>;
  mapVoteOptions: MapId[];
  mapVotes: Record<string, number>;
}

export interface FriendEntry {
  id: string;
  username: string;
  level: number;
  online: boolean;
  status: 'online' | 'in_match' | 'in_queue' | 'offline';
  relationship: 'accepted' | 'pending_incoming' | 'pending_outgoing';
  roomCode?: string;
}

export interface PartyInvite {
  id: string;
  partyId: string;
  fromUserId: string;
  fromUsername: string;
  expiresAt: number;
}

export interface PartyState {
  id: string;
  leaderId: string;
  members: Array<{
    id: string;
    username: string;
    level: number;
    ready: boolean;
  }>;
}

export interface ChallengeEntry {
  id: string;
  title: string;
  description: string;
  period: 'daily' | 'weekly';
  metric: 'kills' | 'headshots' | 'matches' | 'wins' | 'damage';
  target: number;
  progress: number;
  rewardXp: number;
  rewardCredits: number;
  completed: boolean;
  claimed: boolean;
}

export interface NewsItem {
  id: string;
  title: string;
  category: 'Patch Notes' | 'Event' | 'Competitive' | 'Announcement';
  version: string;
  summary: string;
  body: string;
  publishedAt: string;
}

export interface MatchRecord {
  id: string;
  mode: GameModeId;
  mapId: MapId;
  winnerTeam: TeamId;
  durationSec: number;
  endedAt: string;
  playerKills: number;
  playerDeaths: number;
  playerScore: number;
  playerTeam: TeamId;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  level: number;
  kills: number;
  deaths: number;
  wins: number;
  rankedElo: number;
  headshots: number;
  clanTag?: string | null;
}

// WebSocket Client -> Server Messages
export type ClientMessage =
  | { type: 'auth'; token: string }
  | { type: 'ping'; clientTime: number }
  | {
      type: 'queue_join';
      mode: GameModeId;
      mapId?: MapId;
      region: RegionId;
      ranked?: boolean;
    }
  | { type: 'queue_leave' }
  | {
      type: 'create_private_room';
      mode: GameModeId;
      mapId: MapId;
      maxPlayers: number;
      password?: string;
      mutators: MatchMutators;
    }
  | { type: 'join_room'; roomCode?: string; roomId?: string; password?: string }
  | { type: 'leave_room' }
  | {
      type: 'update_room_settings';
      mode?: GameModeId;
      mapId?: MapId;
      maxPlayers?: number;
      mutators?: MatchMutators;
    }
  | { type: 'kick_player'; targetId: string }
  | { type: 'start_private_match' }
  | {
      type: 'player_input';
      seq: number;
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
  | {
      type: 'player_shoot';
      weaponId: WeaponId;
      origin: Vec3;
      direction: Vec3;
      pelletDirections?: Vec3[];
      clientTime: number;
    }
  | { type: 'player_reload'; weaponId: WeaponId }
  | { type: 'player_swap_weapon'; weaponId: WeaponId }
  | { type: 'player_spray'; x: number; y: number; z: number; nx: number; ny: number; nz: number; sprayId: string }
  | { type: 'vote_map'; mapId: MapId }
  | { type: 'chat_send'; channel: 'match' | 'team' | 'party'; text: string }
  | { type: 'party_create' }
  | { type: 'party_invite'; targetUserId: string }
  | { type: 'party_respond_invite'; inviteId: string; accept: boolean }
  | { type: 'party_leave' }
  | { type: 'party_kick'; targetUserId: string }
  | { type: 'party_transfer_leader'; targetUserId: string }
  | { type: 'voice_signal'; targetId: string; signal: unknown };

// WebSocket Server -> Client Messages
export type ServerMessage =
  | { type: 'auth_ok'; userId: string; username: string }
  | { type: 'auth_error'; message: string }
  | { type: 'pong'; clientTime: number; serverTime: number }
  | { type: 'error'; message: string }
  | { type: 'queue_status'; searching: boolean; mode?: GameModeId; region?: RegionId; waitSec?: number; playersInQueue?: number }
  | { type: 'room_joined'; match: MatchSummaryInfo; yourId: string; yourTeam: TeamId }
  | { type: 'room_left'; reason?: string }
  | {
      type: 'match_state';
      match: MatchSummaryInfo;
      players: PlayerSnapshot[];
      objectives: ObjectiveRuntimeState[];
      tags: TagDrop[];
      flags: FlagRuntimeState[];
      destructibles: Record<string, number>;
      serverTime: number;
    }
  | {
      type: 'shot_fired';
      shooterId: string;
      weaponId: WeaponId;
      origin: Vec3;
      endPoints: Vec3[];
      tracerColor: string;
    }
  | {
      type: 'hit_confirm';
      targetId: string;
      targetName: string;
      damage: number;
      headshot: boolean;
      killed: boolean;
    }
  | {
      type: 'damage_taken';
      attackerId: string;
      attackerName: string;
      attackerPos: Vec3;
      damage: number;
      hpRemaining: number;
      headshot: boolean;
    }
  | { type: 'kill_feed'; entry: KillFeedEntry }
  | {
      type: 'player_died';
      victimId: string;
      attackerId: string;
      attackerName: string;
      weaponId: WeaponId;
      headshot: boolean;
      respawnInSec: number;
      killerHp: number;
      impulse: Vec3;
    }
  | { type: 'player_respawned'; playerId: string; x: number; y: number; z: number; yaw: number; team: TeamId }
  | { type: 'spray_placed'; decal: SprayDecal }
  | { type: 'match_ended'; result: MatchResultSummary }
  | { type: 'map_vote_update'; votes: Record<string, number> }
  | { type: 'chat_message'; message: ChatMessage }
  | { type: 'party_update'; party: PartyState | null }
  | { type: 'party_invite_received'; invite: PartyInvite }
  | { type: 'notification'; title: string; body: string; kind: 'info' | 'reward' | 'invite' | 'warning' }
  | { type: 'voice_signal'; fromId: string; signal: unknown };
