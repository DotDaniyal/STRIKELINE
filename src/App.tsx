import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Mic, MicOff, X } from 'lucide-react';
import type {
  ChatMessage,
  FlagRuntimeState,
  GameModeId,
  KillFeedEntry,
  MapId,
  MatchMutators,
  MatchResultSummary,
  MatchSummaryInfo,
  ObjectiveRuntimeState,
  PartyInvite,
  PartyState,
  PlayerSettings,
  PlayerSnapshot,
  RegionId,
  ServerMessage,
  TeamId,
  UserProfile,
} from '../shared/types/game.ts';
import { DEFAULT_SETTINGS } from '../shared/constants/modes.ts';
import { api, getAuthToken, setAuthToken } from './services/api.ts';
import { socketClient } from './network/SocketClient.ts';
import { GameEngine, type HudTelemetry } from './game/engine/GameEngine.ts';
import { audioEngine } from './game/audio/AudioEngine.ts';
import { TitleAuthScreen } from './components/TitleAuthScreen.tsx';
import { LobbyWorkspace } from './components/LobbyWorkspace.tsx';
import { MatchHud } from './components/MatchHud.tsx';
import { MobileControls } from './components/MobileControls.tsx';
import { SettingsModal } from './components/SettingsModal.tsx';

const INITIAL_HUD: HudTelemetry = {
  hp: 100,
  maxHp: 100,
  ammo: 30,
  magSize: 30,
  reserve: 150,
  weaponId: 'vanguard_ar',
  isReloading: false,
  isAds: false,
  spreadRad: 0.02,
  fps: 60,
  pingMs: 12,
  pointerLocked: false,
  spectatingName: null,
};

export default function App() {
  const [booting, setBooting] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [screen, setScreen] = useState<'auth' | 'lobby' | 'match'>('auth');
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voicePeersRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  const gameCanvasRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const pendingAutoStartBotsRef = useRef(false);
  const hitmarkerTimerRef = useRef<number | null>(null);
  const damageTimerRef = useRef<number | null>(null);
  const streakTimerRef = useRef<number | null>(null);
  const profileRef = useRef<UserProfile | null>(null);
  profileRef.current = profile;

  const showToast = useCallback((title: string, body: string) => {
    setToast({ title, body });
    window.setTimeout(() => setToast(null), 4000);
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

  // WebRTC voice signaling cleanup helper
  const stopVoice = useCallback(() => {
    voiceStreamRef.current?.getTracks().forEach((t) => t.stop());
    voiceStreamRef.current = null;
    for (const pc of voicePeersRef.current.values()) pc.close();
    voicePeersRef.current.clear();
    setVoiceActive(false);
  }, []);

  const createVoicePeer = useCallback(async (peerId: string, initiator: boolean) => {
    if (!voiceStreamRef.current) return null;
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    voicePeersRef.current.set(peerId, pc);
    voiceStreamRef.current.getTracks().forEach((tr) => pc.addTrack(tr, voiceStreamRef.current!));

    pc.onicecandidate = (ev) => {
      if (ev.candidate) {
        socketClient.send({ type: 'voice_signal', targetId: peerId, signal: { candidate: ev.candidate } });
      }
    };
    pc.ontrack = (ev) => {
      const audio = new Audio();
      audio.srcObject = ev.streams[0];
      audio.volume = profileRef.current?.settings.voiceVolume ?? 0.85;
      audio.play().catch(() => {});
    };

    if (initiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketClient.send({ type: 'voice_signal', targetId: peerId, signal: { sdp: offer } });
    }
    return pc;
  }, []);

  const toggleVoiceChat = async () => {
    if (voiceActive) {
      stopVoice();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      voiceStreamRef.current = stream;
      setVoiceActive(true);
      for (const p of matchPlayers) {
        if (p.id !== localId && !p.isBot && (localTeam === 'none' || p.team === localTeam)) {
          await createVoicePeer(p.id, true);
        }
      }
      showToast('Voice Channel Active', 'Microphone linked to squad channel.');
    } catch {
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
        case 'voice_signal': {
          const sig = msg.signal as { sdp?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit };
          let pc = voicePeersRef.current.get(msg.fromId) ?? null;
          if (!pc && voiceStreamRef.current) {
            pc = await createVoicePeer(msg.fromId, false);
          }
          if (!pc) break;
          if (sig.sdp) {
            await pc.setRemoteDescription(new RTCSessionDescription(sig.sdp));
            if (sig.sdp.type === 'offer') {
              const ans = await pc.createAnswer();
              await pc.setLocalDescription(ans);
              socketClient.send({ type: 'voice_signal', targetId: msg.fromId, signal: { sdp: ans } });
            }
          } else if (sig.candidate) {
            await pc.addIceCandidate(new RTCIceCandidate(sig.candidate));
          }
          break;
        }
      }
    });
    return () => {
      unsub();
    };
  }, [localId, localTeam, matchPlayers, showToast, stopVoice, createVoicePeer]);

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
    stopVoice();
    setProfile(null);
    setScreen('auth');
  };

  if (booting) {
    return (
      <div className="min-h-screen bg-[#080a0f] flex items-center justify-center text-slate-300 font-display uppercase tracking-widest text-sm">
        Initializing Strikeline Combat Systems...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080a0f] text-slate-100 select-none">
      {/* Global Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 max-w-sm bg-[#111620] border border-amber-500/50 rounded-xl px-4 py-3 shadow-2xl flex items-start justify-between gap-3">
          <div>
            <div className="font-display font-bold text-xs uppercase text-amber-400">{toast.title}</div>
            <div className="text-xs text-slate-200 mt-0.5">{toast.body}</div>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Auth / Title Screen */}
      {screen === 'auth' || !profile ? (
        <TitleAuthScreen
          onAuthenticated={(p, token) => {
            setProfile(p);
            setLocalId(p.id);
            audioEngine.applySettings(p.settings || DEFAULT_SETTINGS);
            socketClient.connect(token);
            setScreen('lobby');
          }}
        />
      ) : null}

      {/* Lobby Workspace */}
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
        />
      )}

      {/* Active 3D Match / Training Viewport */}
      {screen === 'match' && profile && (
        <div className="fixed inset-0 bg-black overflow-hidden">
          <div ref={gameCanvasRef} className="fixed inset-0 z-0" />

          {/* Team Voice Chat Toggle Button (top-right below killfeed area) */}
          {!isTraining && (
            <button
              type="button"
              onClick={toggleVoiceChat}
              className={`fixed bottom-24 left-5 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                voiceActive
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200'
                  : 'bg-[#0c1017]/90 border-slate-700 text-slate-300 hover:text-white'
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

          {/* In-Match Player Report Modal */}
          {reportTarget && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
              <form
                onSubmit={async (e: FormEvent) => {
                  e.preventDefault();
                  await api.submitReport(reportTarget, reportReason, reportDetails);
                  setReportTarget(null);
                  setReportDetails('');
                  showToast('Report Filed', `Submitted report for ${reportTarget}.`);
                }}
                className="w-full max-w-md bg-[#111620] border border-slate-700 rounded-xl p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-base text-white">
                    Report Operator: {reportTarget}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setReportTarget(null)}
                    className="text-slate-400 hover:text-white cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full bg-[#090d14] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
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
                  className="w-full bg-[#090d14] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setReportTarget(null)}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg bg-rose-600 text-xs font-bold text-white cursor-pointer"
                  >
                    Submit Report
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* Global Settings & Crosshair Studio Modal */}
      {settingsOpen && profile && (
        <SettingsModal
          settings={profile.settings}
          onSave={handleSaveSettings}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
