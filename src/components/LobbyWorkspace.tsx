import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Coins,
  Crosshair,
  LogOut,
  Newspaper,
  Settings,
  Shield,
  Users,
  X,
} from 'lucide-react';
import type {
  GameModeId,
  MapId,
  MatchMutators,
  MatchSummaryInfo,
  NewsItem,
  PartyInvite,
  PartyState,
  PlayerSnapshot,
  RegionId,
  UserProfile,
  WeaponId,
} from '../../shared/types/game.ts';
import { TRANSLATIONS } from '../../shared/constants/i18n.ts';
import { LobbyScene } from '../game/engine/LobbyScene.ts';
import { api } from '../services/api.ts';
import { audioEngine } from '../game/audio/AudioEngine.ts';
import { PlayTab } from './lobby/PlayTab.tsx';
import { ArsenalTab } from './lobby/ArsenalTab.tsx';
import { ShopTab } from './lobby/ShopTab.tsx';
import { SocialTab } from './lobby/SocialTab.tsx';
import { CareerTab, LeaderboardTab } from './lobby/LeaderboardAndCareerTabs.tsx';
import { AdminTab } from './lobby/AdminTab.tsx';

export type LobbyTabId = 'play' | 'arsenal' | 'shop' | 'social' | 'leaderboard' | 'career' | 'admin';

interface Props {
  profile: UserProfile;
  party: PartyState | null;
  partyInvite: PartyInvite | null;
  searching: boolean;
  stagingRoom: MatchSummaryInfo | null;
  stagingPlayers: PlayerSnapshot[];
  onProfileUpdated: (next: UserProfile) => void;
  onLogout: () => void;
  onOpenSettings: () => void;
  onQuickPlay: (mode: GameModeId, mapId: MapId | undefined, region: RegionId, ranked?: boolean) => void;
  onCancelQueue: () => void;
  onCreatePrivate: (
    mode: GameModeId,
    mapId: MapId,
    maxPlayers: number,
    password: string,
    mutators: MatchMutators,
    autoStartBots?: boolean
  ) => void;
  onJoinRoom: (roomCode?: string, roomId?: string, password?: string) => void;
  onStartPrivateMatch: () => void;
  onLeaveRoom: () => void;
  onKickPlayer: (targetId: string) => void;
  onEnterTraining: () => void;
  onCreateParty: () => void;
  onLeaveParty: () => void;
  onInviteParty: (userId: string) => void;
  onRespondPartyInvite: (inviteId: string, accept: boolean) => void;
  onKickParty: (userId: string) => void;
  onPromoteParty: (userId: string) => void;
}

