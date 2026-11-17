import type {
  ChallengeEntry,
  FriendEntry,
  LeaderboardEntry,
  LoadoutConfig,
  MatchRecord,
  MatchSummaryInfo,
  NewsItem,
  PlayerSettings,
  ShopItem,
  UserProfile,
} from '../../shared/types/game.ts';

let authToken: string | null = typeof window !== 'undefined' ? localStorage.getItem('strikeline_token') : null;

export function getAuthToken(): string | null {
  return authToken;
}

export function setAuthToken(token: string | null) {
  authToken = token;
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem('strikeline_token', token);
    else localStorage.removeItem('strikeline_token');
  }
}

async function request<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((opts.headers as Record<string, string>) || {}),
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await fetch(path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  register: (username: string, email: string, password: string) =>
    request<{ profile: UserProfile; token: string }>('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    }),
  login: (identifier: string, password: string) =>
    request<{ profile: UserProfile; token: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),
  guest: (preferredName?: string) =>
    request<{ profile: UserProfile; token: string }>('/api/v1/auth/guest', {
      method: 'POST',
      body: JSON.stringify({ preferredName }),
    }),
  upgradeGuest: (username: string, email: string, password: string) =>
    request<{ profile: UserProfile }>('/api/v1/auth/upgrade-guest', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    }),
  logout: () => request<{ ok: boolean }>('/api/v1/auth/logout', { method: 'POST' }),
  requestPasswordReset: (email: string) =>
    request<{ message: string; resetToken: string }>('/api/v1/auth/password-reset/request', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),
  completePasswordReset: (token: string, newPassword: string) =>
    request<{ ok: boolean }>('/api/v1/auth/password-reset/complete', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),
  getMe: () => request<{ profile: UserProfile }>('/api/v1/me'),
  saveSettings: (settings: PlayerSettings) =>
    request<{ profile: UserProfile }>('/api/v1/me/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    }),
  saveLoadouts: (
    loadouts: LoadoutConfig[],
    activeLoadoutId: string,
    equippedOperator: string,
    equippedSpray: string
  ) =>
    request<{ profile: UserProfile }>('/api/v1/me/loadouts', {
      method: 'PUT',
      body: JSON.stringify({ loadouts, activeLoadoutId, equippedOperator, equippedSpray }),
    }),
  getMatchHistory: () => request<{ matches: MatchRecord[] }>('/api/v1/me/matches'),
  getPublicRooms: () => request<{ rooms: MatchSummaryInfo[] }>('/api/v1/rooms'),
  getShop: () => request<{ items: ShopItem[] }>('/api/v1/shop'),
  purchaseItem: (itemId: string) =>
    request<{ profile: UserProfile }>('/api/v1/shop/purchase', {
      method: 'POST',
      body: JSON.stringify({ itemId }),
    }),
  getChallenges: () => request<{ challenges: ChallengeEntry[] }>('/api/v1/challenges'),
  claimChallenge: (id: string) =>
    request<{ profile: UserProfile; challenges: ChallengeEntry[] }>(`/api/v1/challenges/${id}/claim`, {
      method: 'POST',
    }),
  getLeaderboard: (scope: 'global' | 'friends' | 'weekly' | 'monthly' | 'ranked') =>
    request<{ entries: LeaderboardEntry[] }>(`/api/v1/leaderboards/${scope}`),
  getFriends: () => request<{ friends: FriendEntry[] }>('/api/v1/friends'),
  sendFriendRequest: (username: string) =>
    request<{ ok: boolean }>('/api/v1/friends/request', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),
  respondFriendRequest: (userId: string, accept: boolean) =>
    request<{ ok: boolean }>('/api/v1/friends/respond', {
      method: 'POST',
      body: JSON.stringify({ userId, accept }),
    }),
  removeFriend: (userId: string) => request<{ ok: boolean }>(`/api/v1/friends/${userId}`, { method: 'DELETE' }),
  blockUser: (username: string) =>
    request<{ ok: boolean }>('/api/v1/social/block', {
      method: 'POST',
      body: JSON.stringify({ username }),
    }),
  submitReport: (targetUsername: string, reason: string, details: string) =>
    request<{ ok: boolean }>('/api/v1/reports', {
      method: 'POST',
      body: JSON.stringify({ targetUsername, reason, details }),
    }),
  getClans: () =>
    request<{ clans: Array<{ id: string; tag: string; name: string; member_count: number }> }>('/api/v1/clans'),
  createClan: (tag: string, name: string) =>
    request<{ profile: UserProfile; clans: Array<{ id: string; tag: string; name: string; member_count: number }> }>(
      '/api/v1/clans',
      { method: 'POST', body: JSON.stringify({ tag, name }) }
    ),
  joinClan: (tag: string) =>
    request<{ profile: UserProfile; clans: Array<{ id: string; tag: string; name: string; member_count: number }> }>(
      '/api/v1/clans/join',
      { method: 'POST', body: JSON.stringify({ tag }) }
    ),
  leaveClan: () =>
    request<{ profile: UserProfile; clans: Array<{ id: string; tag: string; name: string; member_count: number }> }>(
      '/api/v1/clans/leave',
      { method: 'POST' }
    ),
  getTournaments: () =>
    request<{
      tournaments: Array<{
        id: string;
        name: string;
        mode: string;
        map_id: string;
        max_teams: number;
        status: string;
        participants: string[];
      }>;
    }>('/api/v1/tournaments'),
  createTournament: (name: string, mode: string, mapId: string, maxTeams: number) =>
    request<{ tournaments: Array<unknown> }>('/api/v1/tournaments', {
      method: 'POST',
      body: JSON.stringify({ name, mode, mapId, maxTeams }),
    }),
  registerTournament: (id: string) =>
    request<{ tournaments: Array<unknown> }>(`/api/v1/tournaments/${id}/register`, { method: 'POST' }),
  getNews: () => request<{ news: NewsItem[] }>('/api/v1/news'),
  getAdminOverview: () =>
    request<{
      users: Array<{
        id: string;
        username: string;
        role: string;
        level: number;
        kills: number;
        deaths: number;
        credits: number;
        banned: number;
      }>;
      reports: Array<{
        id: string;
        target_username: string;
        reason: string;
        details: string;
        status: string;
        created_at: string;
      }>;
      auditLogs: Array<{ id: string; actor_id: string; action: string; details: string; created_at: string }>;
      metrics: {
        uptimeSec: number;
        connectedPlayers: number;
        activeRooms: number;
        memoryMb: number;
        rooms: MatchSummaryInfo[];
      };
    }>('/api/v1/admin/overview'),
  setReportStatus: (id: string, status: 'open' | 'reviewed' | 'resolved') =>
    request<{ ok: boolean }>(`/api/v1/admin/reports/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }),
  setUserBanned: (id: string, banned: boolean) =>
    request<{ ok: boolean }>(`/api/v1/admin/users/${id}/ban`, {
      method: 'POST',
      body: JSON.stringify({ banned }),
    }),
  publishNews: (title: string, category: string, version: string, summary: string, body: string) =>
    request<{ news: NewsItem[] }>('/api/v1/admin/news', {
      method: 'POST',
      body: JSON.stringify({ title, category, version, summary, body }),
    }),
};
