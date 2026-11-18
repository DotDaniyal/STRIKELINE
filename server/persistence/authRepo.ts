import type { SqlValue } from 'sql.js';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import type { LoadoutConfig, PlayerSettings, UserProfile } from '../../shared/types/game.ts';
import { DEFAULT_SETTINGS } from '../../shared/constants/modes.ts';
import { execSql, queryAll, queryOne } from './sqlite.ts';

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
  const base = (preferredName || 'Operative').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 10) || 'Operative';
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
