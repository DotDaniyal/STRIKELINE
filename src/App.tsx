import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { MotionConfig } from 'motion/react';
import { Mic, MicOff, X } from 'lucide-react';
import type {
  ChatMessage,
  FlagRuntimeState,
  GameModeId,
  KillFeedEntry,
  MapId,
  MatchResultSummary,
  MatchSummaryInfo,
  ObjectiveRuntimeState,
  PartyInvite,
  PartyState,
  PlayerSettings,
  PlayerSnapshot,
  ServerMessage,
  TeamId,
  UserProfile,
} from '../shared/types/game.ts';
import { DEFAULT_SETTINGS } from '../shared/constants/modes.ts';
import { api, getAuthToken, setAuthToken } from './services/api.ts';
import { socketClient } from './network/SocketClient.ts';
import { VoiceChatManager } from './network/VoiceChat.ts';
import { GameEngine, type HudTelemetry } from './game/engine/GameEngine.ts';
import { audioEngine } from './game/audio/AudioEngine.ts';
import { BootSplash } from './components/ui/BootSplash.tsx';
import { ModalShell } from './components/ui/ModalShell.tsx';
import { TacticalButton } from './components/ui/TacticalButton.tsx';
import { TitleAuthScreen } from './components/TitleAuthScreen.tsx';
import { LobbyWorkspace } from './components/LobbyWorkspace.tsx';
import { MatchHud } from './components/hud/MatchHud.tsx';
import { MobileControls } from './components/MobileControls.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';
import { LegalDocumentView, type LegalDocType } from './components/LegalDocumentModal.tsx';
import { CinematicIntroOverlay } from './components/CinematicIntroOverlay.tsx';

const INITIAL_HUD: HudTelemetry = {
  hp: 100,
  maxHp: 100,
  ammo: 30,
  magSize: 30,
  reserve: 150,
  weaponId: 'vanguard_ar',
  primaryWeapon: 'vanguard_ar',
  secondaryWeapon: 'viper_pistol',
  isReloading: false,
  reloadProgress: 0,
  isAds: false,
  spreadRad: 0.02,
  fps: 60,
  pingMs: 12,
  pointerLocked: false,
  spectatingName: null,
  pos: { x: 0, y: 0, z: 0 },
  yaw: 0,
  movementState: 'idle',
};

