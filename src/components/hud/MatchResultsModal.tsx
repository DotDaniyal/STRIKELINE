import { useEffect } from 'react';
import { motion } from 'motion/react';
import { Award, Coins, MapPin, Zap } from 'lucide-react';
import type { MapId, MatchResultSummary, TeamId } from '../../../shared/types/game.ts';
import { MAPS } from '../../../shared/maps/index.ts';
import { audioEngine } from '../../game/audio/AudioEngine.ts';
import { TacticalButton } from '../ui/TacticalButton.tsx';

interface Props {
  matchResult: MatchResultSummary;
  localId: string;
  localTeam: TeamId;
  onLeaveMatch: () => void;
  onVoteMap: (mapId: MapId) => void;
}

export function MatchResultsModal({
  matchResult,
  localId,
  localTeam,
  onLeaveMatch,
  onVoteMap,
}: Props) {
  const isVictory =
    matchResult.winnerTeam === 'none'
      ? matchResult.winnerPlayerId === localId
      : matchResult.winnerTeam === localTeam;
  const localRow = matchResult.players.find((p) => p.id === localId);

  useEffect(() => {
    if (isVictory) audioEngine.playVictory();
    else audioEngine.playDefeat();
  }, [isVictory]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 bg-black/85 flex items-center justify-center pointer-events-auto z-40 p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 14 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-3xl bg-[#0c1018] border border-slate-700 sl-chamfer overflow-hidden max-h-[90vh] flex flex-col shadow-2xl"
      >
        <div className={`h-1 w-full ${isVictory ? 'bg-amber-500' : 'bg-rose-500'}`} />

        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono-tabular uppercase tracking-wider text-amber-400">
                <Award className="w-4 h-4" />
                <span>Match Complete · MVP: {matchResult.mvpUsername}</span>
              </div>
              <h2
                className={`font-display text-3xl sm:text-4xl font-bold uppercase tracking-wide mt-0.5 ${
                  isVictory ? 'text-amber-400' : 'text-slate-100'
                }`}
              >
                {matchResult.winnerTeam === 'none'
                  ? matchResult.winnerPlayerId === localId
                    ? 'Victory'
                    : 'Match Concluded'
                  : isVictory
                  ? 'Victory'
                  : 'Defeat'}
              </h2>
            </div>

            <div className="flex items-center gap-3">
              {localRow && (
                <div className="flex items-center gap-3 px-3.5 py-2 bg-[#07090e] border border-slate-800 sl-chamfer-sm text-xs font-mono-tabular">
                  <span className="flex items-center gap-1 text-sky-400 font-bold">
                    <Zap className="w-3.5 h-3.5" /> +{localRow.xpEarned} XP
                  </span>
                  <span className="h-3.5 w-px bg-slate-700" />
                  <span className="flex items-center gap-1 text-amber-400 font-bold">
                    <Coins className="w-3.5 h-3.5" /> +{localRow.creditsEarned} CR
                  </span>
                </div>
              )}
              <TacticalButton variant="primary" size="md" onClick={onLeaveMatch}>
                Return to Lobby
              </TacticalButton>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-800 bg-[#080b11]">
            <table className="w-full text-xs">
              <thead className="bg-[#0e1420] text-slate-400 font-mono-tabular uppercase text-[11px]">
                <tr>
                  <th className="text-left px-3 py-2.5">Operator</th>
                  <th className="text-right px-3 py-2.5">K / D / A</th>
                  <th className="text-right px-3 py-2.5">Score</th>
                  <th className="text-right px-3 py-2.5">Acc</th>
                  <th className="text-right px-3 py-2.5">XP</th>
                  <th className="text-right px-3 py-2.5">Credits</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 font-mono-tabular">
                {matchResult.players.map((p) => (
                  <tr
                    key={p.id}
                    className={
                      p.id === localId ? 'bg-amber-500/12 text-white' : 'text-slate-200'
                    }
                  >
                    <td className="px-3 py-2.5 font-sans font-semibold text-white">
                      {p.username}
                      {p.username === matchResult.mvpUsername && (
                        <span className="ml-2 text-[10px] font-mono-tabular uppercase px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          MVP
                        </span>
                      )}
                    </td>
                    <td className="text-right px-3 py-2.5">
                      {p.kills} / {p.deaths} / {p.assists}
                    </td>
                    <td className="text-right px-3 py-2.5 text-amber-400 font-bold">{p.score}</td>
                    <td className="text-right px-3 py-2.5">{p.accuracy}%</td>
                    <td className="text-right px-3 py-2.5 text-sky-400">+{p.xpEarned}</td>
                    <td className="text-right px-3 py-2.5 text-amber-300">+{p.creditsEarned}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {matchResult.mapVoteOptions.length > 0 && (
            <div className="space-y-2">
              <div className="text-[11px] font-mono-tabular uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-400" />
                Vote Next Combat Arena
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {matchResult.mapVoteOptions.map((mId) => (
                  <button
                    key={mId}
                    type="button"
                    onClick={() => {
                      audioEngine.playUiClick(700);
                      onVoteMap(mId);
                    }}
                    className="p-3 bg-[#080b11] border border-slate-700 hover:border-amber-500 sl-chamfer-sm text-left cursor-pointer transition"
                  >
                    <div className="font-display font-bold text-sm text-white uppercase">
                      {MAPS[mId]?.name}
                    </div>
                    <div className="text-xs text-amber-400 font-mono-tabular mt-0.5">
                      {matchResult.mapVotes[mId] ?? 0} votes
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
