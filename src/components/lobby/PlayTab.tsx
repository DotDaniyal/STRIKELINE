import { useEffect, useState } from 'react';
import {
  Bot,
  Crosshair,
  Globe,
  Lock,
  Newspaper,
  Play,
  Plus,
  RefreshCw,
  Shield,
  Swords,
  Users,
} from 'lucide-react';
import type {
  BotDifficulty,
  GameModeId,
  MapId,
  MatchMutators,
  MatchSummaryInfo,
  NewsItem,
  PartyState,
  RegionId,
  UserProfile,
  WeaponCategory,
} from '../../../shared/types/game.ts';
import { PUBLIC_GAME_MODES } from '../../../shared/constants/modes.ts';
import { MULTIPLAYER_MAPS } from '../../../shared/constants/maps.ts';
import { TRANSLATIONS } from '../../../shared/constants/i18n.ts';
import { api } from '../../services/api.ts';
import { audioEngine } from '../../game/audio/AudioEngine.ts';

interface Props {
  profile: UserProfile;
  party: PartyState | null;
  searching: boolean;
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
  onEnterTraining: () => void;
  onCreateParty: () => void;
  onLeaveParty: () => void;
  onKickParty: (userId: string) => void;
  onPromoteParty: (userId: string) => void;
  onOpenNews: () => void;
  latestNews: NewsItem | null;
}

const REGIONS: Array<{ id: RegionId; label: string }> = [
  { id: 'na-east', label: 'NA East' },
  { id: 'na-west', label: 'NA West' },
  { id: 'eu-central', label: 'EU Central' },
  { id: 'ap-east', label: 'AP East' },
];

