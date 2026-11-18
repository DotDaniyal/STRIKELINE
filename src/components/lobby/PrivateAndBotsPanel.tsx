import { useState } from 'react';
import { Bot, Crosshair, Lock } from 'lucide-react';
import type {
  BotDifficulty,
  GameModeId,
  MapId,
  MatchMutators,
  WeaponCategory,
} from '../../../shared/types/game.ts';
import { audioEngine } from '../../game/audio/AudioEngine.ts';
import { TacticalPanel } from '../ui/TacticalPanel.tsx';
import { TacticalButton } from '../ui/TacticalButton.tsx';

interface Props {
  selectedMode: GameModeId;
  deployMapId: MapId;
  enterRangeLabel: string;
  practiceBotsLabel: string;
  privateMatchLabel: string;
  onEnterTraining: () => void;
  onCreatePrivate: (
    mode: GameModeId,
    mapId: MapId,
    maxPlayers: number,
    password: string,
    mutators: MatchMutators,
    autoStartBots?: boolean
  ) => void;
}

export function PrivateAndBotsPanel({
  selectedMode,
  deployMapId,
  enterRangeLabel,
  practiceBotsLabel,
  privateMatchLabel,
  onEnterTraining,
  onCreatePrivate,
}: Props) {
  const [panelMode, setPanelMode] = useState<'none' | 'bots' | 'private'>('none');
  const [botCount, setBotCount] = useState(5);
  const [botDiff, setBotDiff] = useState<BotDifficulty>('medium');
  const [privMaxPlayers, setPrivMaxPlayers] = useState(8);
  const [privPassword, setPrivPassword] = useState('');
  const [mutHeadshotOnly, setMutHeadshotOnly] = useState(false);
  const [mutLowGravity, setMutLowGravity] = useState(false);
  const [mutSpeed, setMutSpeed] = useState(1.0);
  const [mutWeaponCat, setMutWeaponCat] = useState<WeaponCategory | 'all'>('all');

  return (
    <TacticalPanel eyebrow="Solo & Custom" title="Operations">
      <div className="space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 gap-2">
          <button
            type="button"
            onClick={() => {
              audioEngine.playUiClick(740);
              onEnterTraining();
            }}
            className="w-full flex items-center justify-between px-3.5 py-2.5 sl-chamfer-sm bg-[#07090e] hover:bg-slate-800/80 border border-slate-700 text-slate-100 text-xs font-semibold cursor-pointer transition whitespace-nowrap"
          >
            <span className="flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-sky-400" />
              {enterRangeLabel}
            </span>
            <span className="text-[10px] font-mono-tabular text-sky-400">AIM DRILLS</span>
          </button>

          <button
            type="button"
            onClick={() => {
              audioEngine.playUiClick(700);
              setPanelMode(panelMode === 'bots' ? 'none' : 'bots');
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 sl-chamfer-sm border text-xs font-semibold cursor-pointer transition whitespace-nowrap ${
              panelMode === 'bots'
                ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                : 'bg-[#07090e] hover:bg-slate-800/80 border-slate-700 text-slate-100'
            }`}
          >
            <span className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-amber-400" />
              {practiceBotsLabel}
            </span>
            <span className="text-[10px] font-mono-tabular text-slate-400">SOLO / CO-OP</span>
          </button>

          <button
            type="button"
            onClick={() => {
              audioEngine.playUiClick(700);
              setPanelMode(panelMode === 'private' ? 'none' : 'private');
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 sl-chamfer-sm border text-xs font-semibold cursor-pointer transition whitespace-nowrap ${
              panelMode === 'private'
                ? 'bg-sky-500/15 border-sky-500 text-sky-300'
                : 'bg-[#07090e] hover:bg-slate-800/80 border-slate-700 text-slate-100'
            }`}
          >
            <span className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-sky-400" />
              {privateMatchLabel}
            </span>
            <span className="text-[10px] font-mono-tabular text-slate-400">CUSTOM ROOM</span>
          </button>
        </div>

        {panelMode === 'bots' && (
          <div className="mt-3 p-3.5 bg-[#07090e] border border-amber-500/45 sl-chamfer-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-display text-xs font-bold uppercase text-amber-300">
                Bot Skirmish Setup
              </span>
              <span className="text-[11px] font-mono-tabular text-slate-400">{deployMapId}</span>
            </div>
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Bot Count ({botCount})
                </label>
                <input
                  type="range"
                  min={1}
                  max={9}
                  value={botCount}
                  onChange={(e) => setBotCount(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Difficulty</label>
                <select
                  value={botDiff}
                  onChange={(e) => setBotDiff(e.target.value as BotDifficulty)}
                  className="w-full bg-[#0c1018] border border-slate-700 px-2 py-1.5 text-xs text-white"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
            </div>
            <TacticalButton
              variant="primary"
              size="md"
              className="w-full"
              onClick={() =>
                onCreatePrivate(
                  selectedMode,
                  deployMapId,
                  Math.max(botCount + 1, 8),
                  '',
                  { botsCount: botCount, botDifficulty: botDiff },
                  true
                )
              }
            >
              Launch Bot Match Now
            </TacticalButton>
          </div>
        )}

        {panelMode === 'private' && (
          <div className="mt-3 p-3.5 bg-[#07090e] border border-sky-500/45 sl-chamfer-sm space-y-3 text-xs">
            <div className="font-display text-xs font-bold uppercase text-sky-300">
              Private Lobby Configuration
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Max Players</label>
                <input
                  type="number"
                  min={2}
                  max={12}
                  value={privMaxPlayers}
                  onChange={(e) => setPrivMaxPlayers(Number(e.target.value))}
                  className="w-full bg-[#0c1018] border border-slate-700 px-2 py-1.5 text-white tabular-nums"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Password</label>
                <input
                  type="text"
                  value={privPassword}
                  onChange={(e) => setPrivPassword(e.target.value)}
                  placeholder="Optional"
                  className="w-full bg-[#0c1018] border border-slate-700 px-2 py-1.5 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Weapon Class</label>
                <select
                  value={mutWeaponCat}
                  onChange={(e) => setMutWeaponCat(e.target.value as WeaponCategory | 'all')}
                  className="w-full bg-[#0c1018] border border-slate-700 px-2 py-1.5 text-white"
                >
                  <option value="all">All Weapons</option>
                  <option value="assault">Assault Rifles</option>
                  <option value="smg">SMGs Only</option>
                  <option value="sniper">Snipers Only</option>
                  <option value="shotgun">Shotguns Only</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Speed ({mutSpeed.toFixed(1)}x)
                </label>
                <input
                  type="range"
                  min={0.8}
                  max={1.5}
                  step={0.1}
                  value={mutSpeed}
                  onChange={(e) => setMutSpeed(Number(e.target.value))}
                  className="w-full accent-sky-500 mt-1"
                />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={mutHeadshotOnly}
                  onChange={(e) => setMutHeadshotOnly(e.target.checked)}
                  className="accent-sky-500"
                />
                Headshots Only
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={mutLowGravity}
                  onChange={(e) => setMutLowGravity(e.target.checked)}
                  className="accent-sky-500"
                />
                Low Gravity
              </label>
            </div>

            <TacticalButton
              variant="cyan"
              size="md"
              className="w-full"
              onClick={() =>
                onCreatePrivate(
                  selectedMode,
                  deployMapId,
                  privMaxPlayers,
                  privPassword,
                  {
                    headshotOnly: mutHeadshotOnly,
                    lowGravity: mutLowGravity,
                    speedMultiplier: mutSpeed,
                    allowedWeaponCategory: mutWeaponCat,
                  },
                  false
                )
              }
            >
              Create Private Room
            </TacticalButton>
          </div>
        )}
      </div>
    </TacticalPanel>
  );
}
