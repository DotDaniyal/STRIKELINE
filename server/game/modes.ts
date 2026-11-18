import type { GameModeId, MapDefinition } from '../../shared/types/game.ts';
import { GAME_MODES } from '../../shared/constants/modes.ts';
import type { ModeRuntimeState, ServerPlayer } from './types.ts';

export function createInitialModeState(mode: GameModeId, map: MapDefinition): ModeRuntimeState {
  const state: ModeRuntimeState = {
    objectives: [],
    hardpointIndex: 0,
    hardpointNextRotateAt: 0,
    tags: [],
    flags: [],
    alphaScore: 0,
    bravoScore: 0,
    alphaRounds: 0,
    bravoRounds: 0,
    roundEndingAt: 0,
    domTickAcc: 0,
    hpTickAcc: 0,
  };

  if (mode === 'hardpoint' && map.hardpoints.length > 0) {
    state.hardpointIndex = 0;
    state.hardpointNextRotateAt = Date.now() + 45000;
    state.objectives = map.hardpoints.map((hp, i) => ({
      ...hp,
      owner: 'none',
      capturingTeam: 'none',
      progress: 0,
      contested: false,
      active: i === 0,
    }));
  } else if (mode === 'domination' && map.dominationPoints.length > 0) {
    state.objectives = map.dominationPoints.map((dp) => ({
      ...dp,
      owner: 'none',
      capturingTeam: 'none',
      progress: 0,
      contested: false,
      active: true,
    }));
  } else if (mode === 'ctf') {
    state.flags = [
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

  return state;
}

export function updateModeObjectives(
  mode: GameModeId,
  map: MapDefinition,
  state: ModeRuntimeState,
  players: Map<string, ServerPlayer>,
  dt: number,
  now: number
) {
  if (mode === 'hardpoint' && state.objectives.length > 0) {
    if (now >= state.hardpointNextRotateAt) {
      state.hardpointIndex = (state.hardpointIndex + 1) % state.objectives.length;
      state.hardpointNextRotateAt = now + 45000;
      state.objectives.forEach((o, i) => {
        o.active = i === state.hardpointIndex;
      });
    }
    const activeObj = state.objectives[state.hardpointIndex];
    let alphaIn = 0;
    let bravoIn = 0;
    const occupants: ServerPlayer[] = [];
    for (const p of players.values()) {
      if (!p.alive) continue;
      const d = Math.hypot(p.x - activeObj.x, p.z - activeObj.z);
      if (d <= activeObj.radius && Math.abs(p.y - activeObj.y) < 2.2) {
        if (p.team === 'alpha') alphaIn++;
        else if (p.team === 'bravo') bravoIn++;
        occupants.push(p);
      }
    }
    activeObj.contested = alphaIn > 0 && bravoIn > 0;
    activeObj.owner = activeObj.contested
      ? 'none'
      : alphaIn > 0
      ? 'alpha'
      : bravoIn > 0
      ? 'bravo'
      : 'none';

    state.hpTickAcc += dt;
    if (state.hpTickAcc >= 1.0) {
      state.hpTickAcc -= 1.0;
      if (activeObj.owner === 'alpha') {
        state.alphaScore += 2;
        occupants.filter((o) => o.team === 'alpha').forEach((o) => (o.score += 15));
      } else if (activeObj.owner === 'bravo') {
        state.bravoScore += 2;
        occupants.filter((o) => o.team === 'bravo').forEach((o) => (o.score += 15));
      }
    }
  }

  if (mode === 'domination') {
    for (const obj of state.objectives) {
      let alphaIn = 0;
      let bravoIn = 0;
      for (const p of players.values()) {
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
    state.domTickAcc += dt;
    if (state.domTickAcc >= 1.5) {
      state.domTickAcc -= 1.5;
      for (const obj of state.objectives) {
        if (obj.owner === 'alpha') state.alphaScore += 1;
        else if (obj.owner === 'bravo') state.bravoScore += 1;
      }
    }
  }

  if (mode === 'kill_confirmed' || mode === 'team_kill_confirmed') {
    for (let i = state.tags.length - 1; i >= 0; i--) {
      const tag = state.tags[i];
      for (const p of players.values()) {
        if (!p.alive) continue;
        if (Math.hypot(p.x - tag.x, p.z - tag.z) <= 2.1 && Math.abs(p.y + 0.8 - tag.y) < 2.0) {
          const isDeny =
            mode === 'team_kill_confirmed' ? p.team === tag.victimTeam : p.id === tag.victimId;
          if (isDeny) {
            p.score += 50;
          } else {
            p.score += 100;
            if (mode === 'team_kill_confirmed') {
              if (p.team === 'alpha') state.alphaScore += 1;
              else if (p.team === 'bravo') state.bravoScore += 1;
            }
          }
          state.tags.splice(i, 1);
          break;
        }
      }
    }
  }

  if (mode === 'ctf') {
    for (const flag of state.flags) {
      const home = flag.team === 'alpha' ? map.ctfBases.alpha : map.ctfBases.bravo;
      if (flag.carrierId) {
        const carrier = players.get(flag.carrierId);
        if (!carrier || !carrier.alive) {
          flag.carrierId = null;
        } else {
          flag.x = carrier.x;
          flag.y = carrier.y + 0.5;
          flag.z = carrier.z;
          flag.atBase = false;

          const carrierHome = carrier.team === 'alpha' ? map.ctfBases.alpha : map.ctfBases.bravo;
          const ownFlag = state.flags.find((f) => f.team === carrier.team);
          if (ownFlag?.atBase && Math.hypot(carrier.x - carrierHome.x, carrier.z - carrierHome.z) <= 2.5) {
            if (carrier.team === 'alpha') state.alphaScore += 1;
            else state.bravoScore += 1;
            carrier.score += 250;
            flag.carrierId = null;
            flag.x = home.x;
            flag.y = home.y;
            flag.z = home.z;
            flag.atBase = true;
          }
        }
      } else {
        for (const p of players.values()) {
          if (!p.alive) continue;
          if (Math.hypot(p.x - flag.x, p.z - flag.z) <= 2.2 && Math.abs(p.y - flag.y) < 2.2) {
            if (p.team !== flag.team) {
              flag.carrierId = p.id;
              flag.atBase = false;
              break;
            } else if (!flag.atBase) {
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

export function check2v2RoundEnd(
  state: ModeRuntimeState,
  players: Map<string, ServerPlayer>,
  now: number,
  respawnAll: () => void
) {
  if (state.roundEndingAt > 0) {
    if (now >= state.roundEndingAt) {
      state.roundEndingAt = 0;
      respawnAll();
    }
    return;
  }

  const all = Array.from(players.values());
  const alphaAlive = all.some((p) => p.team === 'alpha' && p.alive);
  const bravoAlive = all.some((p) => p.team === 'bravo' && p.alive);
  const hasAlpha = all.some((p) => p.team === 'alpha');
  const hasBravo = all.some((p) => p.team === 'bravo');
  if (!hasAlpha || !hasBravo) return;

  if (!alphaAlive || !bravoAlive) {
    if (!bravoAlive && alphaAlive) {
      state.alphaRounds += 1;
      state.alphaScore = state.alphaRounds;
    } else if (!alphaAlive && bravoAlive) {
      state.bravoRounds += 1;
      state.bravoScore = state.bravoRounds;
    }
    state.roundEndingAt = now + 2600;
  }
}

export function hasReachedWinCondition(
  mode: GameModeId,
  state: ModeRuntimeState,
  players: Map<string, ServerPlayer>,
  mutatorScoreLimit?: number
): boolean {
  const modeCfg = GAME_MODES[mode];
  const limit = mutatorScoreLimit ?? modeCfg.scoreLimit;

  if (modeCfg.teamBased) {
    return state.alphaScore >= limit || state.bravoScore >= limit;
  }
  if (mode === 'kill_confirmed') {
    for (const p of players.values()) {
      if (Math.floor(p.score / 100) >= limit) return true;
    }
    return false;
  }
  for (const p of players.values()) {
    if (p.kills >= limit) return true;
  }
  return false;
}
