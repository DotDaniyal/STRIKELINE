import crypto from 'crypto';
import type { FriendEntry, NewsItem } from '../../shared/types/game.ts';
import { execSql, queryAll, queryOne, recordAudit } from './sqlite.ts';

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
