import type { SqlValue } from 'sql.js';
import type {
  ChallengeEntry,
  LeaderboardEntry,
  LoadoutConfig,
  MatchRecord,
  PlayerSettings,
  UserProfile,
} from '../../shared/types/game.ts';
import { CHALLENGE_TEMPLATES, COSMETIC_CATALOG } from '../../shared/constants/catalog.ts';
import { getUserById, xpRequiredForLevel } from './authRepo.ts';
import { execSql, queryAll, queryOne, recordAudit } from './sqlite.ts';

export function updateUserSettings(userId: string, settings: PlayerSettings): UserProfile {
  execSql('UPDATE users SET settings_json = ? WHERE id = ?', [JSON.stringify(settings), userId]);
  return getUserById(userId)!;
}

export function updateUserLoadouts(
  userId: string,
  loadouts: LoadoutConfig[],
  activeLoadoutId: string,
  equippedOperator: string,
  equippedSpray: string
): UserProfile {
  const profile = getUserById(userId);
  if (!profile) throw new Error('User not found');
  const owned = new Set(profile.inventory);
  if (!owned.has(equippedOperator)) equippedOperator = 'op_slate_vanguard';
  if (!owned.has(equippedSpray)) equippedSpray = 'spray_strikeline';

  const sanitizedLoadouts = loadouts.slice(0, 5).map((l) => {
    const skins: Record<string, string> = {};
    for (const [wId, skinId] of Object.entries(l.weaponSkins || {})) {
      if (skinId && owned.has(skinId)) skins[wId] = skinId;
    }
    return {
      ...l,
      weaponSkins: skins,
      operatorSkin: owned.has(l.operatorSkin) ? l.operatorSkin : equippedOperator,
      sprayId: owned.has(l.sprayId) ? l.sprayId : equippedSpray,
    };
  });

  execSql(
    'UPDATE users SET loadouts_json = ?, active_loadout_id = ?, equipped_operator = ?, equipped_spray = ? WHERE id = ?',
    [JSON.stringify(sanitizedLoadouts), activeLoadoutId, equippedOperator, equippedSpray, userId]
  );
  return getUserById(userId)!;
}

export function purchaseShopItem(userId: string, itemId: string): UserProfile {
  const item = COSMETIC_CATALOG.find((i) => i.id === itemId);
  if (!item) throw new Error('Catalog item not found.');

  const profile = getUserById(userId);
  if (!profile) throw new Error('Account not found.');

  if (profile.inventory.includes(itemId)) {
    throw new Error('Item is already in your locker.');
  }
  if (profile.credits < item.price) {
    throw new Error('Insufficient credits.');
  }

  const now = new Date().toISOString();
  const newBalance = profile.credits - item.price;
  execSql('UPDATE users SET credits = ? WHERE id = ?', [newBalance, userId]);
  execSql('INSERT OR IGNORE INTO inventory (user_id, item_id, acquired_at) VALUES (?, ?, ?)', [
    userId,
    itemId,
    now,
  ]);
  if (item.bundleItems) {
    for (const subId of item.bundleItems) {
      execSql('INSERT OR IGNORE INTO inventory (user_id, item_id, acquired_at) VALUES (?, ?, ?)', [
        userId,
        subId,
        now,
      ]);
    }
  }
  recordAudit(userId, 'shop_purchase', `Purchased ${item.id} for ${item.price} credits`);
  return getUserById(userId)!;
}

