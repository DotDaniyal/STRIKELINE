import type { NextFunction, Request, Response } from 'express';
import type { UserProfile } from '../../shared/types/game.ts';
import { getUserBySession } from '../persistence/index.ts';

export interface AuthReq extends Request {
  user?: UserProfile;
  token?: string;
}

const rateMap = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(maxPerMin = 120) {
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

export function requireAuth(req: AuthReq, res: Response, next: NextFunction) {
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

export function requireAdmin(req: AuthReq, res: Response, next: NextFunction) {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'moderator')) {
    return res.status(403).json({ error: 'Administrator privileges required.' });
  }
  next();
}
