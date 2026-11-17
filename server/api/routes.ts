import express, { type NextFunction, type Request, type Response } from 'express';
import type { UserProfile } from '../../shared/types/game.ts';
import { COSMETIC_CATALOG } from '../../shared/constants/catalog.ts';
import {
  blockUser,
  claimChallengeReward,
  completePasswordReset,
  createClan,
  createGuestAccount,
  createTournament,
  deleteSession,
  getAdminOverview,
  getClans,
  getFriendsForUser,
  getLeaderboard,
  getMatchHistoryForUser,
  getNewsList,
  getTournaments,
  getUserById,
  getUserBySession,
  getUserChallenges,
  joinClan,
  leaveClan,
  loginAccount,
  publishNews,
  purchaseShopItem,
  registerAccount,
  registerForTournament,
  removeFriend,
  requestPasswordReset,
  respondFriendRequest,
  sendFriendRequest,
  setReportStatus,
  setUserBanned,
  submitReport,
  updateUserLoadouts,
  updateUserSettings,
  upgradeGuestAccount,
} from '../database/db.ts';
import type { RoomManager } from '../game/RoomManager.ts';

interface AuthReq extends Request {
  user?: UserProfile;
  token?: string;
}

// Simple in-memory rate limiter
const rateMap = new Map<string, { count: number; resetAt: number }>();
function rateLimit(maxPerMin = 120) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const rec = rateMap.get(key);
    if (!rec || now > rec.resetAt) {
      rateMap.set(key, { count: 1, resetAt: now + 60000 });
      return next();
    }
    rec.count += 1;
    if (rec.count > maxPerMin) {
      return res.status(429).json({ error: 'Rate limit exceeded. Please wait a moment.' });
    }
    next();
  };
}

function requireAuth(req: AuthReq, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  const user = getUserBySession(token);
  if (!user) {
    return res.status(401).json({ error: 'Session expired or invalid.' });
  }
  req.user = user;
  req.token = token;
  next();
}

function requireAdmin(req: AuthReq, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'moderator')) {
    return res.status(403).json({ error: 'Administrator privileges required.' });
  }
  next();
}

