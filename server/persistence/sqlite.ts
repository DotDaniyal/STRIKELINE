import initSqlJs, { type Database, type SqlValue } from 'sql.js';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { NewsItem } from '../../shared/types/game.ts';

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

export function queryAll<T = Record<string, SqlValue>>(sql: string, params: SqlValue[] = []): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: T[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T);
  }
  stmt.free();
  return rows;
}

export function queryOne<T = Record<string, SqlValue>>(sql: string, params: SqlValue[] = []): T | null {
  const rows = queryAll<T>(sql, params);
  return rows[0] ?? null;
}

export function execSql(sql: string, params: SqlValue[] = []) {
  db.run(sql, params);
  scheduleSave();
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
