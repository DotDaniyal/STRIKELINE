import { useEffect, useState, type FormEvent } from 'react';
import { Activity, Ban, Newspaper, ShieldAlert } from 'lucide-react';
import { api } from '../../services/api.ts';

export function AdminTab() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.getAdminOverview>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newsTitle, setNewsTitle] = useState('');
  const [newsCat, setNewsCat] = useState('Patch Notes');
  const [newsVer, setNewsVer] = useState('v1.2.1');
  const [newsSum, setNewsSum] = useState('');
  const [newsBody, setNewsBody] = useState('');

  const load = async () => {
    try {
      const res = await api.getAdminOverview();
      setData(res);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Admin overview unavailable.');
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handlePublish = async (e: FormEvent) => {
    e.preventDefault();
    await api.publishNews(newsTitle, newsCat, newsVer, newsSum, newsBody);
    setNewsTitle('');
    setNewsSum('');
    setNewsBody('');
    load();
  };

  if (error) {
    return <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-700 text-rose-200 text-xs">{error}</div>;
  }
  if (!data) {
    return <div className="p-6 text-xs text-slate-400">Loading server diagnostics...</div>;
  }

  return (
    <div className="space-y-5">
      {/* Live Runtime Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Connected Players', data.metrics.connectedPlayers],
          ['Active Match Rooms', data.metrics.activeRooms],
          ['Process Memory', `${data.metrics.memoryMb} MB`],
          ['Server Uptime', `${data.metrics.uptimeSec}s`],
        ].map(([label, val]) => (
          <div key={String(label)} className="bg-[#0e131c]/95 border border-slate-800 rounded-xl p-4">
            <div className="text-[11px] font-mono uppercase text-slate-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400" /> {label}
            </div>
            <div className="font-display font-bold text-2xl text-white mt-1 tabular-nums">{val}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Report Queue */}
        <div className="lg:col-span-6 bg-[#0e131c]/95 border border-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="font-display text-sm font-bold uppercase text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" /> Moderation Queue
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto text-xs">
            {data.reports.length === 0 ? (
              <div className="text-slate-500">No player reports filed.</div>
            ) : (
              data.reports.map((r) => (
                <div key={r.id} className="p-2.5 rounded-lg bg-[#090d14] border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-white">
                      {r.target_username} — <span className="text-rose-300">{r.reason}</span>
                    </span>
                    <span className="font-mono text-[10px] uppercase text-slate-400">{r.status}</span>
                  </div>
                  <p className="text-slate-400">{r.details || 'No details'}</p>
                  <div className="flex gap-1.5 pt-1">
                    {(['open', 'reviewed', 'resolved'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={async () => {
                          await api.setReportStatus(r.id, st);
                          load();
                        }}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[10px] uppercase cursor-pointer"
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Users Management */}
        <div className="lg:col-span-6 bg-[#0e131c]/95 border border-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="font-display text-sm font-bold uppercase text-white flex items-center gap-2">
            <Ban className="w-4 h-4 text-amber-400" /> Accounts Directory
          </h3>
          <div className="space-y-1.5 max-h-64 overflow-y-auto text-xs tabular-nums">
            {data.users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-[#090d14] border border-slate-800"
              >
                <div>
                  <span className="font-semibold text-white">{u.username}</span>
                  <span className="ml-2 font-mono text-[10px] text-slate-400">
                    Lv.{u.level} · {u.role} · {u.kills}K/{u.deaths}D
                  </span>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await api.setUserBanned(u.id, u.banned === 0);
                    load();
                  }}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold cursor-pointer ${
                    u.banned ? 'bg-emerald-600/25 text-emerald-300' : 'bg-rose-600/25 text-rose-300'
                  }`}
                >
                  {u.banned ? 'Unban' : 'Ban'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Publish News */}
      <form
        onSubmit={handlePublish}
        className="bg-[#0e131c]/95 border border-slate-800 rounded-xl p-4 space-y-3 text-xs"
      >
        <h3 className="font-display text-sm font-bold uppercase text-white flex items-center gap-2">
          <Newspaper className="w-4 h-4 text-sky-400" /> Publish News / Patch Dispatch
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="text"
            required
            value={newsTitle}
            onChange={(e) => setNewsTitle(e.target.value)}
            placeholder="Dispatch Title"
            className="bg-[#090d14] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
          />
          <select
            value={newsCat}
            onChange={(e) => setNewsCat(e.target.value)}
            className="bg-[#090d14] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
          >
            <option>Patch Notes</option>
            <option>Event</option>
            <option>Competitive</option>
            <option>Announcement</option>
          </select>
          <input
            type="text"
            value={newsVer}
            onChange={(e) => setNewsVer(e.target.value)}
            placeholder="Version"
            className="bg-[#090d14] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono"
          />
        </div>
        <input
          type="text"
          value={newsSum}
          onChange={(e) => setNewsSum(e.target.value)}
          placeholder="Summary line"
          className="w-full bg-[#090d14] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
        />
        <div className="flex gap-2">
          <input
            type="text"
            required
            value={newsBody}
            onChange={(e) => setNewsBody(e.target.value)}
            placeholder="Full patch notes body..."
            className="flex-1 bg-[#090d14] border border-slate-700 rounded-lg px-2.5 py-1.5 text-white"
          />
          <button
            type="submit"
            className="px-4 py-1.5 rounded-lg bg-sky-500 text-slate-950 font-display font-bold uppercase cursor-pointer"
          >
            Publish
          </button>
        </div>
      </form>
    </div>
  );
}
