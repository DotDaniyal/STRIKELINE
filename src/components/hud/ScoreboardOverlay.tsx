import type { MatchSummaryInfo, PlayerSettings, PlayerSnapshot } from '../../../shared/types/game.ts';
import { GAME_MODES } from '../../../shared/constants/modes.ts';
import { MAPS } from '../../../shared/maps/index.ts';
import { getTeamPalette } from '../../utils/theme.ts';

interface Props {
  match: MatchSummaryInfo;
  players: PlayerSnapshot[];
  localId: string;
  colorblindMode?: PlayerSettings['colorblindMode'];
  onReportPlayer?: (username: string) => void;
}

export function ScoreboardOverlay({
  match,
  players,
  localId,
  colorblindMode = 'none',
  onReportPlayer,
}: Props) {
  const modeCfg = GAME_MODES[match.mode];
  const palette = getTeamPalette(colorblindMode);

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/62 pointer-events-auto z-30 p-4">
      <div className="w-full max-w-3xl bg-[#0c1018] border border-slate-700 sl-chamfer overflow-hidden shadow-2xl">
        <div className="h-0.5 w-full bg-amber-500" />
        <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between gap-2">
          <span className="font-display font-bold text-base uppercase tracking-wide text-white">
            {modeCfg.name} · {MAPS[match.mapId]?.name}
          </span>
          <span className="text-xs font-mono-tabular text-slate-400">
            {players.length} / {match.maxPlayers} Operators
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-[#080b11] text-slate-400 font-mono-tabular uppercase text-[11px]">
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
                  <tr key={p.id} className={p.id === localId ? 'bg-amber-500/12' : ''}>
                    <td className="px-4 py-2 font-sans font-semibold text-slate-100">
                      <span
                        className={
                          p.team === 'alpha'
                            ? palette.alphaText
                            : p.team === 'bravo'
                            ? palette.bravoText
                            : 'text-slate-100'
                        }
                      >
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
  );
}
