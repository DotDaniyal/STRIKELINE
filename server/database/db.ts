import initSqlJs, { type Database, type SqlValue } from 'sql.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type {
  ChallengeEntry,
  FriendEntry,
  LeaderboardEntry,
  LoadoutConfig,
  MatchRecord,
  NewsItem,
  PlayerSettings,
  UserProfile,
} from '../../shared/types/game.ts';
import { DEFAULT_SETTINGS } from '../../shared/constants/modes.ts';
import { CHALLENGE_TEMPLATES, COSMETIC_CATALOG } from '../../shared/constants/catalog.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'strikeline.db');

let db: Database;
let saveTimer: NodeJS.Timeout | null = null;

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    persistNow();
  }, 400);
}

export function persistNow() {
  if (!db) return;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const data = db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  } catch (err) {
    console.error('Failed to persist SQLite database:', err);
  }
}

export function xpRequiredForLevel(level: number): number {
  return Math.floor(500 + (level - 1) * 280 + Math.pow(level - 1, 1.35) * 90);
}

function defaultLoadouts(): LoadoutConfig[] {
  return [
    {
      id: 'loadout_1',
      name: 'Assault Breacher',
      primaryWeapon: 'vanguard_ar',
      secondaryWeapon: 'viper_pistol',
      weaponSkins: { vanguard_ar: 'skin_standard_matte', viper_pistol: 'skin_standard_matte' },
      operatorSkin: 'op_slate_vanguard',
      sprayId: 'spray_strikeline',
    },
    {
      id: 'loadout_2',
      name: 'Recon Sniper',
      primaryWeapon: 'longshot_sr',
      secondaryWeapon: 'viper_pistol',
      weaponSkins: { longshot_sr: 'skin_standard_matte', viper_pistol: 'skin_standard_matte' },
      operatorSkin: 'op_slate_vanguard',
      sprayId: 'spray_strikeline',
    },
    {
      id: 'loadout_3',
      name: 'CQB Rusher',
      primaryWeapon: 'spectre_smg',
      secondaryWeapon: 'viper_pistol',
      weaponSkins: { spectre_smg: 'skin_standard_matte', viper_pistol: 'skin_standard_matte' },
      operatorSkin: 'op_slate_vanguard',
      sprayId: 'spray_strikeline',
    },
  ];
}