function getResetKeys() {
  const now = new Date();
  const dailyKey = now.toISOString().slice(0, 10);
  const startOfYear = new Date(now.getUTCFullYear(), 0, 1);
  const weekNum = Math.ceil(((now.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getUTCDay() + 1) / 7);
  const weeklyKey = `${now.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  return { dailyKey, weeklyKey };
}

export function getUserChallenges(userId: string): ChallengeEntry[] {
  const { dailyKey, weeklyKey } = getResetKeys();
  return CHALLENGE_TEMPLATES.map((tpl) => {
    const resetKey = tpl.period === 'daily' ? dailyKey : weeklyKey;
    const row = queryOne<{ progress: number; completed: number; claimed: number }>(
      'SELECT progress, completed, claimed FROM challenge_progress WHERE user_id = ? AND challenge_id = ? AND reset_key = ?',
      [userId, tpl.id, resetKey]
    );
    return {
      ...tpl,
      progress: row ? row.progress : 0,
      completed: row ? Boolean(row.completed) : false,
      claimed: row ? Boolean(row.claimed) : false,
    };
  });
}

export function incrementChallengeProgress(
  userId: string,
  deltas: { kills?: number; headshots?: number; matches?: number; wins?: number; damage?: number }
) {
  const { dailyKey, weeklyKey } = getResetKeys();
  for (const tpl of CHALLENGE_TEMPLATES) {
    const delta = deltas[tpl.metric] ?? 0;
    if (delta <= 0) continue;
    const resetKey = tpl.period === 'daily' ? dailyKey : weeklyKey;
    const existing = queryOne<{ progress: number; completed: number; claimed: number }>(
      'SELECT progress, completed, claimed FROM challenge_progress WHERE user_id = ? AND challenge_id = ? AND reset_key = ?',
      [userId, tpl.id, resetKey]
    );
    const nextProgress = Math.min(tpl.target, (existing?.progress ?? 0) + delta);
    const completed = nextProgress >= tpl.target ? 1 : 0;
    if (existing) {
      execSql(
        'UPDATE challenge_progress SET progress = ?, completed = ? WHERE user_id = ? AND challenge_id = ? AND reset_key = ?',
        [nextProgress, completed, userId, tpl.id, resetKey]
      );
    } else {
      execSql(
        'INSERT INTO challenge_progress (user_id, challenge_id, reset_key, progress, completed, claimed) VALUES (?, ?, ?, ?, ?, 0)',
        [userId, tpl.id, resetKey, nextProgress, completed]
      );
    }
  }
}

export function claimChallengeReward(userId: string, challengeId: string): UserProfile {
  const tpl = CHALLENGE_TEMPLATES.find((c) => c.id === challengeId);
  if (!tpl) throw new Error('Challenge not found.');
  const { dailyKey, weeklyKey } = getResetKeys();
  const resetKey = tpl.period === 'daily' ? dailyKey : weeklyKey;
  const row = queryOne<{ completed: number; claimed: number }>(
    'SELECT completed, claimed FROM challenge_progress WHERE user_id = ? AND challenge_id = ? AND reset_key = ?',
    [userId, challengeId, resetKey]
  );
  if (!row || !row.completed) throw new Error('Challenge is not yet completed.');
  if (row.claimed) throw new Error('Reward already claimed.');

  execSql('UPDATE challenge_progress SET claimed = 1 WHERE user_id = ? AND challenge_id = ? AND reset_key = ?', [
    userId,
    challengeId,
    resetKey,
  ]);
  applyProgression(userId, tpl.rewardXp, tpl.rewardCredits);
  return getUserById(userId)!;
}

export function applyProgression(userId: string, xpGain: number, creditGain: number) {
  const row = queryOne<{ level: number; xp: number; credits: number }>(
    'SELECT level, xp, credits FROM users WHERE id = ?',
    [userId]
  );
  if (!row) return;
  let level = row.level;
  let xp = row.xp + Math.max(0, Math.round(xpGain));
  let credits = row.credits + Math.max(0, Math.round(creditGain));

  while (xp >= xpRequiredForLevel(level)) {
    xp -= xpRequiredForLevel(level);
    level += 1;
    credits += 150; // Level up bonus
  }

  execSql('UPDATE users SET level = ?, xp = ?, credits = ? WHERE id = ?', [level, xp, credits, userId]);
}

export function recordMatchCompletion(params: {
  matchId: string;
  mode: string;
  mapId: string;
  winnerTeam: string;
  durationSec: number;
  startedAt: string;
  endedAt: string;
  participants: Array<{
    userId: string;
    isBot: boolean;
    username: string;
    team: string;
    kills: number;
    deaths: number;
    assists: number;
    score: number;
    headshots: number;
    damage: number;
    shotsFired: number;
    shotsHit: number;
    won: boolean;
    xpEarned: number;
    creditsEarned: number;
    eloDelta: number;
  }>;
}) {
  execSql(
    `INSERT OR REPLACE INTO matches (id, mode, map_id, winner_team, duration_sec, started_at, ended_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [params.matchId, params.mode, params.mapId, params.winnerTeam, params.durationSec, params.startedAt, params.endedAt]
  );

  for (const p of params.participants) {
    const acc = p.shotsFired > 0 ? Math.round((p.shotsHit / p.shotsFired) * 1000) / 10 : 0;
    execSql(
      `INSERT OR REPLACE INTO match_participants (match_id, user_id, username, team, kills, deaths, assists, score, headshots, damage, accuracy)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [params.matchId, p.userId, p.username, p.team, p.kills, p.deaths, p.assists, p.score, p.headshots, p.damage, acc]
    );

    if (!p.isBot) {
      execSql(
        `UPDATE users SET
          kills = kills + ?,
          deaths = deaths + ?,
          assists = assists + ?,
          wins = wins + ?,
          losses = losses + ?,
          headshots = headshots + ?,
          damage_dealt = damage_dealt + ?,
          shots_fired = shots_fired + ?,
          shots_hit = shots_hit + ?,
          playtime_sec = playtime_sec + ?,
          ranked_elo = MAX(100, ranked_elo + ?)
         WHERE id = ?`,
        [
          p.kills,
          p.deaths,
          p.assists,
          p.won ? 1 : 0,
          p.won ? 0 : 1,
          p.headshots,
          p.damage,
          p.shotsFired,
          p.shotsHit,
          params.durationSec,
          p.eloDelta,
          p.userId,
        ]
      );
      applyProgression(p.userId, p.xpEarned, p.creditsEarned);
      incrementChallengeProgress(p.userId, {
        kills: p.kills,
        headshots: p.headshots,
        matches: 1,
        wins: p.won ? 1 : 0,
        damage: p.damage,
      });
    }
  }
}

export function getMatchHistoryForUser(userId: string): MatchRecord[] {
  const rows = queryAll<{
    id: string;
    mode: string;
    map_id: string;
    winner_team: string;
    duration_sec: number;
    ended_at: string;
    kills: number;
    deaths: number;
    score: number;
    team: string;
  }>(
    `SELECT m.id, m.mode, m.map_id, m.winner_team, m.duration_sec, m.ended_at,
            mp.kills, mp.deaths, mp.score, mp.team
     FROM match_participants mp
     JOIN matches m ON m.id = mp.match_id
     WHERE mp.user_id = ?
     ORDER BY m.ended_at DESC
     LIMIT 25`,
    [userId]
  );

  return rows.map((r) => ({
    id: r.id,
    mode: r.mode as MatchRecord['mode'],
    mapId: r.map_id as MatchRecord['mapId'],
    winnerTeam: r.winner_team as MatchRecord['winnerTeam'],
    durationSec: r.duration_sec,
    endedAt: r.ended_at,
    playerKills: r.kills,
    playerDeaths: r.deaths,
    playerScore: r.score,
    playerTeam: r.team as MatchRecord['playerTeam'],
  }));
}

export function getLeaderboard(
  scope: 'global' | 'friends' | 'weekly' | 'monthly' | 'ranked',
  viewerId?: string
): LeaderboardEntry[] {
  let rows: Array<Record<string, SqlValue>> = [];

  if (scope === 'friends' && viewerId) {
    rows = queryAll(
      `SELECT u.id, u.username, u.level, u.kills, u.deaths, u.wins, u.ranked_elo, u.headshots,
              (SELECT c.tag FROM clan_members cm JOIN clans c ON c.id = cm.clan_id WHERE cm.user_id = u.id) as clan_tag
       FROM users u
       WHERE u.id = ? OR u.id IN (
         SELECT CASE WHEN user_a = ? THEN user_b ELSE user_a END
         FROM friendships
         WHERE (user_a = ? OR user_b = ?) AND status = 'accepted'
       )
       ORDER BY u.kills DESC, u.wins DESC
       LIMIT 50`,
      [viewerId, viewerId, viewerId, viewerId]
    );
  } else if (scope === 'weekly' || scope === 'monthly') {
    const days = scope === 'weekly' ? 7 : 30;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    rows = queryAll(
      `SELECT u.id, u.username, u.level,
              COALESCE(SUM(mp.kills), 0) as kills,
              COALESCE(SUM(mp.deaths), 0) as deaths,
              u.wins, u.ranked_elo,
              COALESCE(SUM(mp.headshots), 0) as headshots,
              (SELECT c.tag FROM clan_members cm JOIN clans c ON c.id = cm.clan_id WHERE cm.user_id = u.id) as clan_tag
       FROM users u
       LEFT JOIN match_participants mp ON mp.user_id = u.id
       LEFT JOIN matches m ON m.id = mp.match_id AND m.ended_at >= ?
       WHERE u.banned = 0
       GROUP BY u.id
       ORDER BY kills DESC, u.ranked_elo DESC
       LIMIT 50`,
      [cutoff]
    );
  } else {
    const orderBy = scope === 'ranked' ? 'u.ranked_elo DESC, u.wins DESC' : 'u.kills DESC, u.wins DESC';
    rows = queryAll(
      `SELECT u.id, u.username, u.level, u.kills, u.deaths, u.wins, u.ranked_elo, u.headshots,
              (SELECT c.tag FROM clan_members cm JOIN clans c ON c.id = cm.clan_id WHERE cm.user_id = u.id) as clan_tag
       FROM users u
       WHERE u.banned = 0
       ORDER BY ${orderBy}
       LIMIT 50`
    );
  }

  return rows.map((r, idx) => ({
    rank: idx + 1,
    userId: String(r.id),
    username: String(r.username),
    level: Number(r.level),
    kills: Number(r.kills),
    deaths: Number(r.deaths),
    wins: Number(r.wins),
    rankedElo: Number(r.ranked_elo),
    headshots: Number(r.headshots),
    clanTag: r.clan_tag ? String(r.clan_tag) : null,
  }));
}