function readLegalPath(): LegalDocType | null {
  if (typeof window === 'undefined') return null;
  if (window.location.pathname === '/privacy') return 'privacy';
  if (window.location.pathname === '/terms') return 'terms';
  return null;
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [screen, setScreen] = useState<'auth' | 'lobby' | 'match'>('auth');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [showIntro, setShowIntro] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return !sessionStorage.getItem('strikeline_intro_seen');
  });
  const [legalDoc, setLegalDoc] = useState<LegalDocType | null>(() => readLegalPath());
  const [legalStandalone, setLegalStandalone] = useState<boolean>(() => readLegalPath() !== null);
  const [toast, setToast] = useState<{ title: string; body: string } | null>(null);

  // Lobby / Social / Queue state
  const [party, setParty] = useState<PartyState | null>(null);
  const [partyInvite, setPartyInvite] = useState<PartyInvite | null>(null);
  const [searching, setSearching] = useState(false);

  // Match state
  const [activeMatch, setActiveMatch] = useState<MatchSummaryInfo | null>(null);
  const [matchPlayers, setMatchPlayers] = useState<PlayerSnapshot[]>([]);
  const [objectives, setObjectives] = useState<ObjectiveRuntimeState[]>([]);
  const [flags, setFlags] = useState<FlagRuntimeState[]>([]);
  const [killFeed, setKillFeed] = useState<KillFeedEntry[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [matchResult, setMatchResult] = useState<MatchResultSummary | null>(null);
  const [localId, setLocalId] = useState('');
  const [localTeam, setLocalTeam] = useState<TeamId>('none');

  // HUD / Interaction state
  const [hud, setHud] = useState<HudTelemetry>(INITIAL_HUD);
  const [hitmarker, setHitmarker] = useState({ active: false, headshot: false });
  const [damageFlashAngle, setDamageFlashAngle] = useState<number | null>(null);
  const [deathInfo, setDeathInfo] = useState<{
    attackerName: string;
    weaponId: string;
    headshot: boolean;
    respawnIn: number;
  } | null>(null);
  const [streakBanner, setStreakBanner] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [chatOpen, setChatOpen] = useState({ open: false, teamOnly: false });
  const [touchMode, setTouchMode] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches
  );
  const [isTraining, setIsTraining] = useState(false);
  const [reportTarget, setReportTarget] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState('Cheating / Exploit');
  const [reportDetails, setReportDetails] = useState('');

  // Optional WebRTC Team Voice Chat
  const [voiceActive, setVoiceActive] = useState(false);
  const profileRef = useRef<UserProfile | null>(null);
  profileRef.current = profile;

  const voiceManagerRef = useRef<VoiceChatManager | null>(null);
  if (!voiceManagerRef.current) {
    voiceManagerRef.current = new VoiceChatManager(
      () => profileRef.current?.settings.voiceVolume ?? 0.85
    );
  }

  const gameCanvasRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const pendingAutoStartBotsRef = useRef(false);
  const hitmarkerTimerRef = useRef<number | null>(null);
  const damageTimerRef = useRef<number | null>(null);
  const streakTimerRef = useRef<number | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hitmarkerTimerRef.current) window.clearTimeout(hitmarkerTimerRef.current);
      if (damageTimerRef.current) window.clearTimeout(damageTimerRef.current);
      if (streakTimerRef.current) window.clearTimeout(streakTimerRef.current);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    };
  }, []);

  const showToast = useCallback((title: string, body: string) => {
    setToast({ title, body });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 4000);
  }, []);

  const openLegal = useCallback((doc: LegalDocType, standalone = false) => {
    setLegalDoc(doc);
    setLegalStandalone(standalone);
    const targetPath = doc === 'privacy' ? '/privacy' : '/terms';
    if (window.location.pathname !== targetPath) {
      window.history.pushState({ legalDoc: doc }, '', targetPath);
    }
  }, []);

  const closeLegal = useCallback(() => {
    setLegalDoc(null);
    setLegalStandalone(false);
    if (window.location.pathname === '/privacy' || window.location.pathname === '/terms') {
      window.history.pushState({}, '', '/');
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const pathDoc = readLegalPath();
      setLegalDoc(pathDoc);
      setLegalStandalone(pathDoc !== null);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  // Restore session on startup
  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setBooting(false);
      return;
    }
    api
      .getMe()
      .then((res) => {
        setProfile(res.profile);
        setLocalId(res.profile.id);
        audioEngine.applySettings(res.profile.settings);
        socketClient.connect(token);
        setScreen('lobby');
      })
      .catch(() => {
        setAuthToken(null);
      })
      .finally(() => setBooting(false));
  }, []);

  // Respawn countdown ticker
  useEffect(() => {
    if (!deathInfo || deathInfo.respawnIn <= 0) return;
    const t = window.setInterval(() => {
      setDeathInfo((prev) => (prev ? { ...prev, respawnIn: Math.max(0, prev.respawnIn - 1) } : null));
    }, 1000);
    return () => window.clearInterval(t);
  }, [deathInfo !== null]);

  const stopVoice = useCallback(() => {
    voiceManagerRef.current?.stop();
    setVoiceActive(false);
  }, []);

  const toggleVoiceChat = async () => {
    if (voiceActive) {
      stopVoice();
      return;
    }
    const ok = await voiceManagerRef.current!.start(matchPlayers, localId, localTeam);
    if (ok) {
      setVoiceActive(true);
      showToast('Voice Channel Active', 'Microphone linked to squad channel.');
    } else {
      showToast('Microphone Unavailable', 'Allow browser microphone access to enable team voice.');
    }
  };

  // Handle Socket Messages
  useEffect(() => {
    const unsub = socketClient.subscribe(async (msg: ServerMessage) => {
      switch (msg.type) {
        case 'auth_ok':
          setLocalId(msg.userId);
          break;
        case 'error':
          showToast('System Notice', msg.message);
          break;
        case 'notification':
          showToast(msg.title, msg.body);
          break;
        case 'queue_status':
          setSearching(msg.searching);
          break;
        case 'party_update':
          setParty(msg.party);
          break;
        case 'party_invite_received':
          setPartyInvite(msg.invite);
          break;
        case 'room_joined':
          setSearching(false);
          setIsTraining(false);
          setActiveMatch(msg.match);
          setLocalId(msg.yourId);
          setLocalTeam(msg.yourTeam);
          setMatchResult(null);
          setKillFeed([]);
          setChatMessages([]);
          setDeathInfo(null);
          setPaused(false);
          if (pendingAutoStartBotsRef.current && msg.match.isPrivate && msg.match.state === 'waiting') {
            pendingAutoStartBotsRef.current = false;
            socketClient.send({ type: 'start_private_match' });
          } else if (msg.match.state !== 'waiting') {
            audioEngine.playMatchStart();
            setScreen('match');
          }
          break;
        case 'room_left':
          setActiveMatch(null);
          setMatchPlayers([]);
          setMatchResult(null);
          setDeathInfo(null);
          setPaused(false);
          stopVoice();
          setScreen('lobby');
          api.getMe().then((r) => setProfile(r.profile)).catch(() => {});
          break;
        case 'match_state':
          setActiveMatch(msg.match);
          setMatchPlayers(msg.players);
          setObjectives(msg.objectives);
          setFlags(msg.flags);
          if (msg.match.state !== 'waiting') {
            setScreen('match');
          }
          engineRef.current?.applyMatchState(msg);
          break;
        case 'shot_fired':
          engineRef.current?.onRemoteShot(msg.shooterId, msg.weaponId, msg.origin, msg.endPoints, msg.tracerColor);
          break;
        case 'hit_confirm':
          audioEngine.playHitmarker(msg.headshot);
          if (msg.killed) audioEngine.playElimination();
          setHitmarker({ active: true, headshot: msg.headshot });
          if (hitmarkerTimerRef.current) window.clearTimeout(hitmarkerTimerRef.current);
          hitmarkerTimerRef.current = window.setTimeout(
            () => setHitmarker({ active: false, headshot: false }),
            140
          );
          break;
        case 'damage_taken': {
          audioEngine.playHurt();
          const me = matchPlayers.find((p) => p.id === localId);
          const angle = me
            ? Math.atan2(msg.attackerPos.x - me.x, msg.attackerPos.z - me.z) - me.yaw
            : 0;
          setDamageFlashAngle(angle);
          if (damageTimerRef.current) window.clearTimeout(damageTimerRef.current);
          damageTimerRef.current = window.setTimeout(() => setDamageFlashAngle(null), 550);
          break;
        }
        case 'kill_feed':
          setKillFeed((prev) => [...prev.slice(-5), msg.entry]);
          if (msg.entry.attackerId === localId) {
            const me = matchPlayers.find((p) => p.id === localId);
            const nextStreak = (me?.streak ?? 0) + 1;
            if (nextStreak === 3 || nextStreak === 5 || nextStreak === 7 || nextStreak >= 10) {
              setStreakBanner(`${nextStreak} ELIMINATION STREAK`);
              if (streakTimerRef.current) window.clearTimeout(streakTimerRef.current);
              streakTimerRef.current = window.setTimeout(() => setStreakBanner(null), 2400);
            }
          }
          break;
        case 'player_died':
          engineRef.current?.onPlayerDied(msg.victimId, msg.attackerId, msg.impulse);
          if (msg.victimId === localId) {
            setDeathInfo({
              attackerName: msg.attackerName,
              weaponId: msg.weaponId,
              headshot: msg.headshot,
              respawnIn: Math.ceil(msg.respawnInSec),
            });
          }
          break;
        case 'player_respawned':
          if (msg.playerId === localId) {
            setDeathInfo(null);
            engineRef.current?.onPlayerRespawned(msg.x, msg.y, msg.z, msg.yaw);
          }
          break;
        case 'spray_placed':
          engineRef.current?.onSprayPlaced(msg.decal);
          break;
        case 'match_ended':
          setMatchResult(msg.result);
          setDeathInfo(null);
          if (document.pointerLockElement) document.exitPointerLock?.();
          api.getMe().then((r) => setProfile(r.profile)).catch(() => {});
          break;
        case 'map_vote_update':
          setMatchResult((prev) => (prev ? { ...prev, mapVotes: msg.votes } : prev));
          break;
        case 'chat_message':
          setChatMessages((prev) => [...prev.slice(-39), msg.message]);
          break;
        case 'voice_signal':
          await voiceManagerRef.current?.handleSignal(msg.fromId, msg.signal);
          break;
      }
    });
    return () => {
      unsub();
    };
  }, [localId, matchPlayers, showToast, stopVoice]);

  // Mount & clean up GameEngine when entering/leaving 'match' screen
  useEffect(() => {
    if (screen !== 'match' || !gameCanvasRef.current || !profile) return;

    const mapId: MapId = isTraining ? 'training_range' : activeMatch?.mapId ?? 'foundry';
    const mode: GameModeId = isTraining ? 'training' : activeMatch?.mode ?? 'tdm';
    const loadout =
      profile.loadouts.find((l) => l.id === profile.activeLoadoutId) || profile.loadouts[0];

    const engine = new GameEngine({
      container: gameCanvasRef.current,
      mapId,
      mode,
      primaryWeapon: loadout?.primaryWeapon ?? 'vanguard_ar',
      secondaryWeapon: loadout?.secondaryWeapon ?? 'viper_pistol',
      weaponSkins: loadout?.weaponSkins ?? {},
      equippedSpray: profile.equippedSpray,
      settings: profile.settings,
      onHudUpdate: setHud,
      onLocalHitmarker: (headshot) => {
        setHitmarker({ active: true, headshot });
        if (hitmarkerTimerRef.current) window.clearTimeout(hitmarkerTimerRef.current);
        hitmarkerTimerRef.current = window.setTimeout(
          () => setHitmarker({ active: false, headshot: false }),
          140
        );
      },
      onPauseToggle: () => {
        setPaused((prev) => {
          const next = !prev;
          engine.setPaused(next);
          return next;
        });
      },
      onScoreboardToggle: setShowScoreboard,
      onChatOpen: (teamOnly) => {
        setChatOpen({ open: true, teamOnly });
        engine.setPaused(true);
      },
    });
    engine.localId = profile.id;
    engine.localTeam = localTeam;
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
    // Intentionally keyed on screen + training + roomId so live settings/match_state don't recreate WebGL context
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, isTraining, activeMatch?.roomId]);

  const handleSaveSettings = async (next: PlayerSettings) => {
    if (!profile) return;
    setProfile({ ...profile, settings: next });
    engineRef.current?.updateSettings(next);
    audioEngine.applySettings(next);
    try {
      const res = await api.saveSettings(next);
      setProfile(res.profile);
    } catch {
      // Settings already applied locally
    }
  };

  const handleLeaveMatch = () => {
    setPaused(false);
    setChatOpen({ open: false, teamOnly: false });
    if (isTraining) {
      setIsTraining(false);
      setScreen('lobby');
    } else {
      socketClient.send({ type: 'leave_room' });
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore logout network error
    }
    setAuthToken(null);
    socketClient.disconnect();
    audioEngine.setAmbientMode('off');
    stopVoice();
    setProfile(null);
    setScreen('auth');
  };

  if (legalDoc && legalStandalone) {
    return (
      <MotionConfig reducedMotion="user">
        <LegalDocumentView
          doc={legalDoc}
          standalone
          onSwitchDoc={(next) => openLegal(next, true)}
          onClose={closeLegal}
        />
      </MotionConfig>
    );
  }

  if (booting) {
    return (
      <MotionConfig reducedMotion="user">
        <BootSplash />
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#07090e] text-slate-100 select-none">
        {toast && (
          <div className="fixed top-4 right-4 z-50 max-w-sm bg-[#0c1018] border border-amber-500/55 sl-chamfer-sm px-4 py-3 shadow-2xl flex items-start justify-between gap-3">
            <div>
              <div className="font-display font-bold text-xs uppercase tracking-wider text-amber-400">
                {toast.title}
              </div>
              <div className="text-xs text-slate-200 mt-0.5">{toast.body}</div>
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => setToast(null)}
              className="text-slate-400 hover:text-white cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {screen === 'auth' || !profile ? (
          <TitleAuthScreen
            onAuthenticated={(p, token) => {
              setProfile(p);
              setLocalId(p.id);
              audioEngine.applySettings(p.settings || DEFAULT_SETTINGS);
              socketClient.connect(token);
              setScreen('lobby');
            }}
            onOpenLegal={(doc) => openLegal(doc, false)}
          />
        ) : null}

        {screen === 'lobby' && profile && (
          <LobbyWorkspace
            profile={profile}
            party={party}
            partyInvite={partyInvite}
            searching={searching}
            stagingRoom={activeMatch}
            stagingPlayers={matchPlayers}
            onProfileUpdated={(next) => {
              setProfile(next);
              const loadout = next.loadouts.find((l) => l.id === next.activeLoadoutId) || next.loadouts[0];
              if (loadout) {
                engineRef.current?.updateLoadout(
                  loadout.primaryWeapon,
                  loadout.secondaryWeapon,
                  loadout.weaponSkins,
                  next.equippedSpray
                );
              }
            }}
            onLogout={handleLogout}
            onOpenSettings={() => setSettingsOpen(true)}
            onQuickPlay={(mode, mapId, region, ranked) => {
              pendingAutoStartBotsRef.current = false;
              socketClient.send({ type: 'queue_join', mode, mapId, region, ranked });
            }}
            onCancelQueue={() => socketClient.send({ type: 'queue_leave' })}
            onCreatePrivate={(mode, mapId, maxPlayers, password, mutators, autoStartBots) => {
              pendingAutoStartBotsRef.current = Boolean(autoStartBots);
              socketClient.send({
                type: 'create_private_room',
                mode,
                mapId,
                maxPlayers,
                password: password || undefined,
                mutators,
              });
            }}
            onJoinRoom={(roomCode, roomId, password) =>
              socketClient.send({ type: 'join_room', roomCode, roomId, password })
            }
            onStartPrivateMatch={() => socketClient.send({ type: 'start_private_match' })}
            onLeaveRoom={() => socketClient.send({ type: 'leave_room' })}
            onKickPlayer={(targetId) => socketClient.send({ type: 'kick_player', targetId })}
            onEnterTraining={() => {
              audioEngine.playMatchStart();
              setIsTraining(true);
              setActiveMatch(null);
              setMatchPlayers([]);
              setObjectives([]);
              setFlags([]);
              setMatchResult(null);
              setScreen('match');
            }}
            onCreateParty={() => socketClient.send({ type: 'party_create' })}
            onLeaveParty={() => socketClient.send({ type: 'party_leave' })}
            onInviteParty={(targetUserId) => socketClient.send({ type: 'party_invite', targetUserId })}
            onRespondPartyInvite={(inviteId, accept) => {
              socketClient.send({ type: 'party_respond_invite', inviteId, accept });
              setPartyInvite(null);
            }}
            onKickParty={(targetUserId) => socketClient.send({ type: 'party_kick', targetUserId })}
            onPromoteParty={(targetUserId) =>
              socketClient.send({ type: 'party_transfer_leader', targetUserId })
            }
            onOpenLegal={(doc) => openLegal(doc, false)}
          />
        )}

        {screen === 'match' && profile && (
          <div className="fixed inset-0 bg-black overflow-hidden">
            <div ref={gameCanvasRef} className="fixed inset-0 z-0" />

            {!isTraining && (
              <button
                type="button"
                onClick={toggleVoiceChat}
                className={`fixed bottom-20 sm:bottom-24 left-3 sm:left-5 z-30 flex items-center gap-1.5 px-3 py-1.5 sl-chamfer-sm border text-xs font-semibold cursor-pointer ${
                  voiceActive
                    ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                    : 'bg-[#07090e]/90 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                {voiceActive ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                {voiceActive ? 'Voice On' : 'Voice Off'}
              </button>
            )}

            <MatchHud
              hud={hud}
              match={activeMatch}
              players={matchPlayers}
              objectives={objectives}
              flags={flags}
              killFeed={killFeed}
              chatMessages={chatMessages}
              settings={profile.settings}
              hitmarker={hitmarker}
              damageFlashAngle={damageFlashAngle}
              deathInfo={deathInfo}
              streakBanner={streakBanner}
              paused={paused}
              showScoreboard={showScoreboard}
              chatOpen={chatOpen}
              matchResult={matchResult}
              localId={profile.id}
              localTeam={localTeam}
              touchMode={touchMode}
              onToggleTouchMode={() => setTouchMode((v) => !v)}
              onResume={() => {
                setPaused(false);
                engineRef.current?.setPaused(false);
                engineRef.current?.requestPointerLock();
              }}
              onOpenSettings={() => setSettingsOpen(true)}
              onLeaveMatch={handleLeaveMatch}
              onSendChat={(channel, text) => socketClient.send({ type: 'chat_send', channel, text })}
              onCloseChat={() => {
                setChatOpen({ open: false, teamOnly: false });
                engineRef.current?.setPaused(false);
              }}
              onVoteMap={(mapId) => socketClient.send({ type: 'vote_map', mapId })}
              onSwapSlot={(slot) => engineRef.current?.swapToSlot(slot)}
              onStartDrill={(drill) => engineRef.current?.startAimDrill(drill)}
              onReportPlayer={(username) => {
                setPaused(true);
                engineRef.current?.setPaused(true);
                setReportTarget(username);
              }}
              onLockPointer={() => engineRef.current?.requestPointerLock()}
            />

            {touchMode && !paused && !matchResult && (
              <MobileControls engine={engineRef.current} scale={profile.settings.mobileLayoutScale} />
            )}

            {reportTarget && (
              <ModalShell
                title={`Report Operator: ${reportTarget}`}
                maxWidthClass="max-w-md"
                onClose={() => setReportTarget(null)}
              >
                <form
                  onSubmit={async (e: FormEvent) => {
                    e.preventDefault();
                    await api.submitReport(reportTarget, reportReason, reportDetails);
                    setReportTarget(null);
                    setReportDetails('');
                    showToast('Report Filed', `Submitted report for ${reportTarget}.`);
                  }}
                  className="space-y-3"
                >
                  <select
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    className="w-full bg-[#07090e] border border-slate-700 px-3 py-2 text-xs text-white"
                  >
                    <option>Cheating / Exploit</option>
                    <option>Harassment / Chat Abuse</option>
                    <option>Griefing / AFK</option>
                  </select>
                  <textarea
                    rows={3}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Describe incident..."
                    className="w-full bg-[#07090e] border border-slate-700 px-3 py-2 text-xs text-white"
                  />
                  <div className="flex justify-end gap-2">
                    <TacticalButton type="button" variant="secondary" onClick={() => setReportTarget(null)}>
                      Cancel
                    </TacticalButton>
                    <TacticalButton type="submit" variant="danger">
                      Submit Report
                    </TacticalButton>
                  </div>
                </form>
              </ModalShell>
            )}
          </div>
        )}

        {showIntro && (
          <CinematicIntroOverlay
            onComplete={() => {
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('strikeline_intro_seen', 'true');
              }
              setShowIntro(false);
            }}
          />
        )}

        {settingsOpen && profile && (
          <SettingsModal
            settings={profile.settings}
            onSave={handleSaveSettings}
            onClose={() => setSettingsOpen(false)}
            onReplayIntro={() => setShowIntro(true)}
          />
        )}

        {legalDoc && !legalStandalone && (
          <LegalDocumentView
            doc={legalDoc}
            onSwitchDoc={(next) => openLegal(next, false)}
            onClose={closeLegal}
          />
        )}
      </div>
    </MotionConfig>
  );
}