export function createApiRouter(roomManager: RoomManager) {
  const router = express.Router();
  router.use(rateLimit(180));

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Authentication
  router.post('/v1/auth/register', (req, res) => {
    try {
      const { username, email, password } = req.body || {};
      const result = registerAccount(String(username || ''), String(email || ''), String(password || ''));
      res.json(result);
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Registration failed.' });
    }
  });

  router.post('/v1/auth/login', (req, res) => {
    try {
      const { identifier, password } = req.body || {};
      const result = loginAccount(String(identifier || ''), String(password || ''));
      res.json(result);
    } catch (err: unknown) {
      res.status(401).json({ error: err instanceof Error ? err.message : 'Login failed.' });
    }
  });

  router.post('/v1/auth/guest', (req, res) => {
    try {
      const { preferredName } = req.body || {};
      const result = createGuestAccount(typeof preferredName === 'string' ? preferredName : undefined);
      res.json(result);
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Guest creation failed.' });
    }
  });

  router.post('/v1/auth/upgrade-guest', requireAuth, (req: AuthReq, res) => {
    try {
      const { username, email, password } = req.body || {};
      const profile = upgradeGuestAccount(
        req.user!.id,
        String(username || ''),
        String(email || ''),
        String(password || '')
      );
      res.json({ profile });
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Upgrade failed.' });
    }
  });

  router.post('/v1/auth/logout', requireAuth, (req: AuthReq, res) => {
    if (req.token) deleteSession(req.token);
    res.json({ ok: true });
  });

  router.post('/v1/auth/password-reset/request', (req, res) => {
    try {
      const { email } = req.body || {};
      const { resetToken } = requestPasswordReset(String(email || ''));
      res.json({
        message: 'Verification token generated.',
        resetToken, // Delivered directly in local/sandbox environment where SMTP is unconfigured
      });
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Reset request failed.' });
    }
  });

  router.post('/v1/auth/password-reset/complete', (req, res) => {
    try {
      const { token, newPassword } = req.body || {};
      completePasswordReset(String(token || ''), String(newPassword || ''));
      res.json({ ok: true });
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Reset failed.' });
    }
  });

  // Profile & Settings
  router.get('/v1/me', requireAuth, (req: AuthReq, res) => {
    res.json({ profile: req.user });
  });

  router.put('/v1/me/settings', requireAuth, (req: AuthReq, res) => {
    try {
      const profile = updateUserSettings(req.user!.id, req.body.settings);
      res.json({ profile });
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save settings.' });
    }
  });

  router.put('/v1/me/loadouts', requireAuth, (req: AuthReq, res) => {
    try {
      const { loadouts, activeLoadoutId, equippedOperator, equippedSpray } = req.body || {};
      const profile = updateUserLoadouts(
        req.user!.id,
        loadouts,
        activeLoadoutId,
        equippedOperator,
        equippedSpray
      );
      roomManager.refreshClientLoadout(profile);
      res.json({ profile });
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to save loadout.' });
    }
  });

  router.get('/v1/players/:userId', (req, res) => {
    const profile = getUserById(req.params.userId);
    if (!profile) return res.status(404).json({ error: 'Player not found.' });
    res.json({
      id: profile.id,
      username: profile.username,
      level: profile.level,
      kills: profile.kills,
      deaths: profile.deaths,
      wins: profile.wins,
      losses: profile.losses,
      headshots: profile.headshots,
      rankedElo: profile.rankedElo,
      clanTag: profile.clanTag,
      equippedOperator: profile.equippedOperator,
    });
  });

  // Match History & Live Rooms
  router.get('/v1/me/matches', requireAuth, (req: AuthReq, res) => {
    res.json({ matches: getMatchHistoryForUser(req.user!.id) });
  });

  router.get('/v1/rooms', (_req, res) => {
    const rooms = roomManager.getPublicRooms().filter((r) => !r.isPrivate);
    res.json({ rooms });
  });

  // Shop & Locker
  router.get('/v1/shop', (_req, res) => {
    res.json({ items: COSMETIC_CATALOG });
  });

  router.post('/v1/shop/purchase', requireAuth, (req: AuthReq, res) => {
    try {
      const { itemId } = req.body || {};
      const profile = purchaseShopItem(req.user!.id, String(itemId || ''));
      res.json({ profile });
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Purchase failed.' });
    }
  });

  // Challenges
  router.get('/v1/challenges', requireAuth, (req: AuthReq, res) => {
    res.json({ challenges: getUserChallenges(req.user!.id) });
  });

  router.post('/v1/challenges/:id/claim', requireAuth, (req: AuthReq, res) => {
    try {
      const profile = claimChallengeReward(req.user!.id, req.params.id);
      res.json({ profile, challenges: getUserChallenges(req.user!.id) });
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Claim failed.' });
    }
  });

  // Leaderboards
  router.get('/v1/leaderboards/:scope', (req: AuthReq, res) => {
    const scope = req.params.scope as 'global' | 'friends' | 'weekly' | 'monthly' | 'ranked';
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    const viewer = token ? getUserBySession(token) : null;
    res.json({ entries: getLeaderboard(scope, viewer?.id) });
  });

  // Friends, Blocks, Reports
  router.get('/v1/friends', requireAuth, (req: AuthReq, res) => {
    const friends = getFriendsForUser(req.user!.id, (uid) => roomManager.getPresence(uid));
    res.json({ friends });
  });

  router.post('/v1/friends/request', requireAuth, (req: AuthReq, res) => {
    try {
      sendFriendRequest(req.user!.id, String(req.body?.username || ''));
      res.json({ ok: true });
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Request failed.' });
    }
  });

  router.post('/v1/friends/respond', requireAuth, (req: AuthReq, res) => {
    respondFriendRequest(req.user!.id, String(req.body?.userId || ''), Boolean(req.body?.accept));
    res.json({ ok: true });
  });

  router.delete('/v1/friends/:userId', requireAuth, (req: AuthReq, res) => {
    removeFriend(req.user!.id, req.params.userId);
    res.json({ ok: true });
  });

  router.post('/v1/social/block', requireAuth, (req: AuthReq, res) => {
    try {
      blockUser(req.user!.id, String(req.body?.username || ''));
      res.json({ ok: true });
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Block failed.' });
    }
  });

  router.post('/v1/reports', requireAuth, (req: AuthReq, res) => {
    const { targetUsername, reason, details } = req.body || {};
    submitReport(req.user!.id, String(targetUsername || ''), String(reason || 'Unsportsmanlike'), String(details || ''));
    res.json({ ok: true });
  });

  // Clans & Tournaments
  router.get('/v1/clans', (_req, res) => {
    res.json({ clans: getClans() });
  });

  router.post('/v1/clans', requireAuth, (req: AuthReq, res) => {
    try {
      createClan(req.user!.id, String(req.body?.tag || ''), String(req.body?.name || ''));
      res.json({ profile: getUserById(req.user!.id), clans: getClans() });
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create clan.' });
    }
  });

  router.post('/v1/clans/join', requireAuth, (req: AuthReq, res) => {
    try {
      joinClan(req.user!.id, String(req.body?.tag || ''));
      res.json({ profile: getUserById(req.user!.id), clans: getClans() });
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to join clan.' });
    }
  });

  router.post('/v1/clans/leave', requireAuth, (req: AuthReq, res) => {
    leaveClan(req.user!.id);
    res.json({ profile: getUserById(req.user!.id), clans: getClans() });
  });

  router.get('/v1/tournaments', (_req, res) => {
    res.json({ tournaments: getTournaments() });
  });

  router.post('/v1/tournaments', requireAuth, (req: AuthReq, res) => {
    const { name, mode, mapId, maxTeams } = req.body || {};
    const id = createTournament(req.user!.id, String(name || 'Community Cup'), String(mode || '2v2'), String(mapId || 'apex_arena'), Number(maxTeams || 8));
    res.json({ id, tournaments: getTournaments() });
  });

  router.post('/v1/tournaments/:id/register', requireAuth, (req: AuthReq, res) => {
    try {
      registerForTournament(req.params.id, req.user!.username);
      res.json({ tournaments: getTournaments() });
    } catch (err: unknown) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Registration failed.' });
    }
  });

  // News
  router.get('/v1/news', (_req, res) => {
    res.json({ news: getNewsList() });
  });

  // Admin Console
  router.get('/v1/admin/overview', requireAuth, requireAdmin, (_req, res) => {
    res.json({
      ...getAdminOverview(),
      metrics: roomManager.getMonitoringMetrics(),
    });
  });

  router.post('/v1/admin/reports/:id/status', requireAuth, requireAdmin, (req: AuthReq, res) => {
    setReportStatus(req.user!.id, req.params.id, req.body.status);
    res.json({ ok: true });
  });

  router.post('/v1/admin/users/:id/ban', requireAuth, requireAdmin, (req: AuthReq, res) => {
    setUserBanned(req.user!.id, req.params.id, Boolean(req.body.banned));
    res.json({ ok: true });
  });

  router.post('/v1/admin/news', requireAuth, requireAdmin, (req: AuthReq, res) => {
    const { title, category, version, summary, body } = req.body || {};
    publishNews(req.user!.id, String(title), String(category), String(version), String(summary), String(body));
    res.json({ news: getNewsList() });
  });

  return router;
}
