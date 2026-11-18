import { useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import type {
  ChatMessage,
  FlagRuntimeState,
  KillFeedEntry,
  MapId,
  MatchResultSummary,
  MatchSummaryInfo,
  ObjectiveRuntimeState,
  PlayerSettings,
  PlayerSnapshot,
  TeamId,
} from '../../../shared/types/game.ts';
import type { HudTelemetry } from '../../game/engine/GameEngine.ts';
import { WEAPONS } from '../../../shared/constants/weapons.ts';
import { GAME_MODES } from '../../../shared/constants/modes.ts';
import { MAPS } from '../../../shared/maps/index.ts';
import { getTeamPalette } from '../../utils/theme.ts';
import { CrosshairView } from './CrosshairView.tsx';
import { Minimap } from './Minimap.tsx';
import { WeaponHotbar } from './WeaponHotbar.tsx';
import { ScoreboardOverlay } from './ScoreboardOverlay.tsx';
import { MatchResultsModal } from './MatchResultsModal.tsx';
import { TacticalButton } from '../ui/TacticalButton.tsx';

interface Props {
  hud: HudTelemetry;
  match: MatchSummaryInfo | null;
  players: PlayerSnapshot[];
  objectives: ObjectiveRuntimeState[];
  flags: FlagRuntimeState[];
  killFeed: KillFeedEntry[];
  chatMessages: ChatMessage[];
  settings: PlayerSettings;
  hitmarker: { active: boolean; headshot: boolean };
  damageFlashAngle: number | null;
  deathInfo: { attackerName: string; weaponId: string; headshot: boolean; respawnIn: number } | null;
  streakBanner: string | null;
  paused: boolean;
  showScoreboard: boolean;
  chatOpen: { open: boolean; teamOnly: boolean };
  matchResult: MatchResultSummary | null;
  localId: string;
  localTeam: TeamId;
  touchMode: boolean;
  onToggleTouchMode: () => void;
  onResume: () => void;
  onOpenSettings: () => void;
  onLeaveMatch: () => void;
  onSendChat: (channel: 'match' | 'team', text: string) => void;
  onCloseChat: () => void;
  onVoteMap: (mapId: MapId) => void;
  onSwapSlot?: (slot: 1 | 2) => void;
  onStartDrill?: (drill: 'free' | 'flick' | 'tracking') => void;
  onReportPlayer?: (username: string) => void;
  onLockPointer: () => void;
}

export function MatchHud({
  hud,
  match,
  players,
  objectives,
  flags,
  killFeed,
  chatMessages,
  settings,
  hitmarker,
  damageFlashAngle,
  deathInfo,
  streakBanner,
  paused,
  showScoreboard,
  chatOpen,
  matchResult,
  localId,
  localTeam,
  touchMode,
  onToggleTouchMode,
  onResume,
  onOpenSettings,
  onLeaveMatch,
  onSendChat,
  onCloseChat,
  onVoteMap,
  onSwapSlot,
  onStartDrill,
  onReportPlayer,
  onLockPointer,
}: Props) {
  const [chatText, setChatText] = useState('');
  const weapon = WEAPONS[hud.weaponId];
  const modeCfg = match ? GAME_MODES[match.mode] : GAME_MODES.training;
  const activeMapId: MapId = match?.mapId ?? 'training_range';
  const palette = getTeamPalette(settings.colorblindMode);
  const isLowHp = !deathInfo && hud.hp > 0 && hud.hp <= 30;

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const handleChatSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (chatText.trim()) {
      onSendChat(chatOpen.teamOnly ? 'team' : 'match', chatText.trim());
    }
    setChatText('');
    onCloseChat();
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-20 select-none">
      {/* Low-HP Critical Vignette */}
      {isLowHp && !matchResult && (
        <div className="fixed inset-0 sl-low-hp-vignette pointer-events-none" aria-hidden="true" />
      )}

      {/* Crosshair & Hitmarkers */}
      {!paused && !matchResult && !deathInfo && (
        <CrosshairView
          config={settings.crosshair}
          spreadRad={hud.spreadRad}
          isAds={hud.isAds}
          isSniper={hud.weaponId === 'longshot_sr'}
          hitmarker={hitmarker}
          headshotHex={palette.headshotHex}
        />
      )}

      {/* Directional Damage Arc */}
      {damageFlashAngle !== null && (
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-none"
          style={{ transform: `rotate(${damageFlashAngle}rad)` }}
        >
          <div
            className="w-44 h-44 border-t-[5px] rounded-full opacity-90"
            style={{ borderTopColor: palette.bravoHex }}
          />
        </div>
      )}

      {/* Top-Left Telemetry & Tactical Minimap */}
      <div className="fixed top-3 left-3 sm:left-4 flex flex-col gap-2">
        <div className="flex items-center gap-2.5 text-[11px] font-mono-tabular text-slate-300 bg-[#07090e]/85 px-2.5 py-1.5 sl-chamfer-sm border border-slate-800 pointer-events-auto">
          {settings.showFps && (
            <>
              <span className="text-slate-200">{hud.fps} FPS</span>
              <span className="text-slate-600">/</span>
              <span className={hud.pingMs > 120 ? 'text-amber-400' : 'text-emerald-400'}>
                {hud.pingMs} ms
              </span>
              <span className="hidden sm:inline text-slate-600">/</span>
            </>
          )}
          <span className="hidden sm:inline">{MAPS[activeMapId]?.name}</span>
          {match?.roomCode && (
            <span className="text-amber-400 font-bold">{match.roomCode}</span>
          )}
          <button
            type="button"
            onClick={onToggleTouchMode}
            className="ml-0.5 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-200 cursor-pointer whitespace-nowrap"
          >
            {touchMode ? 'Touch: ON' : 'Touch'}
          </button>
        </div>

        {!showScoreboard && !matchResult && !(hud.weaponId === 'longshot_sr' && hud.isAds) && (
          <div className="hidden sm:block">
            <Minimap
              mapId={activeMapId}
              localId={localId}
              localTeam={localTeam}
              localPos={hud.pos}
              localYaw={hud.yaw}
              players={players}
              objectives={objectives}
              flags={flags}
              colorblindMode={settings.colorblindMode}
            />
          </div>
        )}
      </div>

      {/* Top-Center Mode Scoreboard & Objectives */}
      {match && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-3 sm:gap-4 px-4 py-1.5 bg-[#07090e]/90 border border-slate-800 sl-chamfer-sm font-mono-tabular shadow-lg">
            {modeCfg.teamBased ? (
              <>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold uppercase ${palette.alphaText}`}>ALPHA</span>
                  <span className="font-display text-lg font-bold text-white">{match.alphaScore}</span>
                </div>
                <div className="px-2.5 py-0.5 bg-[#121824] border border-slate-700 text-xs text-amber-400 font-bold">
                  {formatTime(match.timeRemainingSec)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-display text-lg font-bold text-white">{match.bravoScore}</span>
                  <span className={`text-[11px] font-bold uppercase ${palette.bravoText}`}>BRAVO</span>
                </div>
              </>
            ) : (
              <>
                <span className="text-xs font-bold text-amber-400">{modeCfg.shortName}</span>
                <span className="font-display text-sm font-bold text-white">
                  {formatTime(match.timeRemainingSec)}
                </span>
                <span className="text-[11px] text-slate-400">Goal {match.scoreLimit}</span>
              </>
            )}
          </div>

          {objectives.length > 0 && (
            <div className="flex items-center gap-1.5">
              {objectives
                .filter((o) => o.active)
                .map((o) => (
                  <div
                    key={o.id}
                    className={`px-2.5 py-1 text-[11px] font-mono-tabular border sl-chamfer-sm ${
                      o.contested
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : o.owner === 'alpha'
                        ? `${palette.alphaBg} ${palette.alphaBorder} ${palette.alphaText}`
                        : o.owner === 'bravo'
                        ? `${palette.bravoBg} ${palette.bravoBorder} ${palette.bravoText}`
                        : 'bg-[#07090e]/85 border-slate-700 text-slate-200'
                    }`}
                  >
                    {o.label}
                    {o.contested
                      ? ' CONTESTED'
                      : o.capturingTeam !== 'none'
                      ? ` ${Math.round(o.progress)}%`
                      : ''}
                  </div>
                ))}
            </div>
          )}

          {flags.length > 0 && (
            <div className="flex items-center gap-3 text-[11px] font-mono-tabular bg-[#07090e]/85 px-3 py-1 sl-chamfer-sm border border-slate-800">
              {flags.map((f) => (
                <span key={f.team} className={f.team === 'alpha' ? palette.alphaText : palette.bravoText}>
                  {f.team.toUpperCase()}: {f.carrierId ? 'Carried' : f.atBase ? 'Base' : 'Dropped'}
                </span>
              ))}
            </div>
          )}

          {match.state === 'countdown' && (
            <div className="mt-3 px-5 py-2 sl-chamfer-sm bg-amber-500 text-slate-950 font-display font-bold text-xs uppercase tracking-wider shadow-lg">
              Match Starting: Prepare for Deployment
            </div>
          )}
        </div>
      )}

      {/* Training Range Aim Trainer Bar */}
      {hud.rangeStats && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-2.5 px-3.5 py-2 bg-[#07090e]/92 border border-slate-700 sl-chamfer-sm pointer-events-auto max-w-[92vw]">
          <span className="text-[11px] font-display font-bold uppercase tracking-wider text-amber-400">
            Proving Grounds
          </span>
          <div className="flex items-center gap-1">
            {(['free', 'flick', 'tracking'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onStartDrill?.(d)}
                className={`px-2.5 py-1 text-[11px] font-display uppercase font-bold cursor-pointer sl-chamfer-sm ${
                  hud.rangeStats?.drillMode === d
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="text-[11px] font-mono-tabular text-slate-200 flex items-center gap-2.5 pl-2 border-l border-slate-700">
            <span>
              Acc{' '}
              {hud.rangeStats.shots > 0
                ? Math.round((hud.rangeStats.hits / hud.rangeStats.shots) * 100)
                : 0}
              %
            </span>
            <span>HS {hud.rangeStats.headshots}</span>
            <span className="text-amber-400 font-bold">Score {hud.rangeStats.drillScore}</span>
            {hud.rangeStats.drillTimeLeft > 0 && (
              <span className="text-sky-400 font-bold">{hud.rangeStats.drillTimeLeft}s</span>
            )}
          </div>
        </div>
      )}

      {/* Top-Right Kill Feed */}
      <div className="fixed top-3 right-3 sm:right-4 hidden sm:flex flex-col items-end gap-1.5">
        {killFeed.slice(0, 5).map((kf) => (
          <div
            key={kf.id}
            className="px-3 py-1 bg-[#07090e]/85 border border-slate-800 sl-chamfer-sm text-xs flex items-center gap-2"
          >
            <span
              className={
                kf.attackerTeam === 'alpha'
                  ? `${palette.alphaText} font-semibold`
                  : kf.attackerTeam === 'bravo'
                  ? `${palette.bravoText} font-semibold`
                  : 'text-amber-300 font-semibold'
              }
            >
              {kf.attackerName}
            </span>
            <span className="text-slate-400 font-mono-tabular text-[11px]">
              [{WEAPONS[kf.weaponId]?.code ?? kf.weaponId}]
              {kf.headshot ? <span className="text-rose-400 font-bold ml-1">HS</span> : ''}
            </span>
            <span
              className={
                kf.victimTeam === 'alpha'
                  ? palette.alphaText
                  : kf.victimTeam === 'bravo'
                  ? palette.bravoText
                  : 'text-slate-300'
              }
            >
              {kf.victimName}
            </span>
          </div>
        ))}
      </div>

      {/* Kill Streak Banner */}
      <AnimatePresence>
        {streakBanner && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="fixed top-28 left-1/2 -translate-x-1/2 px-5 py-1.5 sl-chamfer-sm bg-amber-500 text-slate-950 font-display font-bold text-sm uppercase tracking-wider shadow-lg"
          >
            {streakBanner}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Center Reload Progress Bar */}
      {hud.isReloading && !paused && !deathInfo && (
        <div className="fixed top-[57%] left-1/2 -translate-x-1/2 w-32 space-y-1">
          <div className="text-center text-[10px] font-mono-tabular uppercase tracking-widest text-amber-400 font-bold">
            Reloading
          </div>
          <div className="h-1 bg-[#07090e]/90 border border-slate-700 overflow-hidden">
            <div
              className="h-full bg-amber-500 transition-[width] duration-75"
              style={{ width: `${Math.round(hud.reloadProgress * 100)}%` }}
            />
          </div>
        </div>
      )}

      {!hud.pointerLocked && !paused && !deathInfo && !matchResult && !chatOpen.open && !touchMode && (
        <button
          type="button"
          onClick={onLockPointer}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 px-5 py-2.5 sl-chamfer-sm bg-[#07090e]/92 border border-amber-500/65 text-amber-300 font-display text-xs font-bold uppercase tracking-wider pointer-events-auto cursor-pointer hover:bg-[#121824] whitespace-nowrap"
        >
          Click Viewport to Lock Aim · Esc Menu
        </button>
      )}

      {/* Bottom-Left Health & Chat Feed */}
      <div className="fixed bottom-3 sm:bottom-5 left-3 sm:left-5 flex flex-col gap-2.5 max-w-[calc(100vw-24px)]">
        <div className="hidden sm:block w-72 space-y-1">
          {chatMessages.slice(-4).map((m) => (
            <div key={m.id} className="px-2.5 py-1 bg-[#07090e]/82 border border-slate-800/90 sl-chamfer-sm text-xs text-slate-200">
              <span className="text-amber-400 font-semibold">
                {m.channel === 'team' ? '[TEAM] ' : ''}
                {m.senderName}:{' '}
              </span>
              <span>{m.text}</span>
            </div>
          ))}
        </div>

        {chatOpen.open && (
          <form onSubmit={handleChatSubmit} className="pointer-events-auto flex items-center gap-2">
            <input
              autoFocus
              type="text"
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder={chatOpen.teamOnly ? 'Team chat...' : 'Match chat...'}
              className="w-64 px-3 py-1.5 bg-[#07090e]/95 border border-amber-500 text-xs text-white focus:outline-none"
            />
            <button
              type="button"
              onClick={onCloseChat}
              className="px-2.5 py-1.5 bg-slate-800 text-xs text-slate-300 cursor-pointer"
            >
              Esc
            </button>
          </form>
        )}

        <div className="w-48 sm:w-64 px-3.5 py-2.5 bg-[#07090e]/90 border border-slate-800 sl-chamfer-sm shadow-lg">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-[10px] font-mono-tabular uppercase tracking-wider text-slate-400">
              {localTeam !== 'none' ? `${localTeam.toUpperCase()} SQUAD` : 'ARMOR / HP'}
            </span>
            <span
              className={`font-display text-xl sm:text-2xl font-bold tabular-nums ${
                isLowHp ? 'text-rose-400' : 'text-slate-50'
              }`}
            >
              {hud.hp}
            </span>
          </div>
          <div className="w-full h-2 bg-[#121824] overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-100 ${
                hud.hp > 50 ? 'bg-sky-400' : hud.hp > 25 ? 'bg-amber-400' : 'bg-rose-500'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Bottom-Right Weapon Telemetry & Hotbar */}
      <div className="fixed bottom-3 sm:bottom-5 right-3 sm:right-5 flex flex-col items-end gap-2">
        <div className="hidden sm:block">
          <WeaponHotbar
            primaryWeapon={hud.primaryWeapon}
            secondaryWeapon={hud.secondaryWeapon}
            activeWeapon={hud.weaponId}
            onSelectSlot={onSwapSlot}
          />
        </div>

        <div className="px-4 py-2.5 bg-[#07090e]/90 border border-slate-800 sl-chamfer-sm text-right shadow-lg">
          <div className="text-[11px] font-display font-bold uppercase tracking-wider text-amber-400">
            {weapon.name}
          </div>
          <div className="font-display text-2xl sm:text-3xl font-bold text-white tabular-nums mt-0.5">
            {hud.isReloading ? (
              <span className="text-base sm:text-lg text-amber-400">RELOADING</span>
            ) : (
              <>
                {hud.ammo} <span className="text-sm sm:text-base text-slate-400 font-normal">/ {hud.reserve}</span>
              </>
            )}
          </div>
          <div className="hidden sm:block text-[10px] text-slate-400 font-mono-tabular mt-0.5">
            [1] Primary · [2] Sidearm · [R] Reload · [T] Spray
          </div>
        </div>
      </div>

      {/* Elimination Card */}
      <AnimatePresence>
        {deathInfo && !matchResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-x-0 top-1/3 flex flex-col items-center justify-center pointer-events-none px-4"
          >
            <div className="px-6 py-4 sl-chamfer bg-[#07090e]/94 border border-rose-500/60 text-center shadow-2xl">
              <div className="text-[11px] font-mono-tabular uppercase tracking-widest text-rose-400 font-bold">
                Eliminated {deathInfo.headshot ? '· Headshot' : ''}
              </div>
              <div className="font-display text-xl font-bold text-white mt-1">
                {deathInfo.attackerName}{' '}
                <span className="text-slate-400 font-mono-tabular text-xs">[{deathInfo.weaponId}]</span>
              </div>
              <div className="mt-2 text-xs font-mono-tabular text-amber-400">
                Respawning in {deathInfo.respawnIn}s
                {hud.spectatingName ? ` · Spectating ${hud.spectatingName} ([Space] Next)` : ''}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showScoreboard && match && (
        <ScoreboardOverlay
          match={match}
          players={players}
          localId={localId}
          colorblindMode={settings.colorblindMode}
          onReportPlayer={onReportPlayer}
        />
      )}

      {/* Pause Menu */}
      <AnimatePresence>
        {paused && !matchResult && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/78 flex items-center justify-center pointer-events-auto z-40 p-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              className="w-full max-w-sm bg-[#0c1018] border border-slate-700 sl-chamfer overflow-hidden shadow-2xl"
            >
              <div className="h-0.5 w-full bg-amber-500" />
              <div className="p-6 space-y-4">
                <div>
                  <div className="text-[10px] font-mono-tabular uppercase tracking-widest text-amber-400">
                    System Menu
                  </div>
                  <h2 className="font-display text-2xl font-bold uppercase text-white">Match Paused</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {modeCfg.name} · {MAPS[activeMapId]?.name}
                  </p>
                </div>
                <div className="space-y-2.5 pt-1">
                  <TacticalButton variant="primary" size="lg" className="w-full" onClick={onResume}>
                    Resume Match
                  </TacticalButton>
                  <TacticalButton variant="secondary" size="md" className="w-full" onClick={onOpenSettings}>
                    Settings &amp; Crosshair
                  </TacticalButton>
                  <TacticalButton variant="danger" size="md" className="w-full" onClick={onLeaveMatch}>
                    Return to Lobby
                  </TacticalButton>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {matchResult && (
        <MatchResultsModal
          matchResult={matchResult}
          localId={localId}
          localTeam={localTeam}
          onLeaveMatch={onLeaveMatch}
          onVoteMap={onVoteMap}
        />
      )}
    </div>
  );
}
