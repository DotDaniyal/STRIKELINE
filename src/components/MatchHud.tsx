import { useState, type FormEvent } from 'react';
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
} from '../../shared/types/game.ts';
import type { HudTelemetry } from '../game/engine/GameEngine.ts';
import { WEAPONS } from '../../shared/constants/weapons.ts';
import { GAME_MODES } from '../../shared/constants/modes.ts';
import { MAPS } from '../../shared/constants/maps.ts';
import { CrosshairView } from './CrosshairView.tsx';

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
  onStartDrill,
  onReportPlayer,
  onLockPointer,
}: Props) {
  const [chatText, setChatText] = useState('');
  const weapon = WEAPONS[hud.weaponId];
  const modeCfg = match ? GAME_MODES[match.mode] : GAME_MODES.training;

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
      {/* Crosshair */}
      {!paused && !matchResult && !deathInfo && (
        <CrosshairView
          config={settings.crosshair}
          spreadRad={hud.spreadRad}
          isAds={hud.isAds}
          isSniper={hud.weaponId === 'longshot_sr'}
          hitmarker={hitmarker}
        />
      )}

      {/* Directional Damage Indicator */}
      {damageFlashAngle !== null && (
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-none"
          style={{ transform: `rotate(${damageFlashAngle}rad)` }}
        >
          <div className="w-36 h-36 border-t-4 border-rose-500 rounded-full opacity-85" />
        </div>
      )}

      {/* Top-Left Telemetry & Room Code */}
      <div className="fixed top-3 left-4 flex items-center gap-3 text-xs font-mono-tabular text-slate-300 bg-[#0b0e14]/80 px-3 py-1.5 rounded border border-slate-800 pointer-events-auto">
        {settings.showFps && (
          <>
            <span>{hud.fps} FPS</span>
            <span>·</span>
            <span>{hud.pingMs} ms</span>
            <span>·</span>
          </>
        )}
        <span>{MAPS[match?.mapId ?? 'training_range']?.name}</span>
        {match?.roomCode && (
          <>
            <span>·</span>
            <span className="text-amber-400">Code: {match.roomCode}</span>
          </>
        )}
        <button
          type="button"
          onClick={onToggleTouchMode}
          className="ml-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 cursor-pointer"
        >
          {touchMode ? 'Touch: ON' : 'Touch UI'}
        </button>
      </div>

      {/* Top-Center Mode Scoreboard & Objectives */}
      {match && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5">
          <div className="flex items-center gap-4 px-4 py-1.5 rounded bg-[#0b0e14]/85 border border-slate-800 font-mono-tabular">
            {modeCfg.teamBased ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-sky-400">ALPHA</span>
                  <span className="text-lg font-bold text-white">{match.alphaScore}</span>
                </div>
                <div className="px-2.5 py-0.5 rounded bg-slate-900 text-xs text-amber-400 font-bold">
                  {formatTime(match.timeRemainingSec)}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-white">{match.bravoScore}</span>
                  <span className="text-xs font-semibold text-rose-400">BRAVO</span>
                </div>
              </>
            ) : (
              <>
                <span className="text-xs font-semibold text-amber-400">{modeCfg.shortName}</span>
                <span className="text-sm font-bold text-white">{formatTime(match.timeRemainingSec)}</span>
                <span className="text-xs text-slate-400">Goal {match.scoreLimit}</span>
              </>
            )}
          </div>

          {/* Objective Badges */}
          {objectives.length > 0 && (
            <div className="flex items-center gap-2">
              {objectives
                .filter((o) => o.active)
                .map((o) => (
                  <div
                    key={o.id}
                    className={`px-2.5 py-1 rounded text-xs font-mono-tabular border ${
                      o.contested
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : o.owner === 'alpha'
                        ? 'bg-sky-500/20 border-sky-400 text-sky-200'
                        : o.owner === 'bravo'
                        ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                        : 'bg-[#0b0e14]/80 border-slate-700 text-slate-200'
                    }`}
                  >
                    {o.label}
                    {o.contested ? ' (Contested)' : o.capturingTeam !== 'none' ? ` ${Math.round(o.progress)}%` : ''}
                  </div>
                ))}
            </div>
          )}

          {flags.length > 0 && (
            <div className="flex items-center gap-3 text-xs font-mono-tabular bg-[#0b0e14]/80 px-3 py-1 rounded border border-slate-800">
              {flags.map((f) => (
                <span key={f.team} className={f.team === 'alpha' ? 'text-sky-400' : 'text-rose-400'}>
                  {f.team.toUpperCase()} Flag: {f.carrierId ? 'Carried' : f.atBase ? 'At Base' : 'Dropped'}
                </span>
              ))}
            </div>
          )}

          {match.state === 'countdown' && (
            <div className="mt-4 px-5 py-2 rounded bg-amber-500 text-slate-950 font-display font-bold text-sm tracking-wide">
              Match Starting — Prepare for Deployment
            </div>
          )}
        </div>
      )}

      {/* Training Range Aim Trainer Bar */}
      {hud.rangeStats && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 rounded bg-[#0b0e14]/90 border border-slate-700 pointer-events-auto">
          <span className="text-xs font-display font-bold text-amber-400">PROVING GROUNDS</span>
          <div className="flex items-center gap-1">
            {(['free', 'flick', 'tracking'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onStartDrill?.(d)}
                className={`px-2.5 py-1 rounded text-xs font-medium capitalize cursor-pointer ${
                  hud.rangeStats?.drillMode === d
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
          <div className="text-xs font-mono-tabular text-slate-200 flex items-center gap-3 pl-2 border-l border-slate-700">
            <span>
              Acc{' '}
              {hud.rangeStats.shots > 0
                ? Math.round((hud.rangeStats.hits / hud.rangeStats.shots) * 100)
                : 0}
              %
            </span>
            <span>HS {hud.rangeStats.headshots}</span>
            <span>Score {hud.rangeStats.drillScore}</span>
            {hud.rangeStats.drillTimeLeft > 0 && (
              <span className="text-amber-400">{hud.rangeStats.drillTimeLeft}s</span>
            )}
          </div>
        </div>
      )}

      {/* Top-Right Kill Feed */}
      <div className="fixed top-3 right-4 flex flex-col items-end gap-1.5">
        {killFeed.slice(0, 5).map((kf) => (
          <div
            key={kf.id}
            className="px-3 py-1 rounded bg-[#0b0e14]/85 border border-slate-800 text-xs flex items-center gap-2"
          >
            <span className={kf.attackerTeam === 'alpha' ? 'text-sky-400 font-semibold' : kf.attackerTeam === 'bravo' ? 'text-rose-400 font-semibold' : 'text-amber-300 font-semibold'}>
              {kf.attackerName}
            </span>
            <span className="text-slate-500 font-mono-tabular">
              [{WEAPONS[kf.weaponId]?.code ?? kf.weaponId}]
              {kf.headshot ? ' HS' : ''}
            </span>
            <span className={kf.victimTeam === 'alpha' ? 'text-sky-400' : kf.victimTeam === 'bravo' ? 'text-rose-400' : 'text-slate-300'}>
              {kf.victimName}
            </span>
          </div>
        ))}
      </div>

      {/* Streak / Combat Banner */}
      {streakBanner && (
        <div className="fixed top-28 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded bg-amber-500 text-slate-950 font-display font-bold text-sm tracking-wider shadow-lg">
          {streakBanner}
        </div>
      )}

      {/* Pointer Lock Prompt */}
      {!hud.pointerLocked && !paused && !deathInfo && !matchResult && !chatOpen.open && !touchMode && (
        <button
          type="button"
          onClick={onLockPointer}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-lg bg-[#0b0e14]/90 border border-amber-500/60 text-amber-300 text-xs font-semibold pointer-events-auto cursor-pointer hover:bg-slate-900"
        >
          Click Viewport to Lock Aim · Press Esc for Menu
        </button>
      )}

      {/* Bottom-Left Health & Chat Feed */}
      <div className="fixed bottom-5 left-5 flex flex-col gap-3">
        {/* Recent Chat */}
        <div className="w-72 space-y-1">
          {chatMessages.slice(-4).map((m) => (
            <div key={m.id} className="px-2.5 py-1 rounded bg-[#0b0e14]/75 text-xs text-slate-200">
              <span className="text-amber-400 font-semibold">
                {m.channel === 'team' ? '[TEAM] ' : ''}
                {m.senderName}:{' '}
              </span>
              <span>{m.text}</span>
            </div>
          ))}
        </div>

        {/* Quick Tactical Chat + Input */}
        {chatOpen.open ? (
          <form onSubmit={handleChatSubmit} className="pointer-events-auto flex items-center gap-2">
            <input
              autoFocus
              type="text"
              value={chatText}
              onChange={(e) => setChatText(e.target.value)}
              placeholder={chatOpen.teamOnly ? 'Team chat...' : 'Match chat...'}
              className="w-64 px-3 py-1.5 rounded bg-[#0b0e14]/95 border border-amber-500 text-xs text-white focus:outline-none"
            />
            <button
              type="button"
              onClick={onCloseChat}
              className="px-2 py-1.5 rounded bg-slate-800 text-xs text-slate-300 cursor-pointer"
            >
              Esc
            </button>
          </form>
        ) : null}

        {/* Health Card */}
        <div className="w-64 px-4 py-3 rounded-lg bg-[#0b0e14]/85 border border-slate-800">
          <div className="flex items-baseline justify-between mb-1.5">
            <span className="text-xs font-medium text-slate-400">
              {localTeam !== 'none' ? `${localTeam.toUpperCase()} SQUAD` : 'OPERATIVE HP'}
            </span>
            <span className="font-display text-2xl font-bold text-slate-50 tabular-nums">
              {hud.hp}
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className={`h-full transition-all duration-100 ${
                hud.hp > 50 ? 'bg-cyan-400' : hud.hp > 25 ? 'bg-amber-400' : 'bg-rose-500'
              }`}
              style={{ width: `${Math.max(0, Math.min(100, (hud.hp / hud.maxHp) * 100))}%` }}
            />
          </div>
        </div>
      </div>

      {/* Bottom-Right Weapon & Ammo */}
      <div className="fixed bottom-5 right-5 px-5 py-3 rounded-lg bg-[#0b0e14]/85 border border-slate-800 text-right">
        <div className="text-xs font-medium text-amber-400">{weapon.name}</div>
        <div className="font-display text-3xl font-bold text-white tabular-nums mt-0.5">
          {hud.isReloading ? (
            <span className="text-lg text-amber-400">RELOADING...</span>
          ) : (
            <>
              {hud.ammo} <span className="text-base text-slate-400 font-normal">/ {hud.reserve}</span>
            </>
          )}
        </div>
        <div className="text-[11px] text-slate-400 font-mono-tabular mt-0.5">
          [1] Primary · [2] Sidearm · [R] Reload · [T] Spray
        </div>
      </div>

      {/* Death / Respawn / Spectator Overlay */}
      {deathInfo && !matchResult && (
        <div className="fixed inset-x-0 top-1/3 flex flex-col items-center justify-center pointer-events-none">
          <div className="px-6 py-4 rounded-xl bg-[#0b0e14]/92 border border-rose-500/50 text-center">
            <div className="text-xs uppercase tracking-wider text-rose-400 font-semibold">
              Eliminated {deathInfo.headshot ? '· Headshot' : ''}
            </div>
            <div className="font-display text-xl font-bold text-white mt-1">
              {deathInfo.attackerName} <span className="text-slate-400 text-sm">[{deathInfo.weaponId}]</span>
            </div>
            <div className="mt-2 text-xs font-mono-tabular text-amber-400">
              Respawning in {deathInfo.respawnIn}s
              {hud.spectatingName ? ` · Spectating ${hud.spectatingName} ([Space] Next)` : ''}
            </div>
          </div>
        </div>
      )}

      {/* Tab Scoreboard */}
      {showScoreboard && match && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/55 pointer-events-auto z-30 p-4">
          <div className="w-full max-w-3xl bg-[#111620] border border-slate-700 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
              <span className="font-display font-bold text-base text-white">
                {modeCfg.name} · {MAPS[match.mapId]?.name}
              </span>
              <span className="text-xs font-mono-tabular text-slate-400">
                {players.length} / {match.maxPlayers} Operators
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-[#0b0e14] text-slate-400">
                  <tr>
                    <th className="text-left px-4 py-2.5">Operator</th>
                    <th className="text-right px-3 py-2.5">Score</th>
                    <th className="text-right px-3 py-2.5">Kills</th>
                    <th className="text-right px-3 py-2.5">Deaths</th>
                    <th className="text-right px-3 py-2.5">Assists</th>
                    <th className="text-right px-3 py-2.5">HS</th>
                    <th className="text-right px-4 py-2.5">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 font-mono-tabular">
                  {[...players]
                    .sort((a, b) => b.score - a.score || b.kills - a.kills)
                    .map((p) => (
                      <tr key={p.id} className={p.id === localId ? 'bg-amber-500/10' : ''}>
                        <td className="px-4 py-2 font-sans font-medium text-slate-100">
                          <span className={p.team === 'alpha' ? 'text-sky-400' : p.team === 'bravo' ? 'text-rose-400' : 'text-slate-100'}>
                            {p.clanTag ? `[${p.clanTag}] ` : ''}
                            {p.username}
                          </span>
                        </td>
                        <td className="text-right px-3 py-2 text-amber-400 font-bold">{p.score}</td>
                        <td className="text-right px-3 py-2">{p.kills}</td>
                        <td className="text-right px-3 py-2">{p.deaths}</td>
                        <td className="text-right px-3 py-2">{p.assists}</td>
                        <td className="text-right px-3 py-2">{p.headshots}</td>
                        <td className="text-right px-4 py-2">
                          {p.id !== localId && !p.isBot && (
                            <button
                              type="button"
                              onClick={() => onReportPlayer?.(p.username)}
                              className="text-[11px] text-slate-400 hover:text-rose-400 cursor-pointer"
                            >
                              Report
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Esc Pause Modal */}
      {paused && !matchResult && (
        <div className="fixed inset-0 bg-black/75 flex items-center justify-center pointer-events-auto z-40 p-4">
          <div className="w-full max-w-sm bg-[#111620] border border-slate-700 rounded-xl p-6 space-y-3">
            <h2 className="font-display text-2xl font-bold text-white">Match Paused</h2>
            <p className="text-xs text-slate-400">
              {modeCfg.name} · {MAPS[match?.mapId ?? 'training_range']?.name}
            </p>
            <div className="pt-2 space-y-2.5">
              <button
                type="button"
                onClick={onResume}
                className="w-full py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm cursor-pointer"
              >
                Resume Match
              </button>
              <button
                type="button"
                onClick={onOpenSettings}
                className="w-full py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 font-medium text-sm cursor-pointer"
              >
                Settings & Crosshair
              </button>
              <button
                type="button"
                onClick={onLeaveMatch}
                className="w-full py-2.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/35 border border-rose-500/40 text-rose-300 font-medium text-sm cursor-pointer"
              >
                Return to Lobby
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Match Results & Map Vote Modal */}
      {matchResult && (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center pointer-events-auto z-40 p-4">
          <div className="w-full max-w-3xl bg-[#111620] border border-slate-700 rounded-xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-mono-tabular text-amber-400">
                  Match Complete · MVP: {matchResult.mvpUsername}
                </div>
                <h2 className="font-display text-3xl font-bold text-white mt-0.5">
                  {matchResult.winnerTeam === 'none'
                    ? matchResult.winnerPlayerId === localId
                      ? 'Victory'
                      : 'Match Concluded'
                    : matchResult.winnerTeam === localTeam
                    ? 'Victory'
                    : 'Defeat'}
                </h2>
              </div>
              <button
                type="button"
                onClick={onLeaveMatch}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white cursor-pointer"
              >
                Exit to Lobby
              </button>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-[#0b0e14] text-slate-400">
                  <tr>
                    <th className="text-left px-3 py-2">Operator</th>
                    <th className="text-right px-3 py-2">K / D / A</th>
                    <th className="text-right px-3 py-2">Score</th>
                    <th className="text-right px-3 py-2">Acc</th>
                    <th className="text-right px-3 py-2">XP</th>
                    <th className="text-right px-3 py-2">Credits</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 font-mono-tabular">
                  {matchResult.players.map((p) => (
                    <tr key={p.id} className={p.id === localId ? 'bg-amber-500/10' : ''}>
                      <td className="px-3 py-2 font-sans font-semibold text-white">{p.username}</td>
                      <td className="text-right px-3 py-2">
                        {p.kills} / {p.deaths} / {p.assists}
                      </td>
                      <td className="text-right px-3 py-2 text-amber-400">{p.score}</td>
                      <td className="text-right px-3 py-2">{p.accuracy}%</td>
                      <td className="text-right px-3 py-2 text-cyan-400">+{p.xpEarned}</td>
                      <td className="text-right px-3 py-2 text-amber-300">+{p.creditsEarned}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Next Map Voting */}
            {matchResult.mapVoteOptions.length > 0 && (
              <div>
                <div className="text-xs text-slate-400 mb-2">Vote Next Map (Rotating Automatically):</div>
                <div className="grid grid-cols-3 gap-3">
                  {matchResult.mapVoteOptions.map((mId) => (
                    <button
                      key={mId}
                      type="button"
                      onClick={() => onVoteMap(mId)}
                      className="p-3 rounded-lg bg-[#0b0e14] border border-slate-700 hover:border-amber-500 text-left cursor-pointer"
                    >
                      <div className="font-display font-bold text-sm text-white">{MAPS[mId]?.name}</div>
                      <div className="text-xs text-amber-400 font-mono-tabular mt-0.5">
                        {matchResult.mapVotes[mId] ?? 0} votes
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
