import type { WebSocket } from 'ws';
import type {
  BotDifficulty,
  FlagRuntimeState,
  MovementState,
  ObjectiveRuntimeState,
  TagDrop,
  TeamId,
  WeaponId,
} from '../../shared/types/game.ts';
import type { PlayerAntiCheatState } from '../security/anticheat.ts';

export interface ServerPlayer {
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
  damageContributors: Map<string, number>;
  // Bot AI state
  botTargetYaw?: number;
  botStrafeDir?: number;
  botNextDecisionAt?: number;
  botNextShotAt?: number;
}

export interface ModeRuntimeState {
  objectives: ObjectiveRuntimeState[];
  hardpointIndex: number;
  hardpointNextRotateAt: number;
  tags: TagDrop[];
  flags: FlagRuntimeState[];
  alphaScore: number;
  bravoScore: number;
  alphaRounds: number;
  bravoRounds: number;
  roundEndingAt: number;
  domTickAcc: number;
  hpTickAcc: number;
}
