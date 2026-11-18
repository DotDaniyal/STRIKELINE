import { useEffect, useState, type FormEvent } from 'react';
import { Flag, Shield, Trophy, UserPlus, Users } from 'lucide-react';
import type { FriendEntry, UserProfile } from '../../../shared/types/game.ts';
import { PUBLIC_GAME_MODES } from '../../../shared/constants/modes.ts';
import { MULTIPLAYER_MAPS } from '../../../shared/maps/index.ts';
import { api } from '../../services/api.ts';
import { audioEngine } from '../../game/audio/AudioEngine.ts';
import { TacticalPanel } from '../ui/TacticalPanel.tsx';
import { TacticalButton } from '../ui/TacticalButton.tsx';

interface Props {
  profile: UserProfile;
  onProfileUpdated: (next: UserProfile) => void;
  onInviteToParty: (userId: string) => void;
  onJoinRoomCode: (roomCode: string) => void;
}

export function SocialTab({ profile, onProfileUpdated, onInviteToParty, onJoinRoomCode }: Props) {
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [clans, setClans] = useState<Array<{ id: string; tag: string; name: string; member_count: number }>>([]);
  const [tournaments, setTournaments] = useState<
    Array<{ id: string; name: string; mode: string; map_id: string; max_teams: number; status: string; participants: string[] }>
  >([]);

  const [friendName, setFriendName] = useState('');
  const [clanTag, setClanTag] = useState('');
  const [clanName, setClanName] = useState('');
  const [tourneyName, setTourneyName] = useState('');
  const [tourneyMode, setTourneyMode] = useState('2v2');
  const [tourneyMap, setTourneyMap] = useState('apex_arena');
  const [reportTarget, setReportTarget] = useState('');
  const [reportReason, setReportReason] = useState('Cheating / Exploit');
  const [reportDetails, setReportDetails] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const loadAll = async () => {
    try {
      const [f, c, t] = await Promise.all([api.getFriends(), api.getClans(), api.getTournaments()]);
      setFriends(f.friends);
      setClans(c.clans);
      setTournaments(t.tournaments);
    } catch {
      // Ignore partial load
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const handleAddFriend = async (e: FormEvent) => {
    e.preventDefault();
    if (!friendName.trim()) return;
    try {
      await api.sendFriendRequest(friendName.trim());
      setFriendName('');
      flash('Friend request sent.');
      loadAll();
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : 'Request failed.');
    }
  };

  const handleCreateClan = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const res = await api.createClan(clanTag, clanName);
      onProfileUpdated(res.profile);
      setClans(res.clans);
      setClanTag('');
      setClanName('');
      flash('Clan founded.');
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : 'Clan creation failed.');
    }
  };

  const handleCreateTourney = async (e: FormEvent) => {
    e.preventDefault();
    if (!tourneyName.trim()) return;
    try {
      await api.createTournament(tourneyName.trim(), tourneyMode, tourneyMap, 8);
      setTourneyName('');
      flash('Community tournament opened.');
      loadAll();
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : 'Failed to create tournament.');
    }
  };

  const handleSubmitReport = async (e: FormEvent) => {
    e.preventDefault();
    if (!reportTarget.trim()) return;
    try {
      await api.submitReport(reportTarget.trim(), reportReason, reportDetails);
      setReportTarget('');
      setReportDetails('');
      flash('Moderation report submitted.');
    } catch (err: unknown) {
      flash(err instanceof Error ? err.message : 'Report failed.');
    }
  };

  return (
    <div className="space-y-5">
      {notice && (
        <div className="px-4 py-2.5 sl-chamfer-sm bg-sky-500/15 border border-sky-500/45 text-sky-200 text-xs font-medium">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Friends Roster */}
        <div className="lg:col-span-6">
          <TacticalPanel
            title="Friends Roster"
            action={<Users className="w-4 h-4 text-sky-400" />}
          >
            <div className="space-y-4">
              <form onSubmit={handleAddFriend} className="flex gap-2">
                <input
                  type="text"
                  value={friendName}
                  onChange={(e) => setFriendName(e.target.value)}
                  placeholder="Enter operator username..."
                  className="flex-1 bg-[#07090e] border border-slate-700 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
                <TacticalButton type="submit" variant="cyan" size="sm">
                  <UserPlus className="w-3.5 h-3.5" /> Add
                </TacticalButton>
              </form>

              <div className="space-y-2 max-h-72 overflow-y-auto">
                {friends.length === 0 ? (
                  <div className="text-xs text-slate-500 py-4 text-center">
                    No friends added yet. Search by username above to squad up.
                  </div>
                ) : (
                  friends.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between gap-2 p-2.5 bg-[#07090e] border border-slate-800 text-xs"
                    >
                      <div>
                        <div className="font-semibold text-white flex items-center gap-2">
                          {f.username}
                          <span className="text-[10px] font-mono-tabular text-slate-500">
                            Lv.{f.level}
                          </span>
                        </div>
                        <div className="text-[10px] font-mono-tabular uppercase text-slate-400">
                          {f.relationship === 'accepted'
                            ? f.status.replace('_', ' ')
                            : f.relationship.replace('_', ' ')}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {f.relationship === 'pending_incoming' ? (
                          <>
                            <TacticalButton
                              variant="primary"
                              size="sm"
                              onClick={async () => {
                                await api.respondFriendRequest(f.id, true);
                                loadAll();
                              }}
                            >
                              Accept
                            </TacticalButton>
                            <TacticalButton
                              variant="secondary"
                              size="sm"
                              onClick={async () => {
                                await api.respondFriendRequest(f.id, false);
                                loadAll();
                              }}
                            >
                              Decline
                            </TacticalButton>
                          </>
                        ) : f.relationship === 'accepted' ? (
                          <>
                            {f.online && (
                              <button
                                type="button"
                                onClick={() => {
                                  audioEngine.playUiClick(700);
                                  onInviteToParty(f.id);
                                  flash(`Party invite sent to ${f.username}`);
                                }}
                                className="px-2.5 py-1 bg-sky-500/20 text-sky-300 hover:bg-sky-500/35 cursor-pointer"
                              >
                                Invite
                              </button>
                            )}
                            {f.roomCode && (
                              <button
                                type="button"
                                onClick={() => onJoinRoomCode(f.roomCode!)}
                                className="px-2.5 py-1 bg-amber-500/20 text-amber-300 cursor-pointer"
                              >
                                Join
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={async () => {
                                await api.removeFriend(f.id);
                                loadAll();
                              }}
                              className="px-2 py-1 bg-slate-800 text-slate-400 hover:text-rose-300 cursor-pointer"
                            >
                              Remove
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </TacticalPanel>
        </div>

        {/* Clans & Safety */}
        <div className="lg:col-span-6 space-y-4">
          <TacticalPanel
            title="Competitive Clans"
            action={
              profile.clanTag ? (
                <TacticalButton
                  variant="danger"
                  size="sm"
                  onClick={async () => {
                    const res = await api.leaveClan();
                    onProfileUpdated(res.profile);
                    setClans(res.clans);
                  }}
                >
                  Leave [{profile.clanTag}]
                </TacticalButton>
              ) : (
                <Shield className="w-4 h-4 text-amber-400" />
              )
            }
          >
            <div className="space-y-3">
              {!profile.clanTag && (
                <form onSubmit={handleCreateClan} className="grid grid-cols-12 gap-2">
                  <input
                    type="text"
                    maxLength={5}
                    value={clanTag}
                    onChange={(e) => setClanTag(e.target.value.toUpperCase())}
                    placeholder="TAG"
                    className="col-span-3 bg-[#07090e] border border-slate-700 px-2.5 py-1.5 text-xs font-mono-tabular text-white"
                  />
                  <input
                    type="text"
                    value={clanName}
                    onChange={(e) => setClanName(e.target.value)}
                    placeholder="Clan Name"
                    className="col-span-6 bg-[#07090e] border border-slate-700 px-2.5 py-1.5 text-xs text-white"
                  />
                  <TacticalButton type="submit" variant="primary" size="sm" className="col-span-3">
                    Found
                  </TacticalButton>
                </form>
              )}

              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {clans.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between px-3 py-2 bg-[#07090e] border border-slate-800 text-xs"
                  >
                    <span className="font-semibold text-white">
                      <span className="font-mono-tabular text-amber-400 mr-1.5">[{c.tag}]</span>
                      {c.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono-tabular text-slate-400">
                        {c.member_count} members
                      </span>
                      {profile.clanTag !== c.tag && (
                        <TacticalButton
                          variant="secondary"
                          size="sm"
                          onClick={async () => {
                            const res = await api.joinClan(c.tag);
                            onProfileUpdated(res.profile);
                            setClans(res.clans);
                          }}
                        >
                          Join
                        </TacticalButton>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TacticalPanel>

          <TacticalPanel
            title="Safety, Block & Report"
            action={<Flag className="w-4 h-4 text-rose-400" />}
          >
            <form onSubmit={handleSubmitReport} className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  value={reportTarget}
                  onChange={(e) => setReportTarget(e.target.value)}
                  placeholder="Operator username"
                  className="bg-[#07090e] border border-slate-700 px-2.5 py-1.5 text-xs text-white"
                />
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="bg-[#07090e] border border-slate-700 px-2.5 py-1.5 text-xs text-white"
                >
                  <option>Cheating / Exploit</option>
                  <option>Harassment / Chat Abuse</option>
                  <option>Griefing / AFK</option>
                </select>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Incident details..."
                  className="flex-1 bg-[#07090e] border border-slate-700 px-2.5 py-1.5 text-xs text-white"
                />
                <TacticalButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    if (!reportTarget.trim()) return;
                    await api.blockUser(reportTarget.trim());
                    flash(`Blocked ${reportTarget.trim()}`);
                  }}
                >
                  Block
                </TacticalButton>
                <TacticalButton type="submit" variant="danger" size="sm">
                  Report
                </TacticalButton>
              </div>
            </form>
          </TacticalPanel>
        </div>
      </div>

      {/* Community Tournaments */}
      <TacticalPanel
        title="Community Tournaments"
        action={<Trophy className="w-4 h-4 text-amber-400" />}
      >
        <div className="space-y-4">
          <form onSubmit={handleCreateTourney} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={tourneyName}
              onChange={(e) => setTourneyName(e.target.value)}
              placeholder="Tournament title..."
              className="flex-1 min-w-[180px] bg-[#07090e] border border-slate-700 px-2.5 py-1.5 text-xs text-white"
            />
            <select
              value={tourneyMode}
              onChange={(e) => setTourneyMode(e.target.value)}
              className="bg-[#07090e] border border-slate-700 px-2 py-1.5 text-xs text-white"
            >
              {PUBLIC_GAME_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.shortName}
                </option>
              ))}
            </select>
            <select
              value={tourneyMap}
              onChange={(e) => setTourneyMap(e.target.value)}
              className="bg-[#07090e] border border-slate-700 px-2 py-1.5 text-xs text-white"
            >
              {MULTIPLAYER_MAPS.map((mp) => (
                <option key={mp.id} value={mp.id}>
                  {mp.name}
                </option>
              ))}
            </select>
            <TacticalButton type="submit" variant="primary" size="sm">
              Host Bracket
            </TacticalButton>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {tournaments.map((tr) => {
              const joined = tr.participants.includes(profile.username);
              return (
                <div key={tr.id} className="p-3 bg-[#07090e] border border-slate-800 sl-chamfer-sm space-y-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-bold text-sm uppercase text-white truncate">
                      {tr.name}
                    </span>
                    <span className="text-[10px] font-mono-tabular px-1.5 py-0.5 bg-slate-800 text-amber-300 uppercase shrink-0">
                      {tr.status}
                    </span>
                  </div>
                  <div className="text-slate-400 font-mono-tabular text-[11px]">
                    {tr.mode.toUpperCase()} · {tr.map_id} · {tr.participants.length}/{tr.max_teams} entered
                  </div>
                  <TacticalButton
                    variant="cyan"
                    size="sm"
                    disabled={joined}
                    className="w-full"
                    onClick={async () => {
                      await api.registerTournament(tr.id);
                      loadAll();
                    }}
                  >
                    {joined ? 'Registered' : 'Register Squad'}
                  </TacticalButton>
                </div>
              );
            })}
          </div>
        </div>
      </TacticalPanel>
    </div>
  );
}