export function PlayTab({
  profile,
  party,
  searching,
  onQuickPlay,
  onCancelQueue,
  onCreatePrivate,
  onJoinRoom,
  onEnterTraining,
  onCreateParty,
  onLeaveParty,
  onKickParty,
  onPromoteParty,
  onOpenNews,
  latestNews,
}: Props) {
  const t = TRANSLATIONS[profile.settings.language] || TRANSLATIONS.en;
  const [selectedMode, setSelectedMode] = useState<GameModeId>('tdm');
  const [selectedMap, setSelectedMap] = useState<MapId | 'any'>('any');
  const [region, setRegion] = useState<RegionId>('na-east');

  const [publicRooms, setPublicRooms] = useState<MatchSummaryInfo[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);

  // Join by code
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [joinPasswordInput, setJoinPasswordInput] = useState('');

  // Modals: bots vs private match
  const [panelMode, setPanelMode] = useState<'none' | 'bots' | 'private'>('none');
  const [botCount, setBotCount] = useState(5);
  const [botDiff, setBotDiff] = useState<BotDifficulty>('medium');
  const [privMaxPlayers, setPrivMaxPlayers] = useState(8);
  const [privPassword, setPrivPassword] = useState('');
  const [mutHeadshotOnly, setMutHeadshotOnly] = useState(false);
  const [mutLowGravity, setMutLowGravity] = useState(false);
  const [mutSpeed, setMutSpeed] = useState(1.0);
  const [mutWeaponCat, setMutWeaponCat] = useState<WeaponCategory | 'all'>('all');

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

  const deployMapId: MapId = selectedMap === 'any' ? 'foundry' : selectedMap;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      {/* Left Column: Primary Deploy Controls, Modes & Maps */}
      <div className="xl:col-span-8 space-y-5">
        {/* Deployment Action Deck */}
        <div className="bg-[#0e131c]/95 border border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-amber-400">
              Active Combat Deployment
            </div>
            <h2 className="font-display text-2xl font-bold text-white tracking-wide">
              {PUBLIC_GAME_MODES.find((m) => m.id === selectedMode)?.name} ·{' '}
              {selectedMap === 'any'
                ? 'Random Rotation'
                : MULTIPLAYER_MAPS.find((m) => m.id === selectedMap)?.name}
            </h2>
            <p className="text-xs text-slate-400">
              {PUBLIC_GAME_MODES.find((m) => m.id === selectedMode)?.objectiveSummary}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-1.5 bg-[#090d14] border border-slate-700 rounded-lg px-2.5 py-2">
              <Globe className="w-4 h-4 text-slate-400 shrink-0" />
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value as RegionId)}
                className="bg-transparent text-xs font-medium text-slate-200 focus:outline-none cursor-pointer"
              >
                {REGIONS.map((r) => (
                  <option key={r.id} value={r.id} className="bg-[#0e131c]">
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            {searching ? (
              <button
                type="button"
                onClick={() => {
                  audioEngine.playUiClick(520);
                  onCancelQueue();
                }}
                className="px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-display font-bold uppercase tracking-wider text-sm transition cursor-pointer whitespace-nowrap shrink-0"
              >
                {t.cancelQueue}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  audioEngine.playUiClick(780);
                  onQuickPlay(
                    selectedMode,
                    selectedMap === 'any' ? undefined : selectedMap,
                    region,
                    selectedMode === '2v2'
                  );
                }}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold uppercase tracking-wider text-sm transition cursor-pointer whitespace-nowrap shrink-0 shadow-lg shadow-amber-500/20"
              >
                <Play className="w-4 h-4 fill-current" />
                {t.findMatch}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                audioEngine.playUiClick(740);
                onQuickPlay('2v2', undefined, region, true);
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/35 border border-sky-500/50 text-sky-300 font-display font-bold uppercase tracking-wider text-xs transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <Swords className="w-4 h-4" />
              Ranked 2v2
            </button>
          </div>
        </div>

        {/* Mode Selection Grid */}
        <div className="bg-[#0e131c]/95 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-slate-200">
              Game Modes ({PUBLIC_GAME_MODES.length})
            </h3>
            <span className="text-xs text-slate-400">Select combat ruleset</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {PUBLIC_GAME_MODES.map((m) => {
              const active = selectedMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    audioEngine.playUiClick(640);
                    setSelectedMode(m.id);
                  }}
                  className={`text-left p-3 rounded-lg border transition cursor-pointer flex flex-col justify-between gap-2 ${
                    active
                      ? 'bg-amber-500/15 border-amber-500 text-white'
                      : 'bg-[#090d14] border-slate-800 hover:border-slate-600 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-bold text-sm">{m.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 shrink-0">
                      {m.shortName}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{m.description}</p>
                  <div className="text-[10px] font-mono text-slate-500 tabular-nums">
                    Max {m.maxPlayers} · {Math.round(m.durationSec / 60)}m · Limit {m.scoreLimit}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Map Selection Grid */}
        <div className="bg-[#0e131c]/95 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-slate-200">
              Combat Arenas
            </h3>
            <button
              type="button"
              onClick={() => {
                audioEngine.playUiClick(620);
                setSelectedMap('any');
              }}
              className={`text-xs px-3 py-1 rounded border cursor-pointer transition whitespace-nowrap shrink-0 ${
                selectedMap === 'any'
                  ? 'bg-amber-500 text-slate-950 border-amber-500 font-semibold'
                  : 'bg-[#090d14] border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              Random Rotation
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MULTIPLAYER_MAPS.map((map) => {
              const active = selectedMap === map.id;
              return (
                <button
                  key={map.id}
                  type="button"
                  onClick={() => {
                    audioEngine.playUiClick(650);
                    setSelectedMap(map.id);
                  }}
                  className={`group text-left rounded-lg overflow-hidden border transition cursor-pointer ${
                    active ? 'border-amber-500 ring-1 ring-amber-500/40' : 'border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div
                    className="h-24 w-full relative overflow-hidden flex items-end p-2.5"
                    style={{
                      background: `linear-gradient(135deg, ${map.lighting.skyTop}, ${map.lighting.skyHorizon})`,
                    }}
                  >
                    {map.previewImage && (
                      <img
                        src={map.previewImage}
                        alt={map.name}
                        className="absolute inset-0 w-full h-full object-cover opacity-80 group-hover:scale-105 transition duration-300"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[#090d14] via-[#090d14]/40 to-transparent" />
                    <div className="relative z-10 flex items-center justify-between w-full">
                      <span className="font-display font-bold text-sm text-white">{map.name}</span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-black/70 text-amber-300">
                        {map.environment}
                      </span>
                    </div>
                  </div>
                  <div className="p-2.5 bg-[#090d14]">
                    <div className="text-[11px] font-medium text-slate-300">{map.subtitle}</div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{map.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Column: Secondary Modes, Party, Join Code, Server Browser, News */}
      <div className="xl:col-span-4 space-y-4">
        {/* Tactical Shortcuts: Training Range, Practice Bots, Private Match */}
        <div className="bg-[#0e131c]/95 border border-slate-800 rounded-xl p-4 space-y-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
            Custom & Practice Operations
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-1 gap-2">
            <button
              type="button"
              onClick={() => {
                audioEngine.playUiClick(740);
                onEnterTraining();
              }}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-[#090d14] hover:bg-slate-800/80 border border-slate-700 text-slate-100 text-xs font-semibold cursor-pointer transition whitespace-nowrap"
            >
              <span className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-cyan-400" />
                {t.enterRange}
              </span>
              <span className="text-[10px] font-mono text-cyan-400">AIM DRILLS</span>
            </button>

            <button
              type="button"
              onClick={() => {
                audioEngine.playUiClick(700);
                setPanelMode(panelMode === 'bots' ? 'none' : 'bots');
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition whitespace-nowrap ${
                panelMode === 'bots'
                  ? 'bg-amber-500/15 border-amber-500 text-amber-300'
                  : 'bg-[#090d14] hover:bg-slate-800/80 border-slate-700 text-slate-100'
              }`}
            >
              <span className="flex items-center gap-2">
                <Bot className="w-4 h-4 text-amber-400" />
                {t.practiceBots}
              </span>
              <span className="text-[10px] font-mono text-slate-400">SOLO / CO-OP</span>
            </button>

            <button
              type="button"
              onClick={() => {
                audioEngine.playUiClick(700);
                setPanelMode(panelMode === 'private' ? 'none' : 'private');
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg border text-xs font-semibold cursor-pointer transition whitespace-nowrap ${
                panelMode === 'private'
                  ? 'bg-sky-500/15 border-sky-500 text-sky-300'
                  : 'bg-[#090d14] hover:bg-slate-800/80 border-slate-700 text-slate-100'
              }`}
            >
              <span className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-sky-400" />
                {t.privateMatch}
              </span>
              <span className="text-[10px] font-mono text-slate-400">CUSTOM ROOM</span>
            </button>
          </div>

          {panelMode === 'bots' && (
            <div className="mt-3 p-3.5 rounded-lg bg-[#090d14] border border-amber-500/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-display text-xs font-bold uppercase text-amber-300">Bot Skirmish Setup</span>
                <span className="text-[11px] font-mono text-slate-400">{deployMapId}</span>
              </div>
              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Bot Count ({botCount})</label>
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
                    className="w-full bg-[#111620] border border-slate-700 rounded px-2 py-1.5 text-xs text-white"
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  audioEngine.playUiClick(800);
                  onCreatePrivate(
                    selectedMode,
                    deployMapId,
                    Math.max(botCount + 1, 8),
                    '',
                    { botsCount: botCount, botDifficulty: botDiff },
                    true
                  );
                }}
                className="w-full py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-xs uppercase tracking-wider cursor-pointer"
              >
                Launch Bot Match Now
              </button>
            </div>
          )}

          {panelMode === 'private' && (
            <div className="mt-3 p-3.5 rounded-lg bg-[#090d14] border border-sky-500/40 space-y-3 text-xs">
              <div className="font-display text-xs font-bold uppercase text-sky-300">Private Lobby Configuration</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Max Players</label>
                  <input
                    type="number"
                    min={2}
                    max={12}
                    value={privMaxPlayers}
                    onChange={(e) => setPrivMaxPlayers(Number(e.target.value))}
                    className="w-full bg-[#111620] border border-slate-700 rounded px-2 py-1.5 text-white tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Password (Optional)</label>
                  <input
                    type="text"
                    value={privPassword}
                    onChange={(e) => setPrivPassword(e.target.value)}
                    placeholder="None"
                    className="w-full bg-[#111620] border border-slate-700 rounded px-2 py-1.5 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Weapon Class</label>
                  <select
                    value={mutWeaponCat}
                    onChange={(e) => setMutWeaponCat(e.target.value as WeaponCategory | 'all')}
                    className="w-full bg-[#111620] border border-slate-700 rounded px-2 py-1.5 text-white"
                  >
                    <option value="all">All Weapons</option>
                    <option value="assault">Assault Rifles</option>
                    <option value="smg">SMGs Only</option>
                    <option value="sniper">Snipers Only</option>
                    <option value="shotgun">Shotguns Only</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Speed ({mutSpeed.toFixed(1)}x)</label>
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

              <button
                type="button"
                onClick={() => {
                  audioEngine.playUiClick(780);
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
                  );
                }}
                className="w-full py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-bold text-xs uppercase tracking-wider cursor-pointer"
              >
                Create Private Room
              </button>
            </div>
          )}
        </div>

        {/* Join by Room Code & Active Rooms Browser */}
        <div className="bg-[#0e131c]/95 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-display text-xs font-bold uppercase tracking-wider text-slate-200">
              Join Room / Live Browser
            </span>
            <button
              type="button"
              onClick={refreshRooms}
              className="p-1.5 rounded bg-[#090d14] border border-slate-700 text-slate-400 hover:text-white cursor-pointer"
              title="Refresh rooms"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingRooms ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
              placeholder="Code (e.g. SL-4A9F)"
              className="flex-1 min-w-0 bg-[#090d14] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white placeholder:text-slate-600"
            />
            <input
              type="password"
              value={joinPasswordInput}
              onChange={(e) => setJoinPasswordInput(e.target.value)}
              placeholder="Pass"
              className="w-20 bg-[#090d14] border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white placeholder:text-slate-600"
            />
            <button
              type="button"
              onClick={() => {
                if (!joinCodeInput.trim()) return;
                audioEngine.playUiClick(720);
                onJoinRoom(joinCodeInput.trim(), undefined, joinPasswordInput || undefined);
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              {t.joinCode}
            </button>
          </div>

          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {publicRooms.length === 0 ? (
              <div className="text-xs text-slate-500 py-2 text-center">
                No active public matches right now — click Find Match to host one.
              </div>
            ) : (
              publicRooms.map((rm) => (
                <div
                  key={rm.roomId}
                  className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-[#090d14] border border-slate-800 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-200 truncate">
                      {rm.mode.toUpperCase()} · {rm.mapId}
                      {rm.isPrivate && <span className="ml-1.5 text-amber-400 font-mono">[{rm.roomCode}]</span>}
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                      {rm.region} · {rm.playerCount}/{rm.maxPlayers} players · {rm.state}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onJoinRoom(undefined, rm.roomId, joinPasswordInput || undefined)}
                    className="px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 font-semibold text-[11px] cursor-pointer whitespace-nowrap shrink-0"
                  >
                    Join
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Squad / Party Panel */}
        <div className="bg-[#0e131c]/95 border border-slate-800 rounded-xl p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-display text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-sky-400" />
              Squad Party
            </span>
            {!party ? (
              <button
                type="button"
                onClick={onCreateParty}
                className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-sky-600/25 hover:bg-sky-600/40 text-sky-300 font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" /> Create Squad
              </button>
            ) : (
              <button
                type="button"
                onClick={onLeaveParty}
                className="text-xs px-2.5 py-1 rounded bg-rose-600/20 hover:bg-rose-600/35 text-rose-300 font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                Leave Squad
              </button>
            )}
          </div>

          {!party ? (
            <p className="text-xs text-slate-500">
              Form a 4-player squad and queue together from the Social tab.
            </p>
          ) : (
            <div className="space-y-1.5">
              {party.members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between px-2.5 py-1.5 rounded bg-[#090d14] border border-slate-800 text-xs"
                >
                  <span className="text-slate-200 font-medium flex items-center gap-1.5">
                    {m.id === party.leaderId && <Shield className="w-3.5 h-3.5 text-amber-400" />}
                    {m.username}
                    <span className="text-[10px] font-mono text-slate-500">Lv.{m.level}</span>
                  </span>
                  {party.leaderId === profile.id && m.id !== profile.id && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onPromoteParty(m.id)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                      >
                        Lead
                      </button>
                      <button
                        type="button"
                        onClick={() => onKickParty(m.id)}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-rose-900/50 text-rose-300 hover:text-white cursor-pointer"
                      >
                        Kick
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Latest News Dispatch */}
        {latestNews && (
          <button
            type="button"
            onClick={onOpenNews}
            className="w-full text-left bg-[#0e131c]/95 border border-slate-800 hover:border-amber-500/50 rounded-xl p-4 transition cursor-pointer space-y-1"
          >
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-amber-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Newspaper className="w-3.5 h-3.5" />
                {latestNews.category} · {latestNews.version}
              </span>
              <span className="text-slate-500">Read Dispatch</span>
            </div>
            <div className="font-display font-bold text-sm text-white">{latestNews.title}</div>
            <p className="text-xs text-slate-400 line-clamp-2">{latestNews.summary}</p>
          </button>
        )}
      </div>
    </div>
  );
}