export function LobbyWorkspace({
  profile,
  party,
  partyInvite,
  searching,
  stagingRoom,
  stagingPlayers,
  onProfileUpdated,
  onLogout,
  onOpenSettings,
  onQuickPlay,
  onCancelQueue,
  onCreatePrivate,
  onJoinRoom,
  onStartPrivateMatch,
  onLeaveRoom,
  onKickPlayer,
  onEnterTraining,
  onCreateParty,
  onLeaveParty,
  onInviteParty,
  onRespondPartyInvite,
  onKickParty,
  onPromoteParty,
}: Props) {
  const [tab, setTab] = useState<LobbyTabId>('play');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [newsOpen, setNewsOpen] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const lobbySceneRef = useRef<LobbyScene | null>(null);

  const t = TRANSLATIONS[profile.settings.language] || TRANSLATIONS.en;

  const activeLoadout =
    profile.loadouts.find((l) => l.id === profile.activeLoadoutId) || profile.loadouts[0];
  const activeWeapon: WeaponId = activeLoadout?.primaryWeapon ?? 'vanguard_ar';
  const activeSkin = activeLoadout?.weaponSkins?.[activeWeapon] ?? 'skin_standard_matte';

  useEffect(() => {
    if (!stageRef.current) return;
    const scene = new LobbyScene(stageRef.current, activeWeapon, activeSkin, profile.equippedOperator);
    lobbySceneRef.current = scene;
    return () => {
      scene.dispose();
      lobbySceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    lobbySceneRef.current?.updateLoadout(activeWeapon, activeSkin, profile.equippedOperator);
  }, [activeWeapon, activeSkin, profile.equippedOperator]);

  useEffect(() => {
    api.getNews()
      .then((res) => setNews(res.news))
      .catch(() => {});
  }, []);

  const tabs: Array<{ id: LobbyTabId; label: string }> = [
    { id: 'play', label: t.play },
    { id: 'arsenal', label: t.arsenal },
    { id: 'shop', label: t.shop },
    { id: 'social', label: t.social },
    { id: 'leaderboard', label: t.leaderboard },
    { id: 'career', label: t.career },
    ...(profile.role === 'admin' || profile.role === 'moderator'
      ? [{ id: 'admin' as const, label: t.admin }]
      : []),
  ];

  return (
    <div className="relative min-h-screen w-full text-slate-100 overflow-x-hidden">
      {/* Isolated Live 3D Armory Backdrop */}
      <div ref={stageRef} className="fixed inset-0 z-0 pointer-events-none" />

      {/* Foreground Shell */}
      <div className="relative z-10 min-h-screen flex flex-col">
        {/* Top Navigation Bar */}
        <header className="bg-[#0a0e16]/94 border-b border-slate-800 px-4 lg:px-8 py-3">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-5 overflow-x-auto">
              <div className="flex items-center gap-2 shrink-0 pr-2">
                <div className="w-2 h-6 bg-amber-500 rounded-sm" />
                <span className="font-display font-bold text-lg tracking-wider text-white">
                  STRIKELINE
                </span>
              </div>

              <nav className="flex items-center gap-1">
                {tabs.map((item) => {
                  const active = tab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        audioEngine.playUiClick(660);
                        setTab(item.id);
                      }}
                      className={`px-3.5 py-2 rounded-lg text-xs font-display font-bold uppercase tracking-wider transition cursor-pointer whitespace-nowrap shrink-0 ${
                        active
                          ? 'bg-amber-500 text-slate-950'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.playUiClick(740);
                    onEnterTraining();
                  }}
                  className="px-3.5 py-2 rounded-lg text-xs font-display font-bold uppercase tracking-wider text-cyan-300 hover:bg-cyan-500/15 border border-cyan-500/30 transition cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5 ml-1"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  {t.training}
                </button>
              </nav>
            </div>

            {/* Right Operator Status & Actions */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-[#0e1420] border border-slate-800 text-xs">
                <div>
                  <span className="font-semibold text-white">
                    {profile.clanTag && (
                      <span className="font-mono text-amber-400 mr-1">[{profile.clanTag}]</span>
                    )}
                    {profile.username}
                  </span>
                  <span className="ml-2 font-mono text-[11px] text-slate-400 tabular-nums">
                    Lv.{profile.level}
                  </span>
                </div>
                <span className="h-3.5 w-px bg-slate-700" />
                <span className="flex items-center gap-1 font-mono font-bold text-amber-400 tabular-nums">
                  <Coins className="w-3.5 h-3.5" />
                  {profile.credits}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setNewsOpen(true)}
                className="p-2 rounded-lg bg-[#0e1420] border border-slate-800 text-slate-300 hover:text-white hover:border-slate-600 cursor-pointer shrink-0"
                title="News & Patch Notes"
              >
                <Newspaper className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  audioEngine.playUiClick(680);
                  onOpenSettings();
                }}
                className="p-2 rounded-lg bg-[#0e1420] border border-slate-800 text-slate-300 hover:text-white hover:border-slate-600 cursor-pointer shrink-0"
                title={t.settings}
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onLogout}
                className="p-2 rounded-lg bg-[#0e1420] border border-slate-800 text-slate-300 hover:text-rose-300 hover:border-rose-500/40 cursor-pointer shrink-0"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Matchmaking Queue Bar */}
        {searching && (
          <div className="bg-amber-500/15 border-b border-amber-500/40 px-4 py-2.5">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
              <div className="font-display font-bold uppercase tracking-wider text-amber-300">
                Searching for Competitive Match...
              </div>
              <button
                type="button"
                onClick={onCancelQueue}
                className="px-3 py-1 rounded bg-rose-600 text-white font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                {t.cancelQueue}
              </button>
            </div>
          </div>
        )}

        {/* Incoming Party Invite Banner */}
        {partyInvite && (
          <div className="bg-sky-600/20 border-b border-sky-500/40 px-4 py-2.5">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-sky-100">
                <Bell className="w-4 h-4 text-sky-400" />
                <span>
                  Squad Invite from <strong className="text-white">{partyInvite.fromUsername}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => onRespondPartyInvite(partyInvite.id, true)}
                  className="px-3 py-1 rounded bg-emerald-500 text-slate-950 font-bold cursor-pointer"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => onRespondPartyInvite(partyInvite.id, false)}
                  className="px-3 py-1 rounded bg-slate-800 text-slate-300 cursor-pointer"
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6">
          {tab === 'play' && (
            <PlayTab
              profile={profile}
              party={party}
              searching={searching}
              onQuickPlay={onQuickPlay}
              onCancelQueue={onCancelQueue}
              onCreatePrivate={onCreatePrivate}
              onJoinRoom={onJoinRoom}
              onEnterTraining={onEnterTraining}
              onCreateParty={onCreateParty}
              onLeaveParty={onLeaveParty}
              onKickParty={onKickParty}
              onPromoteParty={onPromoteParty}
              onOpenNews={() => setNewsOpen(true)}
              latestNews={news[0] ?? null}
            />
          )}
          {tab === 'arsenal' && (
            <ArsenalTab
              profile={profile}
              onProfileUpdated={onProfileUpdated}
              onPreviewChange={(w, ws, os) => lobbySceneRef.current?.updateLoadout(w, ws, os)}
            />
          )}
          {tab === 'shop' && <ShopTab profile={profile} onProfileUpdated={onProfileUpdated} />}
          {tab === 'social' && (
            <SocialTab
              profile={profile}
              onProfileUpdated={onProfileUpdated}
              onInviteToParty={onInviteParty}
              onJoinRoomCode={(code) => onJoinRoom(code)}
            />
          )}
          {tab === 'leaderboard' && <LeaderboardTab currentUserId={profile.id} />}
          {tab === 'career' && (
            <CareerTab profile={profile} onProfileUpdated={onProfileUpdated} />
          )}
          {tab === 'admin' && <AdminTab />}
        </main>
      </div>

      {/* Private Room Staging Lobby Modal */}
      {stagingRoom && stagingRoom.isPrivate && stagingRoom.state === 'waiting' && (
        <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#111620] border border-slate-700 rounded-xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[11px] font-mono uppercase text-sky-400">Private Match Lobby</div>
                <h2 className="font-display text-2xl font-bold text-white">
                  {stagingRoom.mode.toUpperCase()} · {stagingRoom.mapId.replace('_', ' ')}
                </h2>
                <div className="text-xs text-slate-400 mt-1 flex flex-wrap gap-2">
                  <span>
                    Room Code:{' '}
                    <strong className="font-mono text-amber-400 text-sm select-all">
                      {stagingRoom.roomCode}
                    </strong>
                  </span>
                  {stagingRoom.mutators.headshotOnly && <span>· Headshots Only</span>}
                  {stagingRoom.mutators.lowGravity && <span>· Low Gravity</span>}
                  {(stagingRoom.mutators.botsCount ?? 0) > 0 && (
                    <span>· {stagingRoom.mutators.botsCount} Bots ({stagingRoom.mutators.botDifficulty})</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={onLeaveRoom}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Leave Room
              </button>
            </div>

            <div className="bg-[#090d14] border border-slate-800 rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto">
              <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Connected Operatives ({stagingPlayers.length}/{stagingRoom.maxPlayers})
              </div>
              {stagingPlayers.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-3 py-2 rounded bg-[#111620] border border-slate-800 text-xs"
                >
                  <span className="font-semibold text-white flex items-center gap-2">
                    {p.id === stagingRoom.hostId && <Shield className="w-3.5 h-3.5 text-amber-400" />}
                    {p.username}
                    <span className="font-mono text-[10px] uppercase text-slate-400">{p.team}</span>
                  </span>
                  {stagingRoom.hostId === profile.id && p.id !== profile.id && !p.isBot && (
                    <button
                      type="button"
                      onClick={() => onKickPlayer(p.id)}
                      className="px-2 py-0.5 rounded bg-rose-600/25 text-rose-300 text-[11px] cursor-pointer"
                    >
                      Kick
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Share code <span className="font-mono text-amber-400">{stagingRoom.roomCode}</span> for friends to join.
              </span>
              {stagingRoom.hostId === profile.id ? (
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.playUiClick(820);
                    onStartPrivateMatch();
                  }}
                  className="px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm uppercase tracking-wider cursor-pointer"
                >
                  Deploy Match
                </button>
              ) : (
                <span className="text-xs font-mono text-sky-400">Waiting for host to launch...</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* News & Patch Notes Modal */}
      {newsOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl max-h-[82vh] bg-[#111620] border border-slate-700 rounded-xl flex flex-col overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <h2 className="font-display text-lg font-bold text-white flex items-center gap-2">
                <Newspaper className="w-5 h-5 text-amber-400" /> Strikeline Dispatches & Patch Notes
              </h2>
              <button
                type="button"
                onClick={() => setNewsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4">
              {news.map((item) => (
                <article key={item.id} className="p-4 rounded-lg bg-[#090d14] border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-amber-400 uppercase">
                      {item.category} · {item.version}
                    </span>
                    <span className="text-slate-500">{new Date(item.publishedAt).toLocaleDateString()}</span>
                  </div>
                  <h3 className="font-display font-bold text-base text-white">{item.title}</h3>
                  <p className="text-xs text-slate-300 leading-relaxed">{item.body}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
