import { useState } from 'react';
import { Globe, Newspaper, Play, Plus, Shield, Swords, Users } from 'lucide-react';
import type {
  GameModeId,
  MapId,
  MatchMutators,
  NewsItem,
  PartyState,
  RegionId,
  UserProfile,
} from '../../../shared/types/game.ts';
import { PUBLIC_GAME_MODES } from '../../../shared/constants/modes.ts';
import { MULTIPLAYER_MAPS } from '../../../shared/maps/index.ts';
import { TRANSLATIONS } from '../../../shared/constants/i18n.ts';
import { audioEngine } from '../../game/audio/AudioEngine.ts';
import { TacticalPanel } from '../ui/TacticalPanel.tsx';
import { TacticalButton } from '../ui/TacticalButton.tsx';
import { PrivateAndBotsPanel } from './PrivateAndBotsPanel.tsx';
import { RoomBrowserCard } from './RoomBrowserCard.tsx';

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

  const deployMapId: MapId = selectedMap === 'any' ? 'foundry' : selectedMap;
  const activeModeCfg = PUBLIC_GAME_MODES.find((m) => m.id === selectedMode);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
      {/* Left Column: Primary Deploy Controls, Modes & Arenas */}
      <div className="xl:col-span-8 space-y-5">
        <TacticalPanel accent="amber">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-[10px] font-mono-tabular uppercase tracking-widest text-amber-400">
                Active Combat Deployment
              </div>
              <h2 className="font-display text-2xl font-bold uppercase text-white tracking-wide">
                {activeModeCfg?.name} ·{' '}
                {selectedMap === 'any'
                  ? 'Random Rotation'
                  : MULTIPLAYER_MAPS.find((m) => m.id === selectedMap)?.name}
              </h2>
              <p className="text-xs text-slate-400">{activeModeCfg?.objectiveSummary}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <div className="flex items-center gap-1.5 bg-[#07090e] border border-slate-700 sl-chamfer-sm px-2.5 py-2">
                <Globe className="w-4 h-4 text-slate-400 shrink-0" />
                <select
                  aria-label="Server region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value as RegionId)}
                  className="bg-transparent text-xs font-medium text-slate-200 focus:outline-none cursor-pointer"
                >
                  {REGIONS.map((r) => (
                    <option key={r.id} value={r.id} className="bg-[#0c1018]">
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {searching ? (
                <TacticalButton variant="danger" size="lg" onClick={onCancelQueue}>
                  {t.cancelQueue}
                </TacticalButton>
              ) : (
                <TacticalButton
                  variant="primary"
                  size="lg"
                  onClick={() =>
                    onQuickPlay(
                      selectedMode,
                      selectedMap === 'any' ? undefined : selectedMap,
                      region,
                      selectedMode === '2v2'
                    )
                  }
                >
                  <Play className="w-4 h-4 fill-current" />
                  {t.findMatch}
                </TacticalButton>
              )}

              <TacticalButton
                variant="cyan"
                size="md"
                onClick={() => onQuickPlay('2v2', undefined, region, true)}
              >
                <Swords className="w-4 h-4" />
                Ranked 2v2
              </TacticalButton>
            </div>
          </div>
        </TacticalPanel>

        {/* Mode Selection Matrix */}
        <TacticalPanel
          title={`Game Modes (${PUBLIC_GAME_MODES.length})`}
          subtitle="Select competitive ruleset"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {PUBLIC_GAME_MODES.map((m) => {
              const active = selectedMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onMouseEnter={() => {
                    if (!active) audioEngine.playUiHover();
                  }}
                  onClick={() => {
                    audioEngine.playUiClick(650);
                    setSelectedMode(m.id);
                  }}
                  className={`text-left p-3 border sl-chamfer-sm transition cursor-pointer flex flex-col justify-between gap-2 ${
                    active
                      ? 'bg-amber-500/16 border-amber-500 text-white'
                      : 'bg-[#07090e] border-slate-800 hover:border-slate-600 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-bold text-sm uppercase">{m.name}</span>
                    <span
                      className={`text-[10px] font-mono-tabular px-1.5 py-0.5 shrink-0 ${
                        active ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {m.shortName}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">{m.description}</p>
                  <div className="text-[10px] font-mono-tabular text-slate-500">
                    Max {m.maxPlayers} · {Math.round(m.durationSec / 60)}m · Limit {m.scoreLimit}
                  </div>
                </button>
              );
            })}
          </div>
        </TacticalPanel>

        {/* Combat Arenas */}
        <TacticalPanel
          title="Combat Arenas"
          action={
            <TacticalButton
              variant={selectedMap === 'any' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => setSelectedMap('any')}
            >
              Random Rotation
            </TacticalButton>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {MULTIPLAYER_MAPS.map((map) => {
              const active = selectedMap === map.id;
              return (
                <button
                  key={map.id}
                  type="button"
                  onMouseEnter={() => {
                    if (!active) audioEngine.playUiHover();
                  }}
                  onClick={() => {
                    audioEngine.playUiClick(660);
                    setSelectedMap(map.id);
                  }}
                  className={`group text-left overflow-hidden border sl-chamfer-sm transition cursor-pointer ${
                    active
                      ? 'border-amber-500 ring-1 ring-amber-500/45'
                      : 'border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div
                    className="h-24 w-full relative overflow-hidden flex items-end p-2.5"
                    style={{ backgroundColor: map.lighting.skyTop }}
                  >
                    {map.previewImage && (
                      <img
                        src={map.previewImage}
                        alt={map.name}
                        className="absolute inset-0 w-full h-full object-cover opacity-82 group-hover:scale-105 transition duration-300"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div
                      className="absolute inset-0"
                      style={{
                        background:
                          'linear-gradient(to top, rgba(7,9,14,0.88) 0%, rgba(7,9,14,0.2) 100%)',
                      }}
                    />
                    <div className="relative z-10 flex items-center justify-between w-full">
                      <span className="font-display font-bold text-sm uppercase text-white">
                        {map.name}
                      </span>
                      <span className="text-[10px] uppercase font-mono-tabular px-1.5 py-0.5 bg-black/80 text-amber-300 border border-slate-700/80">
                        {map.environment}
                      </span>
                    </div>
                  </div>
                  <div className="p-2.5 bg-[#07090e]">
                    <div className="text-[11px] font-medium text-slate-300">{map.subtitle}</div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{map.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </TacticalPanel>
      </div>

      {/* Right Column: Secondary Modes, Browser, Party, News */}
      <div className="xl:col-span-4 space-y-4">
        <PrivateAndBotsPanel
          selectedMode={selectedMode}
          deployMapId={deployMapId}
          enterRangeLabel={t.enterRange}
          practiceBotsLabel={t.practiceBots}
          privateMatchLabel={t.privateMatch}
          onEnterTraining={onEnterTraining}
          onCreatePrivate={onCreatePrivate}
        />

        <RoomBrowserCard joinCodeLabel={t.joinCode} onJoinRoom={onJoinRoom} />

        {/* Squad / Party Panel */}
        <TacticalPanel
          title="Squad Party"
          action={
            !party ? (
              <TacticalButton variant="cyan" size="sm" onClick={onCreateParty}>
                <Plus className="w-3.5 h-3.5" /> Create Squad
              </TacticalButton>
            ) : (
              <TacticalButton variant="danger" size="sm" onClick={onLeaveParty}>
                Leave Squad
              </TacticalButton>
            )
          }
        >
          {!party ? (
            <p className="text-xs text-slate-400 flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400 shrink-0" />
              Form a 4-player squad and queue together from the Social tab.
            </p>
          ) : (
            <div className="space-y-1.5">
              {party.members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between px-2.5 py-1.5 bg-[#07090e] border border-slate-800 text-xs"
                >
                  <span className="text-slate-200 font-medium flex items-center gap-1.5">
                    {m.id === party.leaderId && <Shield className="w-3.5 h-3.5 text-amber-400" />}
                    {m.username}
                    <span className="text-[10px] font-mono-tabular text-slate-500">Lv.{m.level}</span>
                  </span>
                  {party.leaderId === profile.id && m.id !== profile.id && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onPromoteParty(m.id)}
                        className="text-[10px] px-1.5 py-0.5 bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
                      >
                        Lead
                      </button>
                      <button
                        type="button"
                        onClick={() => onKickParty(m.id)}
                        className="text-[10px] px-1.5 py-0.5 bg-rose-900/50 text-rose-300 hover:text-white cursor-pointer"
                      >
                        Kick
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TacticalPanel>

        {/* Latest News Dispatch */}
        {latestNews && (
          <button
            type="button"
            onClick={() => {
              audioEngine.playUiClick(660);
              onOpenNews();
            }}
            className="w-full text-left bg-[#0c1018]/94 border border-slate-800 hover:border-amber-500/55 sl-chamfer p-4 transition cursor-pointer space-y-1"
          >
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-amber-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <Newspaper className="w-3.5 h-3.5" />
                {latestNews.category} · {latestNews.version}
              </span>
              <span className="text-slate-500 font-mono-tabular">Read Dispatch</span>
            </div>
            <div className="font-display font-bold text-sm text-white uppercase">
              {latestNews.title}
            </div>
            <p className="text-xs text-slate-400 line-clamp-2">{latestNews.summary}</p>
          </button>
        )}
      </div>
    </div>
  );
}