function queryAll<T = Record<string, SqlValue>>(sql: string, params: SqlValue[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

function queryOne<T = Record<string, SqlValue>>(sql: string, params: SqlValue[] = []): T | null {
  const rows = queryAll<T>(sql, params);
  return rows[0] ?? null;
}

function execSql(sql: string, params: SqlValue[] = []) {
  db.run(sql, params);
  scheduleSave();
}

export async function initDatabase() {
  const SQL = await initSqlJs();
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (fs.existsSync(DB_PATH)) {
    const fileBuf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuf);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE COLLATE NOCASE,
      email TEXT UNIQUE COLLATE NOCASE,
      password_hash TEXT,
      is_guest INTEGER NOT NULL DEFAULT 0,
      role TEXT NOT NULL DEFAULT 'player',
      level INTEGER NOT NULL DEFAULT 1,
      xp INTEGER NOT NULL DEFAULT 0,
      credits INTEGER NOT NULL DEFAULT 500,
      kills INTEGER NOT NULL DEFAULT 0,
      deaths INTEGER NOT NULL DEFAULT 0,
      assists INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      headshots INTEGER NOT NULL DEFAULT 0,
      damage_dealt INTEGER NOT NULL DEFAULT 0,
      shots_fired INTEGER NOT NULL DEFAULT 0,
      shots_hit INTEGER NOT NULL DEFAULT 0,
      playtime_sec INTEGER NOT NULL DEFAULT 0,
      ranked_elo INTEGER NOT NULL DEFAULT 1000,
      equipped_operator TEXT NOT NULL DEFAULT 'op_slate_vanguard',
      equipped_spray TEXT NOT NULL DEFAULT 'spray_strikeline',
      active_loadout_id TEXT NOT NULL DEFAULT 'loadout_1',
      loadouts_json TEXT NOT NULL,
      settings_json TEXT NOT NULL,
      banned INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inventory (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_id TEXT NOT NULL,
      acquired_at TEXT NOT NULL,
      PRIMARY KEY (user_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      mode TEXT NOT NULL,
      map_id TEXT NOT NULL,
      winner_team TEXT NOT NULL,
      duration_sec INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS match_participants (
      match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      team TEXT NOT NULL,
      kills INTEGER NOT NULL,
      deaths INTEGER NOT NULL,
      assists INTEGER NOT NULL,
      score INTEGER NOT NULL,
      headshots INTEGER NOT NULL,
      damage INTEGER NOT NULL,
      accuracy REAL NOT NULL,
      PRIMARY KEY (match_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS friendships (
      id TEXT PRIMARY KEY,
      user_a TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_b TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      requester_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS blocks (
      blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL,
      PRIMARY KEY (blocker_id, blocked_id)
    );

    CREATE TABLE IF NOT EXISTS challenge_progress (
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      challenge_id TEXT NOT NULL,
      reset_key TEXT NOT NULL,
      progress INTEGER NOT NULL DEFAULT 0,
      completed INTEGER NOT NULL DEFAULT 0,
      claimed INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, challenge_id, reset_key)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      reporter_id TEXT NOT NULL,
      target_username TEXT NOT NULL,
      reason TEXT NOT NULL,
      details TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS news (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      version TEXT NOT NULL,
      summary TEXT NOT NULL,
      body TEXT NOT NULL,
      published_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clans (
      id TEXT PRIMARY KEY,
      tag TEXT NOT NULL UNIQUE COLLATE NOCASE,
      name TEXT NOT NULL UNIQUE,
      owner_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clan_members (
      clan_id TEXT NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT NOT NULL,
      PRIMARY KEY (clan_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS tournaments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mode TEXT NOT NULL,
      map_id TEXT NOT NULL,
      max_teams INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      organizer_id TEXT NOT NULL,
      participants_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Seed initial patch notes / news if empty
  const newsCount = queryOne<{ c: number }>('SELECT COUNT(*) as c FROM news');
  if (!newsCount || newsCount.c === 0) {
    const initialNews: NewsItem[] = [
      {
        id: 'news_launch_100',
        title: 'Season 1: Foundry Protocol Live',
        category: 'Patch Notes',
        version: '1.0.0',
        summary: '6 competitive arenas, 7 tuned weapons, 8 game modes, and 25Hz authoritative multiplayer servers are now active.',
        body: 'Welcome to STRIKELINE Season 1. Drop into Foundry, Crossroads, Dustbasin, Cargo Depot, Bastion Yard, and Apex Arena across Free For All, Team Deathmatch, Hardpoint, Domination, Kill Confirmed, Capture the Flag, and 2v2 Ranked.',
        publishedAt: new Date().toISOString(),
      },
      {
        id: 'news_movement_update',
        title: 'Ballistics & Slide Momentum Tuning',
        category: 'Competitive',
        version: '1.0.1',
        summary: 'Refined directional slide-jump friction and headshot hit-registration accuracy.',
        body: 'Slide-jumping now preserves clean horizontal momentum with fair speed validation on authoritative servers. All 7 weapons have calibrated vertical recoil recovery and distance falloff curves.',
        publishedAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'news_training_range',
        title: 'Proving Grounds & Aim Trainer',
        category: 'Announcement',
        version: '1.0.2',
        summary: 'Test recoil patterns, practice flick shots, and benchmark tracking accuracy in the interactive range.',
        body: 'Launch Proving Grounds from the top navigation bar to dial in your custom crosshair, ADS zoom sensitivity, and weapon recoil control against reactive strafing targets.',
        publishedAt: new Date(Date.now() - 172800000).toISOString(),
      },
    ];
    for (const n of initialNews) {
      execSql(
        `INSERT INTO news (id, title, category, version, summary, body, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [n.id, n.title, n.category, n.version, n.summary, n.body, n.publishedAt]
      );
    }
  }

  persistNow();
}

function hydrateProfile(row: Record<string, SqlValue>): UserProfile {
  const userId = String(row.id);
  const invRows = queryAll<{ item_id: string }>('SELECT item_id FROM inventory WHERE user_id = ?', [userId]);
  const clanRow = queryOne<{ tag: string }>(
    'SELECT c.tag FROM clan_members cm JOIN clans c ON c.id = cm.clan_id WHERE cm.user_id = ?',
    [userId]
  );

  let loadouts: LoadoutConfig[];
  try {
    loadouts = JSON.parse(String(row.loadouts_json));
  } catch {
    loadouts = defaultLoadouts();
  }

  let settings: PlayerSettings;
  try {
    const parsed = JSON.parse(String(row.settings_json));
    settings = {
      ...DEFAULT_SETTINGS,
      ...parsed,
      crosshair: { ...DEFAULT_SETTINGS.crosshair, ...(parsed.crosshair || {}) },
      keybinds: { ...DEFAULT_SETTINGS.keybinds, ...(parsed.keybinds || {}) },
    };
  } catch {
    settings = DEFAULT_SETTINGS;
  }

  const level = Number(row.level);

  return {
    id: userId,
    username: String(row.username),
    email: row.email ? String(row.email) : null,
    isGuest: Boolean(row.is_guest),
    role: (String(row.role) as UserProfile['role']) || 'player',
    level,
    xp: Number(row.xp),
    xpToNext: xpRequiredForLevel(level),
    credits: Number(row.credits),
    kills: Number(row.kills),
    deaths: Number(row.deaths),
    assists: Number(row.assists),
    wins: Number(row.wins),
    losses: Number(row.losses),
    headshots: Number(row.headshots),
    damageDealt: Number(row.damage_dealt),
    shotsFired: Number(row.shots_fired),
    shotsHit: Number(row.shots_hit),
    playtimeSec: Number(row.playtime_sec),
    rankedElo: Number(row.ranked_elo),
    clanTag: clanRow?.tag ?? null,
    equippedOperator: String(row.equipped_operator),
    equippedSpray: String(row.equipped_spray),
    activeLoadoutId: String(row.active_loadout_id),
    inventory: invRows.map((r) => r.item_id),
    loadouts,
    settings,
  };
}

function grantStarterInventory(userId: string) {
  const now = new Date().toISOString();
  const starters = ['skin_standard_matte', 'op_slate_vanguard', 'spray_strikeline'];
  for (const itemId of starters) {
    execSql('INSERT OR IGNORE INTO inventory (user_id, item_id, acquired_at) VALUES (?, ?, ?)', [
      userId,
      itemId,
      now,
    ]);
  }
}

export function createSession(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 14;
  execSql('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)', [token, userId, expiresAt]);
  return token;
}

export function getUserBySession(token: string): UserProfile | null {
  if (!token) return null;
  const session = queryOne<{ user_id: string; expires_at: number }>(
    'SELECT user_id, expires_at FROM sessions WHERE token = ?',
    [token]
  );
  if (!session) return null;
  if (session.expires_at < Date.now()) {
    execSql('DELETE FROM sessions WHERE token = ?', [token]);
    return null;
  }
  const user = queryOne('SELECT * FROM users WHERE id = ? AND banned = 0', [session.user_id]);
  if (!user) return null;
  return hydrateProfile(user);
}

export function deleteSession(token: string) {
  execSql('DELETE FROM sessions WHERE token = ?', [token]);
}

export function getUserById(userId: string): UserProfile | null {
  const row = queryOne('SELECT * FROM users WHERE id = ?', [userId]);
  return row ? hydrateProfile(row) : null;
}

export function registerAccount(username: string, email: string, password: string): { profile: UserProfile; token: string } {
  const cleanUser = username.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (!/^[a-zA-Z0-9_-]{3,16}$/.test(cleanUser)) {
    throw new Error('Username must be 3–16 alphanumeric, underscore, or dash characters.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Please enter a valid email address.');
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const existing = queryOne('SELECT id FROM users WHERE username = ? OR email = ?', [cleanUser, cleanEmail]);
  if (existing) {
    throw new Error('Username or email is already registered.');
  }

  const countRow = queryOne<{ c: number }>('SELECT COUNT(*) as c FROM users WHERE is_guest = 0');
  const isFirstAccount = !countRow || countRow.c === 0;

  const id = 'usr_' + crypto.randomUUID();
  const passwordHash = bcrypt.hashSync(password, 10);
  const now = new Date().toISOString();

  execSql(
    `INSERT INTO users (id, username, email, password_hash, is_guest, role, credits, loadouts_json, settings_json, created_at)
     VALUES (?, ?, ?, ?, 0, ?, 750, ?, ?, ?)`,
    [
      id,
      cleanUser,
      cleanEmail,
      passwordHash,
      isFirstAccount ? 'admin' : 'player',
      JSON.stringify(defaultLoadouts()),
      JSON.stringify(DEFAULT_SETTINGS),
      now,
    ]
  );
  grantStarterInventory(id);
  const token = createSession(id);
  const profile = getUserById(id)!;
  return { profile, token };
}

export function loginAccount(identifier: string, password: string): { profile: UserProfile; token: string } {
  const clean = identifier.trim();
  const row = queryOne('SELECT * FROM users WHERE username = ? OR email = ?', [clean, clean.toLowerCase()]);
  if (!row || !row.password_hash) {
    throw new Error('Invalid credentials.');
  }
  if (Number(row.banned) === 1) {
    throw new Error('This account has been suspended.');
  }
  if (!bcrypt.compareSync(password, String(row.password_hash))) {
    throw new Error('Invalid credentials.');
  }
  const userId = String(row.id);
  const token = createSession(userId);
  return { profile: hydrateProfile(row), token };
}

export function createGuestAccount(preferredName?: string): { profile: UserProfile; token: string } {
  const suffix = Math.floor(1000 + Math.random() * 8999);
  let base = (preferredName || 'Operative').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 10) || 'Operative';
  let username = `${base}_${suffix}`;
  while (queryOne('SELECT id FROM users WHERE username = ?', [username])) {
    username = `${base}_${Math.floor(1000 + Math.random() * 8999)}`;
  }

  const id = 'gst_' + crypto.randomUUID();
  const now = new Date().toISOString();
  execSql(
    `INSERT INTO users (id, username, email, password_hash, is_guest, role, credits, loadouts_json, settings_json, created_at)
     VALUES (?, ?, NULL, NULL, 1, 'player', 500, ?, ?, ?)`,
    [id, username, JSON.stringify(defaultLoadouts()), JSON.stringify(DEFAULT_SETTINGS), now]
  );
  grantStarterInventory(id);
  const token = createSession(id);
  return { profile: getUserById(id)!, token };
}

export function upgradeGuestAccount(userId: string, username: string, email: string, password: string): UserProfile {
  const user = queryOne('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user || !user.is_guest) {
    throw new Error('Only guest accounts can be upgraded.');
  }
  const cleanUser = username.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (!/^[a-zA-Z0-9_-]{3,16}$/.test(cleanUser)) {
    throw new Error('Username must be 3–16 alphanumeric, underscore, or dash characters.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    throw new Error('Invalid email address.');
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }
  const conflict = queryOne('SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?', [
    cleanUser,
    cleanEmail,
    userId,
  ]);
  if (conflict) {
    throw new Error('Username or email already in use.');
  }
  const hash = bcrypt.hashSync(password, 10);
  execSql(
    'UPDATE users SET username = ?, email = ?, password_hash = ?, is_guest = 0, credits = credits + 250 WHERE id = ?',
    [cleanUser, cleanEmail, hash, userId]
  );
  return getUserById(userId)!;
}

export function requestPasswordReset(email: string): { resetToken: string } {
  const cleanEmail = email.trim().toLowerCase();
  const user = queryOne<{ id: string }>('SELECT id FROM users WHERE email = ?', [cleanEmail]);
  if (!user) {
    throw new Error('No registered account found with that email.');
  }
  const resetToken = crypto.randomBytes(6).toString('hex').toUpperCase();
  const expiresAt = Date.now() + 1000 * 60 * 15;
  execSql('INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)', [
    resetToken,
    user.id,
    expiresAt,
  ]);
  return { resetToken };
}

export function completePasswordReset(token: string, newPassword: string) {
  if (newPassword.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }
  const row = queryOne<{ user_id: string; expires_at: number }>(
    'SELECT user_id, expires_at FROM password_resets WHERE token = ?',
    [token.trim().toUpperCase()]
  );
  if (!row || row.expires_at < Date.now()) {
    throw new Error('Invalid or expired verification token.');
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  execSql('UPDATE users SET password_hash = ? WHERE id = ?', [hash, row.user_id]);
  execSql('DELETE FROM password_resets WHERE token = ?', [token.trim().toUpperCase()]);
}

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

export function getFriendsForUser(
  userId: string,
  presenceLookup: (uid: string) => { online: boolean; status: FriendEntry['status']; roomCode?: string }
): FriendEntry[] {
  const rows = queryAll<{
    id: string;
    user_a: string;
    user_b: string;
    requester_id: string;
    status: string;
  }>('SELECT * FROM friendships WHERE user_a = ? OR user_b = ?', [userId, userId]);

  const entries: FriendEntry[] = [];
  for (const r of rows) {
    const otherId = r.user_a === userId ? r.user_b : r.user_a;
    const other = queryOne<{ id: string; username: string; level: number }>(
      'SELECT id, username, level FROM users WHERE id = ?',
      [otherId]
    );
    if (!other) continue;
    const pres = presenceLookup(otherId);
    const relationship: FriendEntry['relationship'] =
      r.status === 'accepted'
        ? 'accepted'
        : r.requester_id === userId
        ? 'pending_outgoing'
        : 'pending_incoming';
    entries.push({
      id: other.id,
      username: other.username,
      level: other.level,
      online: pres.online,
      status: pres.status,
      relationship,
      roomCode: pres.roomCode,
    });
  }
  return entries;
}

export function sendFriendRequest(fromUserId: string, targetUsername: string) {
  const target = queryOne<{ id: string }>('SELECT id FROM users WHERE username = ?', [targetUsername.trim()]);
  if (!target) throw new Error('Operator not found.');
  if (target.id === fromUserId) throw new Error('Cannot add yourself.');

  const blocked = queryOne('SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?', [target.id, fromUserId]);
  if (blocked) throw new Error('Unable to send request to this player.');

  const [a, b] = [fromUserId, target.id].sort();
  const existing = queryOne<{ id: string; status: string }>(
    'SELECT id, status FROM friendships WHERE user_a = ? AND user_b = ?',
    [a, b]
  );
  if (existing) {
    if (existing.status === 'accepted') throw new Error('Already friends.');
    throw new Error('Friend request already pending.');
  }

  execSql(
    'INSERT INTO friendships (id, user_a, user_b, requester_id, status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    ['fr_' + crypto.randomUUID(), a, b, fromUserId, 'pending', new Date().toISOString()]
  );
}

export function respondFriendRequest(userId: string, otherUserId: string, accept: boolean) {
  const [a, b] = [userId, otherUserId].sort();
  if (accept) {
    execSql('UPDATE friendships SET status = ? WHERE user_a = ? AND user_b = ?', ['accepted', a, b]);
  } else {
    execSql('DELETE FROM friendships WHERE user_a = ? AND user_b = ?', [a, b]);
  }
}

export function removeFriend(userId: string, otherUserId: string) {
  const [a, b] = [userId, otherUserId].sort();
  execSql('DELETE FROM friendships WHERE user_a = ? AND user_b = ?', [a, b]);
}

export function blockUser(blockerId: string, targetUsername: string) {
  const target = queryOne<{ id: string }>('SELECT id FROM users WHERE username = ?', [targetUsername.trim()]);
  if (!target) throw new Error('User not found.');
  execSql('INSERT OR IGNORE INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)', [
    blockerId,
    target.id,
    new Date().toISOString(),
  ]);
  removeFriend(blockerId, target.id);
}

export function getBlockedIds(userId: string): string[] {
  return queryAll<{ blocked_id: string }>('SELECT blocked_id FROM blocks WHERE blocker_id = ?', [userId]).map(
    (r) => r.blocked_id
  );
}

export function submitReport(reporterId: string, targetUsername: string, reason: string, details: string) {
  const id = 'rep_' + crypto.randomUUID();
  execSql(
    'INSERT INTO reports (id, reporter_id, target_username, reason, details, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, reporterId, targetUsername.trim(), reason.trim(), details.trim().slice(0, 500), 'open', new Date().toISOString()]
  );
  recordAudit(reporterId, 'player_report', `Reported ${targetUsername}: ${reason}`);
}

export function getNewsList(): NewsItem[] {
  return queryAll<{
    id: string;
    title: string;
    category: string;
    version: string;
    summary: string;
    body: string;
    published_at: string;
  }>('SELECT * FROM news ORDER BY published_at DESC LIMIT 20').map((n) => ({
    id: n.id,
    title: n.title,
    category: n.category as NewsItem['category'],
    version: n.version,
    summary: n.summary,
    body: n.body,
    publishedAt: n.published_at,
  }));
}

export function publishNews(actorId: string, title: string, category: string, version: string, summary: string, body: string) {
  const id = 'news_' + crypto.randomUUID();
  execSql(
    'INSERT INTO news (id, title, category, version, summary, body, published_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, title, category, version, summary, body, new Date().toISOString()]
  );
  recordAudit(actorId, 'news_published', `Published ${title} (${version})`);
}

export function recordAudit(actorId: string, action: string, details: string) {
  execSql('INSERT INTO audit_logs (id, actor_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)', [
    'aud_' + crypto.randomUUID(),
    actorId,
    action,
    details,
    new Date().toISOString(),
  ]);
}

export function getAdminOverview() {
  const users = queryAll<{
    id: string;
    username: string;
    role: string;
    level: number;
    kills: number;
    deaths: number;
    credits: number;
    banned: number;
    created_at: string;
  }>('SELECT id, username, role, level, kills, deaths, credits, banned, created_at FROM users ORDER BY created_at DESC LIMIT 100');
  const reports = queryAll('SELECT * FROM reports ORDER BY created_at DESC LIMIT 50');
  const auditLogs = queryAll('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50');
  return { users, reports, auditLogs };
}

export function setReportStatus(actorId: string, reportId: string, status: 'open' | 'reviewed' | 'resolved') {
  execSql('UPDATE reports SET status = ? WHERE id = ?', [status, reportId]);
  recordAudit(actorId, 'report_status', `Set report ${reportId} to ${status}`);
}

export function setUserBanned(actorId: string, targetUserId: string, banned: boolean) {
  execSql('UPDATE users SET banned = ? WHERE id = ?', [banned ? 1 : 0, targetUserId]);
  recordAudit(actorId, banned ? 'ban_user' : 'unban_user', `User ${targetUserId}`);
}

export function createClan(userId: string, tag: string, name: string) {
  const cleanTag = tag.trim().toUpperCase();
  const cleanName = name.trim();
  if (!/^[A-Z0-9]{2,5}$/.test(cleanTag)) throw new Error('Clan tag must be 2–5 alphanumeric characters.');
  if (cleanName.length < 3 || cleanName.length > 24) throw new Error('Clan name must be 3–24 characters.');

  const existingMember = queryOne('SELECT clan_id FROM clan_members WHERE user_id = ?', [userId]);
  if (existingMember) throw new Error('Leave your current clan before creating a new one.');

  const id = 'cln_' + crypto.randomUUID();
  const now = new Date().toISOString();
  execSql('INSERT INTO clans (id, tag, name, owner_id, created_at) VALUES (?, ?, ?, ?, ?)', [
    id,
    cleanTag,
    cleanName,
    userId,
    now,
  ]);
  execSql('INSERT INTO clan_members (clan_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)', [
    id,
    userId,
    'owner',
    now,
  ]);
}

export function joinClan(userId: string, tag: string) {
  const clan = queryOne<{ id: string }>('SELECT id FROM clans WHERE tag = ?', [tag.trim().toUpperCase()]);
  if (!clan) throw new Error('Clan tag not found.');
  const existing = queryOne('SELECT clan_id FROM clan_members WHERE user_id = ?', [userId]);
  if (existing) throw new Error('You are already in a clan.');
  execSql('INSERT INTO clan_members (clan_id, user_id, role, joined_at) VALUES (?, ?, ?, ?)', [
    clan.id,
    userId,
    'member',
    new Date().toISOString(),
  ]);
}

export function leaveClan(userId: string) {
  execSql('DELETE FROM clan_members WHERE user_id = ?', [userId]);
}

export function getClans() {
  return queryAll(
    `SELECT c.id, c.tag, c.name, c.owner_id, COUNT(cm.user_id) as member_count
     FROM clans c
     LEFT JOIN clan_members cm ON cm.clan_id = c.id
     GROUP BY c.id
     ORDER BY member_count DESC LIMIT 30`
  );
}

export function getTournaments() {
  return queryAll('SELECT * FROM tournaments ORDER BY created_at DESC LIMIT 20').map((t) => ({
    ...t,
    participants: JSON.parse(String(t.participants_json || '[]')),
  }));
}

export function createTournament(organizerId: string, name: string, mode: string, mapId: string, maxTeams: number) {
  const id = 'trn_' + crypto.randomUUID();
  execSql(
    'INSERT INTO tournaments (id, name, mode, map_id, max_teams, status, organizer_id, participants_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [id, name.trim().slice(0, 40), mode, mapId, maxTeams, 'open', organizerId, '[]', new Date().toISOString()]
  );
  return id;
}

export function registerForTournament(tournamentId: string, username: string) {
  const t = queryOne<{ participants_json: string; max_teams: number }>('SELECT participants_json, max_teams FROM tournaments WHERE id = ?', [
    tournamentId,
  ]);
  if (!t) throw new Error('Tournament not found.');
  const list: string[] = JSON.parse(t.participants_json);
  if (list.includes(username)) throw new Error('Already registered.');
  if (list.length >= t.max_teams) throw new Error('Tournament bracket is full.');
  list.push(username);
  execSql('UPDATE tournaments SET participants_json = ? WHERE id = ?', [JSON.stringify(list), tournamentId]);
}
