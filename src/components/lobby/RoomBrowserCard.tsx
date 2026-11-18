import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { MatchSummaryInfo } from '../../../shared/types/game.ts';
import { api } from '../../services/api.ts';
import { audioEngine } from '../../game/audio/AudioEngine.ts';
import { TacticalPanel } from '../ui/TacticalPanel.tsx';
import { TacticalButton } from '../ui/TacticalButton.tsx';

interface Props {
  joinCodeLabel: string;
  onJoinRoom: (roomCode?: string, roomId?: string, password?: string) => void;
}

export function RoomBrowserCard({ joinCodeLabel, onJoinRoom }: Props) {
  const [publicRooms, setPublicRooms] = useState<MatchSummaryInfo[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinPasswordInput, setJoinPasswordInput] = useState('');

  const refreshRooms = async () => {
    setLoadingRooms(true);
    try {
      const res = await api.getPublicRooms();
      setPublicRooms(res.rooms);
    } catch {
      // Ignore transient room fetch error
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    refreshRooms();
  }, []);

  return (
    <TacticalPanel
      title="Live Room Browser"
      action={
        <button
          type="button"
          onClick={() => {
            audioEngine.playUiClick(640);
            refreshRooms();
          }}
          className="p-1.5 bg-[#07090e] border border-slate-700 text-slate-400 hover:text-white cursor-pointer"
          title="Refresh rooms"
          aria-label="Refresh public rooms"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingRooms ? 'animate-spin' : ''}`} />
        </button>
      }
    >
      <div className="space-y-3">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={joinCodeInput}
            onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
            placeholder="Code (SL-4A9F)"
            className="flex-1 min-w-0 bg-[#07090e] border border-slate-700 px-2.5 py-1.5 text-xs font-mono-tabular text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
          />
          <input
            type="password"
            value={joinPasswordInput}
            onChange={(e) => setJoinPasswordInput(e.target.value)}
            placeholder="Pass"
            className="w-18 bg-[#07090e] border border-slate-700 px-2 py-1.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
          />
          <TacticalButton
            variant="secondary"
            size="sm"
            onClick={() => {
              if (!joinCodeInput.trim()) return;
              onJoinRoom(joinCodeInput.trim(), undefined, joinPasswordInput || undefined);
            }}
          >
            {joinCodeLabel}
          </TacticalButton>
        </div>

        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {publicRooms.length === 0 ? (
            <div className="text-xs text-slate-500 py-2 text-center">
              No active public matches right now. Click Find Match to host one.
            </div>
          ) : (
            publicRooms.map((rm) => (
              <div
                key={rm.roomId}
                className="flex items-center justify-between gap-2 px-2.5 py-2 bg-[#07090e] border border-slate-800 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-slate-200 truncate">
                    {rm.mode.toUpperCase()} · {rm.mapId}
                    {rm.isPrivate && (
                      <span className="ml-1.5 text-amber-400 font-mono-tabular">[{rm.roomCode}]</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono-tabular">
                    {rm.region} · {rm.playerCount}/{rm.maxPlayers} players · {rm.state}
                  </div>
                </div>
                <TacticalButton
                  variant="primary"
                  size="sm"
                  onClick={() => onJoinRoom(undefined, rm.roomId, joinPasswordInput || undefined)}
                >
                  Join
                </TacticalButton>
              </div>
            ))
          )}
        </div>
      </div>
    </TacticalPanel>
  );
}
