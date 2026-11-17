import { useEffect, useState, type FormEvent } from 'react';
import { Flag, Shield, Trophy, UserPlus, Users } from 'lucide-react';
import type { FriendEntry, UserProfile } from '../../../shared/types/game.ts';
import { PUBLIC_GAME_MODES } from '../../../shared/constants/modes.ts';
import { MULTIPLAYER_MAPS } from '../../../shared/constants/maps.ts';
import { api } from '../../services/api.ts';
import { audioEngine } from '../../game/audio/AudioEngine.ts';

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
        <div className="px-4 py-2.5 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-200 text-xs font-medium">
          {notice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Friends & Requests */}
        <div className="lg:col-span-6 bg-[#0e131c]/95 border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-sky-400" /> Friends Roster
            </h3>
          </div>

          <form onSubmit={handleAddFriend} className="flex gap-2">
            <input
              type="text"
              value={friendName}
              onChange={(e) => setFriendName(e.target.value)}
              placeholder="Enter operator username..."
              className="flex-1 bg-[#090d14] border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-display font-bold text-xs uppercase cursor-pointer whitespace-nowrap shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" /> Add
            </button>
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
                  className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-[#090d14] border border-slate-800 text-xs"
                >
                  <div>
                    <div className="font-semibold text-white flex items-center gap-2">
                      {f.username}
                      <span className="text-[10px] font-mono text-slate-500">Lv.{f.level}</span>
                    </div>
                    <div className="text-[10px] font-mono uppercase text-slate-400">
                      {f.relationship === 'accepted' ? f.status.replace('_', ' ') : f.relationship.replace('_', ' ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {f.relationship === 'pending_incoming' ? (
                      <>
                        <button
                          type="button"
                          onClick={async () => {
                            await api.respondFriendRequest(f.id, true);
                            loadAll();
                          }}
                          className="px-2.5 py-1 rounded bg-emerald-500 text-slate-950 font-semibold cursor-pointer"
                        >
                          Accept
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            await api.respondFriendRequest(f.id, false);
                            loadAll();
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 cursor-pointer"
                        >
                          Decline
                        </button>
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
                            className="px-2.5 py-1 rounded bg-sky-500/20 text-sky-300 hover:bg-sky-500/35 cursor-pointer"
                          >
                            Invite
                          </button>
                        )}
                        {f.roomCode && (
                          <button
                            type="button"
                            onClick={() => onJoinRoomCode(f.roomCode!)}
                            className="px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 cursor-pointer"
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
                          className="px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-rose-300 cursor-pointer"
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

        {/* Clans & Safety */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-[#0e131c]/95 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" /> Competitive Clans
              </h3>
              {profile.clanTag && (
                <button
                  type="button"
                  onClick={async () => {
                    const res = await api.leaveClan();
                    onProfileUpdated(res.profile);
                    setClans(res.clans);
                  }}
                  className="text-xs px-2.5 py-1 rounded bg-rose-600/20 text-rose-300 cursor-pointer"
                >
                  Leave [{profile.clanTag}]
                </button>
              )}
            </div>

            {!profile.clanTag && (
              <form onSubmit={handleCreateClan} className="grid grid-cols-12 gap-2">
                <input
                  type="text"
                  maxLength={5}
                  value={clanTag}
                  onChange={(e) => setClanTag(e.target.value.toUpperCase())}
                  placeholder="TAG"
                  className="col-span-3 bg-[#090d14] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white"
                />
                <input
                  type="text"
                  value={clanName}
                  onChange={(e) => setClanName(e.target.value)}
                  placeholder="Clan Name"
                  className="col-span-6 bg-[#090d14] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
                <button
                  type="submit"
                  className="col-span-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-display font-bold text-xs uppercase cursor-pointer"
                >
                  Found
                </button>
              </form>
            )}

            <div className="space-y-1.5 max-h-36 overflow-y-auto">
              {clans.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#090d14] border border-slate-800 text-xs"
                >
                  <span className="font-semibold text-white">
                    <span className="font-mono text-amber-400 mr-1.5">[{c.tag}]</span>
                    {c.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-slate-400 tabular-nums">{c.member_count} members</span>
                    {profile.clanTag !== c.tag && (
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await api.joinClan(c.tag);
                          onProfileUpdated(res.profile);
                          setClans(res.clans);
                        }}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
                      >
                        Join
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Player Safety & Report */}
          <form
            onSubmit={handleSubmitReport}
            className="bg-[#0e131c]/95 border border-slate-800 rounded-xl p-4 space-y-2.5"
          >
            <h3 className="font-display text-sm font-bold text-white flex items-center gap-2">
              <Flag className="w-4 h-4 text-rose-400" /> Safety, Block & Report
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={reportTarget}
                onChange={(e) => setReportTarget(e.target.value)}
                placeholder="Operator username"
                className="bg-[#090d14] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
              <select
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                className="bg-[#090d14] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
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
                className="flex-1 bg-[#090d14] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
              <button
                type="button"
                onClick={async () => {
                  if (!reportTarget.trim()) return;
                  await api.blockUser(reportTarget.trim());
                  flash(`Blocked ${reportTarget.trim()}`);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Block
              </button>
              <button
                type="submit"
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-semibold cursor-pointer"
              >
                Report
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Community Tournaments */}
      <div className="bg-[#0e131c]/95 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold text-white flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" /> Community Tournaments
          </h3>
          <form onSubmit={handleCreateTourney} className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={tourneyName}
              onChange={(e) => setTourneyName(e.target.value)}
              placeholder="Tournament title..."
              className="bg-[#090d14] border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
            />
            <select
              value={tourneyMode}
              onChange={(e) => setTourneyMode(e.target.value)}
              className="bg-[#090d14] border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
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
              className="bg-[#090d14] border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white"
            >
              {MULTIPLAYER_MAPS.map((mp) => (
                <option key={mp.id} value={mp.id}>
                  {mp.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-3.5 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-display font-bold text-xs uppercase cursor-pointer whitespace-nowrap shrink-0"
            >
              Host Bracket
            </button>
          </form>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {tournaments.map((tr) => {
            const joined = tr.participants.includes(profile.username);
            return (
              <div key={tr.id} className="p-3 rounded-lg bg-[#090d14] border border-slate-800 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-sm text-white">{tr.name}</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 uppercase">
                    {tr.status}
                  </span>
                </div>
                <div className="text-slate-400 font-mono text-[11px] tabular-nums">
                  {tr.mode.toUpperCase()} · {tr.map_id} · {tr.participants.length}/{tr.max_teams} entered
                </div>
                <button
                  type="button"
                  disabled={joined}
                  onClick={async () => {
                    await api.registerTournament(tr.id);
                    loadAll();
                  }}
                  className="w-full py-1.5 rounded bg-sky-500/20 hover:bg-sky-500/35 disabled:opacity-50 text-sky-300 font-semibold cursor-pointer"
                >
                  {joined ? 'Registered' : 'Register Squad'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
