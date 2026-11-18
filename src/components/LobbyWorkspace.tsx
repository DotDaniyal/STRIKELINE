import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  Coins,
  Crosshair,
  LogOut,
  Newspaper,
  Settings,
  Shield,
  Users,
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
import { LobbyScene, type LobbyFocusMode } from '../game/engine/LobbyScene.ts';
import { api } from '../services/api.ts';
import { audioEngine } from '../game/audio/AudioEngine.ts';
import { TacticalButton } from './ui/TacticalButton.tsx';
import { ModalShell } from './ui/ModalShell.tsx';
import { PlayTab } from './lobby/PlayTab.tsx';
import { ArsenalTab } from './lobby/ArsenalTab.tsx';
import { ShopTab } from './lobby/ShopTab.tsx';
import { SocialTab } from './lobby/SocialTab.tsx';
import { CareerTab, LeaderboardTab } from './lobby/LeaderboardAndCareerTabs.tsx';
import { AdminTab } from './lobby/AdminTab.tsx';
import type { LegalDocType } from './LegalDocumentModal.tsx';

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
  onOpenLegal: (doc: LegalDocType) => void;
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
  onOpenLegal,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    lobbySceneRef.current?.updateLoadout(activeWeapon, activeSkin, profile.equippedOperator);
  }, [activeWeapon, activeSkin, profile.equippedOperator]);

  useEffect(() => {
    const mode: LobbyFocusMode = tab === 'arsenal' ? 'arsenal' : 'play';
    lobbySceneRef.current?.setFocusMode(mode);
  }, [tab]);

  useEffect(() => {
    const unlockAmbient = () => {
      audioEngine.setAmbientMode('lobby');
    };
    window.addEventListener('pointerdown', unlockAmbient, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAmbient);
    };
  }, []);

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

  const xpPct = Math.max(4, Math.min(100, Math.round((profile.xp / Math.max(1, profile.xpToNext)) * 100)));

  return (
    <div className="relative min-h-screen w-full text-slate-100 overflow-x-hidden bg-[#07090e]">
      {/* Isolated 3D Armory Stage Backdrop */}
      <div ref={stageRef} className="fixed inset-0 z-0 pointer-events-none" />

      {/* Atmospheric Vignette Scrim */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[1] pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, rgba(7,9,14,0.15) 0%, rgba(7,9,14,0.78) 100%)',
        }}
      />

      {/* Foreground Shell */}
      <div className="relative z-10 min-h-screen flex flex-col justify-between">
        {/* Minimalist Top Command Bar */}
        <header className="bg-[#090c12]/92 backdrop-blur-md border-b border-slate-800/85 px-4 lg:px-10 py-3">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-5 overflow-x-auto max-w-full">
              <div className="flex items-center gap-2.5 shrink-0 pr-2">
                <svg width="28" height="28" viewBox="0 0 42 42" fill="none" aria-hidden="true">
                  <polygon points="21,2 40,12 40,30 21,40 2,30 2,12" stroke="#f59e0b" strokeWidth="2.4" fill="#0e131c" />
                  <circle cx="21" cy="21" r="4" fill="#f59e0b" />
                </svg>
                <span className="font-display font-bold text-lg tracking-[0.15em] text-white">
                  STRIKELINE
                </span>
              </div>

              <nav className="flex items-center gap-1.5" aria-label="Main navigation">
                {tabs.map((item) => {
                  const active = tab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => {
                        if (!active) audioEngine.playUiHover();
                      }}
                      onClick={() => {
                        audioEngine.playUiClick(680);
                        setTab(item.id);
                      }}
                      className={`relative px-3.5 py-2 text-xs font-display font-bold uppercase tracking-wider transition cursor-pointer whitespace-nowrap shrink-0 sl-chamfer-sm ${
                        active
                          ? 'text-slate-950'
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="lobby-nav-active"
                          transition={{ type: 'spring', stiffness: 480, damping: 36 }}
                          className="absolute inset-0 bg-amber-500 sl-chamfer-sm"
                          aria-hidden="true"
                        />
                      )}
                      <span className="relative z-10">{item.label}</span>
                    </button>
                  );
                })}
                <TacticalButton
                  variant="cyan"
                  size="sm"
                  onClick={onEnterTraining}
                  className="ml-1"
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  {t.training}
                </TacticalButton>
              </nav>
            </div>

            {/* Operator Telemetry & Utilities */}
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 bg-[#07090e]/90 border border-slate-800 sl-chamfer-sm text-xs">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white truncate">
                      {profile.clanTag && (
                        <span className="font-mono-tabular text-amber-400 mr-1">[{profile.clanTag}]</span>
                      )}
                      {profile.username}
                    </span>
                    <span className="font-mono-tabular text-[11px] text-slate-400">
                      Lv.{profile.level}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-slate-800 mt-1 overflow-hidden sl-chamfer-sm">
                    <div className="h-full bg-amber-500" style={{ width: `${xpPct}%` }} />
                  </div>
                </div>
                <span className="h-5 w-px bg-slate-800" />
                <span className="flex items-center gap-1 font-mono-tabular font-bold text-amber-400">
                  <Coins className="w-3.5 h-3.5" />
                  {profile.credits}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  audioEngine.playUiClick(650);
                  setNewsOpen(true);
                }}
                className="p-2 sl-chamfer-sm bg-[#07090e]/90 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-600 cursor-pointer shrink-0 transition"
                title="News & Patch Notes"
                aria-label="Open news and patch notes"
              >
                <Newspaper className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  audioEngine.playUiClick(680);
                  onOpenSettings();
                }}
                className="p-2 sl-chamfer-sm bg-[#07090e]/90 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-600 cursor-pointer shrink-0 transition"
                title={t.settings}
                aria-label={t.settings}
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  audioEngine.playUiClick(540);
                  onLogout();
                }}
                className="p-2 sl-chamfer-sm bg-[#07090e]/90 border border-slate-800 text-slate-300 hover:text-rose-300 hover:border-rose-500/45 cursor-pointer shrink-0 transition"
                title="Sign Out"
                aria-label="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Matchmaking / Squad Banners */}
        {searching && (
          <div className="bg-amber-500/15 border-b border-amber-500/40 px-6 py-2.5 backdrop-blur-md">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
              <div className="font-display font-bold uppercase tracking-wider text-amber-300">
                Searching for Competitive Match...
              </div>
              <TacticalButton variant="danger" size="sm" onClick={onCancelQueue}>
                {t.cancelQueue}
              </TacticalButton>
            </div>
          </div>
        )}

        {partyInvite && (
          <div className="bg-sky-600/20 border-b border-sky-500/40 px-6 py-2.5 backdrop-blur-md">
            <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 text-sky-100">
                <Bell className="w-4 h-4 text-sky-400" />
                <span>
                  Squad Invite from <strong className="text-white">{partyInvite.fromUsername}</strong>
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <TacticalButton
                  variant="primary"
                  size="sm"
                  onClick={() => onRespondPartyInvite(partyInvite.id, true)}
                >
                  Accept
                </TacticalButton>
                <TacticalButton
                  variant="secondary"
                  size="sm"
                  onClick={() => onRespondPartyInvite(partyInvite.id, false)}
                >
                  Decline
                </TacticalButton>
              </div>
            </div>
          </div>
        )}

        {/* Main Tab Workspace */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-10 py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
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
                  onRotateShowcase={(deltaRad) => lobbySceneRef.current?.rotateShowcase(deltaRad)}
                  onFocusStage={(mode) => lobbySceneRef.current?.setFocusMode(mode)}
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
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Minimalist Footer */}
        <footer className="border-t border-slate-800/80 bg-[#090c12]/90 px-6 lg:px-10 py-3">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
            <span className="font-mono-tabular">STRIKELINE Combat Operations</span>
            <div className="flex items-center gap-4">
              <a
                href="/privacy"
                onClick={(e) => {
                  e.preventDefault();
                  onOpenLegal('privacy');
                }}
                className="hover:text-amber-400 underline underline-offset-4 cursor-pointer"
              >
                Privacy Policy
              </a>
              <a
                href="/terms"
                onClick={(e) => {
                  e.preventDefault();
                  onOpenLegal('terms');
                }}
                className="hover:text-amber-400 underline underline-offset-4 cursor-pointer"
              >
                Terms &amp; Conditions
              </a>
            </div>
          </div>
        </footer>
      </div>

      {/* Private Room Staging Modal */}
      {stagingRoom && stagingRoom.isPrivate && stagingRoom.state === 'waiting' && (
        <ModalShell
          title={`${stagingRoom.mode.toUpperCase()} · ${stagingRoom.mapId.replace('_', ' ')}`}
          subtitle={`Room Code: ${stagingRoom.roomCode}`}
          maxWidthClass="max-w-2xl"
          onClose={onLeaveRoom}
          footer={
            <>
              <span className="text-xs text-slate-400">
                Share code <span className="font-mono-tabular text-amber-400">{stagingRoom.roomCode}</span> for friends to join.
              </span>
              <div className="flex items-center gap-2">
                <TacticalButton variant="secondary" size="sm" onClick={onLeaveRoom}>
                  Leave Room
                </TacticalButton>
                {stagingRoom.hostId === profile.id ? (
                  <TacticalButton variant="primary" size="md" onClick={onStartPrivateMatch}>
                    Deploy Match
                  </TacticalButton>
                ) : (
                  <span className="text-xs font-mono-tabular text-sky-400">Waiting for host...</span>
                )}
              </div>
            </>
          }
        >
          <div className="space-y-4">
            <div className="text-xs text-slate-400 flex flex-wrap gap-3 font-mono-tabular">
              <span>Max {stagingRoom.maxPlayers} Operatives</span>
              {stagingRoom.mutators.headshotOnly && <span className="text-amber-400">Headshots Only</span>}
              {stagingRoom.mutators.lowGravity && <span className="text-sky-400">Low Gravity</span>}
              {(stagingRoom.mutators.botsCount ?? 0) > 0 && (
                <span>
                  {stagingRoom.mutators.botsCount} Bots ({stagingRoom.mutators.botDifficulty})
                </span>
              )}
            </div>

            <div className="bg-[#07090e] border border-slate-800 p-3 space-y-2 max-h-60 overflow-y-auto">
              <div className="text-[11px] font-mono-tabular uppercase text-slate-400 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> Connected Operatives ({stagingPlayers.length}/{stagingRoom.maxPlayers})
              </div>
              {stagingPlayers.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between px-3 py-2 bg-[#0c1018] border border-slate-800 text-xs"
                >
                  <span className="font-semibold text-white flex items-center gap-2">
                    {p.id === stagingRoom.hostId && <Shield className="w-3.5 h-3.5 text-amber-400" />}
                    {p.username}
                    <span className="font-mono-tabular text-[10px] uppercase text-slate-400">{p.team}</span>
                  </span>
                  {stagingRoom.hostId === profile.id && p.id !== profile.id && !p.isBot && (
                    <button
                      type="button"
                      onClick={() => onKickPlayer(p.id)}
                      className="px-2 py-0.5 bg-rose-600/25 text-rose-300 text-[11px] cursor-pointer"
                    >
                      Kick
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </ModalShell>
      )}

      {/* News & Patch Notes Modal */}
      {newsOpen && (
        <ModalShell
          title="Strikeline Dispatches & Patch Notes"
          icon={<Newspaper className="w-5 h-5 text-amber-400" />}
          maxWidthClass="max-w-2xl"
          onClose={() => setNewsOpen(false)}
        >
          <div className="space-y-3">
            {news.map((item) => (
              <article key={item.id} className="p-4 bg-[#07090e] border border-slate-800 sl-chamfer-sm space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-mono-tabular">
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
        </ModalShell>
      )}
    </div>
  );
}
