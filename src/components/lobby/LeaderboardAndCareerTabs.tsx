import { useEffect, useState, type FormEvent } from 'react';
import { Award, CheckCircle2, Medal, ShieldCheck, Target } from 'lucide-react';
import type {
  ChallengeEntry,
  LeaderboardEntry,
  MatchRecord,
  UserProfile,
} from '../../../shared/types/game.ts';
import { ACHIEVEMENT_DEFINITIONS } from '../../../shared/constants/catalog.ts';
import { api } from '../../services/api.ts';
import { TacticalPanel } from '../ui/TacticalPanel.tsx';
import { TacticalButton } from '../ui/TacticalButton.tsx';
import { SegmentedControl } from '../ui/SegmentedControl.tsx';
import { StatBar } from '../ui/StatBar.tsx';

const SCOPE_OPTIONS = [
  { id: 'global', label: 'Global' },
  { id: 'ranked', label: 'Ranked' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
  { id: 'friends', label: 'Friends' },
] as const;

export function LeaderboardTab({ currentUserId }: { currentUserId: string }) {
  const [scope, setScope] = useState<'global' | 'friends' | 'weekly' | 'monthly' | 'ranked'>('global');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    api.getLeaderboard(scope)
      .then((res) => setEntries(res.entries))
      .catch(() => setEntries([]));
  }, [scope]);

  return (
    <TacticalPanel
      accent="amber"
      eyebrow="Competitive Standings"
      title="Verified Operator Leaderboard"
      subtitle="Live rankings recorded from completed multiplayer matches."
      action={
        <SegmentedControl
          layoutId="lb-scope-tabs"
          options={SCOPE_OPTIONS}
          value={scope}
          onChange={setScope}
          size="sm"
        />
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono-tabular text-[11px]">
              <th className="py-2.5 px-3">Rank</th>
              <th className="py-2.5 px-3">Operator</th>
              <th className="py-2.5 px-3">Level</th>
              <th className="py-2.5 px-3 text-right">Kills</th>
              <th className="py-2.5 px-3 text-right">Deaths</th>
              <th className="py-2.5 px-3 text-right">K/D</th>
              <th className="py-2.5 px-3 text-right">Wins</th>
              <th className="py-2.5 px-3 text-right">Headshots</th>
              <th className="py-2.5 px-3 text-right">Ranked ELO</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70 tabular-nums">
            {entries.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-500">
                  <Medal className="w-5 h-5 mx-auto mb-2 text-slate-600" />
                  No ranked operators in this scope yet. Complete a match to claim #1.
                </td>
              </tr>
            ) : (
              entries.map((e) => {
                const isSelf = e.userId === currentUserId;
                const kd = (e.kills / Math.max(1, e.deaths)).toFixed(2);
                return (
                  <tr key={e.userId} className={isSelf ? 'bg-amber-500/12 text-amber-200' : 'text-slate-200'}>
                    <td className="py-2.5 px-3 font-mono-tabular font-bold">#{e.rank}</td>
                    <td className="py-2.5 px-3 font-semibold">
                      {e.clanTag && <span className="font-mono-tabular text-amber-400 mr-1.5">[{e.clanTag}]</span>}
                      {e.username}
                    </td>
                    <td className="py-2.5 px-3 font-mono-tabular">Lv.{e.level}</td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular">{e.kills}</td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular">{e.deaths}</td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular">{kd}</td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular">{e.wins}</td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular">{e.headshots}</td>
                    <td className="py-2.5 px-3 text-right font-mono-tabular font-bold text-sky-400">
                      {e.rankedElo}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </TacticalPanel>
  );
}

export function CareerTab({
  profile,
  onProfileUpdated,
}: {
  profile: UserProfile;
  onProfileUpdated: (next: UserProfile) => void;
}) {
  const [challenges, setChallenges] = useState<ChallengeEntry[]>([]);
  const [matches, setMatches] = useState<MatchRecord[]>([]);
  const [upUser, setUpUser] = useState('');
  const [upEmail, setUpEmail] = useState('');
  const [upPass, setUpPass] = useState('');
  const [upMsg, setUpMsg] = useState<string | null>(null);

  useEffect(() => {
    api.getChallenges().then((r) => setChallenges(r.challenges)).catch(() => {});
    api.getMatchHistory().then((r) => setMatches(r.matches)).catch(() => {});
  }, []);

  const kd = (profile.kills / Math.max(1, profile.deaths)).toFixed(2);
  const totalMatches = profile.wins + profile.losses;
  const winRate = totalMatches > 0 ? Math.round((profile.wins / totalMatches) * 100) : 0;
  const accuracy = profile.shotsFired > 0 ? ((profile.shotsHit / profile.shotsFired) * 100).toFixed(1) : '0.0';
  const hsPct = profile.kills > 0 ? Math.round((profile.headshots / profile.kills) * 100) : 0;

  const handleUpgrade = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.upgradeGuest(upUser, upEmail, upPass);
      onProfileUpdated(res.profile);
      setUpMsg('Account secured and upgraded. All stats and cosmetics preserved.');
    } catch (err: unknown) {
      setUpMsg(err instanceof Error ? err.message : 'Upgrade failed.');
    }
  };

  return (
    <div className="space-y-5">
      {profile.isGuest && (
        <TacticalPanel accent="amber" title="Guest Session: Upgrade to Permanent Account">
          <form onSubmit={handleUpgrade} className="space-y-3">
            <p className="text-xs text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
              Preserve your level, credits, skins, and combat telemetry across devices.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
              <input
                type="text"
                required
                minLength={3}
                value={upUser}
                onChange={(e) => setUpUser(e.target.value)}
                placeholder="New Username"
                className="bg-[#07090e] border border-slate-700 px-2.5 py-1.5 text-xs text-white"
              />
              <input
                type="email"
                required
                value={upEmail}
                onChange={(e) => setUpEmail(e.target.value)}
                placeholder="Email Address"
                className="bg-[#07090e] border border-slate-700 px-2.5 py-1.5 text-xs text-white"
              />
              <input
                type="password"
                required
                minLength={6}
                value={upPass}
                onChange={(e) => setUpPass(e.target.value)}
                placeholder="Password (min 6)"
                className="bg-[#07090e] border border-slate-700 px-2.5 py-1.5 text-xs text-white"
              />
              <TacticalButton type="submit" variant="primary" size="sm">
                Lock Account
              </TacticalButton>
            </div>
            {upMsg && <div className="text-xs text-amber-200">{upMsg}</div>}
          </form>
        </TacticalPanel>
      )}

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          ['Level', `Lv.${profile.level} (${profile.xp}/${profile.xpToNext} XP)`],
          ['K/D Ratio', `${kd} (${profile.kills}K / ${profile.deaths}D)`],
          ['Win Rate', `${winRate}% (${profile.wins}W-${profile.losses}L)`],
          ['Accuracy', `${accuracy}%`],
          ['Headshot %', `${hsPct}% (${profile.headshots})`],
          ['Ranked ELO', `${profile.rankedElo}`],
        ].map(([label, val]) => (
          <div key={label} className="bg-[#0c1018]/94 border border-slate-800 sl-chamfer-sm p-3.5">
            <div className="text-[10px] text-slate-400 uppercase font-mono-tabular">{label}</div>
            <div className="font-display font-bold text-base text-white mt-1 tabular-nums">{val}</div>
          </div>
        ))}
      </div>

      {/* Challenges & Ribbons */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7">
          <TacticalPanel
            title="Daily & Weekly Contracts"
            action={<Target className="w-4 h-4 text-amber-400" />}
          >
            <div className="space-y-2.5">
              {challenges.map((c) => (
                <div
                  key={c.id}
                  className="p-3 bg-[#07090e] border border-slate-800 sl-chamfer-sm flex items-center justify-between gap-3"
                >
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[10px] font-mono-tabular uppercase px-1.5 py-0.5 bg-slate-800 text-amber-300">
                        {c.period}
                      </span>
                      <span className="font-semibold text-white">{c.title}</span>
                    </div>
                    <div className="text-[11px] text-slate-400">{c.description}</div>
                    <StatBar
                      label={`${c.progress}/${c.target}`}
                      value={c.progress}
                      max={c.target}
                      displayValue={`${Math.min(100, Math.round((c.progress / Math.max(1, c.target)) * 100))}%`}
                      tone={c.completed ? 'emerald' : 'amber'}
                    />
                  </div>
                  <div className="text-right shrink-0">
                    {c.claimed ? (
                      <span className="inline-block text-[10px] font-mono-tabular text-emerald-400">
                        CLAIMED
                      </span>
                    ) : c.completed ? (
                      <TacticalButton
                        variant="primary"
                        size="sm"
                        onClick={async () => {
                          const res = await api.claimChallenge(c.id);
                          onProfileUpdated(res.profile);
                          setChallenges(res.challenges);
                        }}
                      >
                        Claim +{c.rewardCredits}
                      </TacticalButton>
                    ) : (
                      <span className="text-[10px] font-mono-tabular text-amber-400">
                        +{c.rewardCredits} CR
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TacticalPanel>
        </div>

        <div className="lg:col-span-5">
          <TacticalPanel
            title="Service Ribbons"
            action={<Award className="w-4 h-4 text-sky-400" />}
          >
            <div className="space-y-2">
              {ACHIEVEMENT_DEFINITIONS.map((ach) => {
                const cur = profile[ach.field];
                const unlocked = cur >= ach.threshold;
                return (
                  <div
                    key={ach.id}
                    className={`p-2.5 border sl-chamfer-sm flex items-center justify-between gap-2 text-xs ${
                      unlocked
                        ? 'bg-sky-500/12 border-sky-500/45 text-white'
                        : 'bg-[#07090e] border-slate-800 text-slate-400'
                    }`}
                  >
                    <div>
                      <div className="font-semibold flex items-center gap-1.5">
                        {unlocked && <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />}
                        {ach.name}
                      </div>
                      <div className="text-[11px] text-slate-500">{ach.description}</div>
                    </div>
                    <span className="font-mono-tabular text-[11px] shrink-0">
                      {Math.min(cur, ach.threshold)}/{ach.threshold}
                    </span>
                  </div>
                );
              })}
            </div>
          </TacticalPanel>
        </div>
      </div>

      {/* Match History */}
      <TacticalPanel title="Recent Combat Telemetry">
        {matches.length === 0 ? (
          <div className="text-xs text-slate-500 py-3">No recorded multiplayer matches yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs tabular-nums">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono-tabular text-[11px] uppercase">
                  <th className="py-2 px-2">Mode</th>
                  <th className="py-2 px-2">Arena</th>
                  <th className="py-2 px-2">Team</th>
                  <th className="py-2 px-2 text-right">Kills</th>
                  <th className="py-2 px-2 text-right">Deaths</th>
                  <th className="py-2 px-2 text-right">Score</th>
                  <th className="py-2 px-2 text-right">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {matches.map((m) => (
                  <tr key={m.id} className="text-slate-200">
                    <td className="py-2 px-2 font-mono-tabular uppercase">{m.mode}</td>
                    <td className="py-2 px-2 capitalize">{m.mapId.replace('_', ' ')}</td>
                    <td className="py-2 px-2 capitalize">{m.playerTeam}</td>
                    <td className="py-2 px-2 text-right font-mono-tabular">{m.playerKills}</td>
                    <td className="py-2 px-2 text-right font-mono-tabular">{m.playerDeaths}</td>
                    <td className="py-2 px-2 text-right font-mono-tabular">{m.playerScore}</td>
                    <td className="py-2 px-2 text-right font-mono-tabular">{m.durationSec}s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </TacticalPanel>
    </div>
  );
}
