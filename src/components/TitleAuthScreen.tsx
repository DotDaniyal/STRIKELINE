import { useState, type FormEvent } from 'react';
import type { UserProfile } from '../../shared/types/game.ts';
import { api, setAuthToken } from '../services/api.ts';
import { audioEngine } from '../game/audio/AudioEngine.ts';

interface Props {
  onAuthenticated: (profile: UserProfile, token: string) => void;
}

export function TitleAuthScreen({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<'quick' | 'login' | 'register' | 'reset'>('quick');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetTokenInput, setResetTokenInput] = useState('');
  const [issuedResetToken, setIssuedResetToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleGuestDeploy = async () => {
    audioEngine.playUiClick(720);
    setBusy(true);
    setError(null);
    try {
      const res = await api.guest(username.trim() || undefined);
      setAuthToken(res.token);
      onAuthenticated(res.profile, res.token);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Connection failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    audioEngine.playUiClick(680);
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      if (mode === 'login') {
        const res = await api.login(username, password);
        setAuthToken(res.token);
        onAuthenticated(res.profile, res.token);
      } else if (mode === 'register') {
        const res = await api.register(username, email, password);
        setAuthToken(res.token);
        onAuthenticated(res.profile, res.token);
      } else if (mode === 'reset') {
        if (!issuedResetToken) {
          const res = await api.requestPasswordReset(email);
          setIssuedResetToken(res.resetToken);
          setResetTokenInput(res.resetToken);
          setInfo('Verification token generated. Enter your new password below.');
        } else {
          await api.completePasswordReset(resetTokenInput, password);
          setInfo('Password updated. You may now sign in.');
          setMode('login');
          setIssuedResetToken(null);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col justify-between overflow-hidden bg-[#0b0e14]">
      {/* Key-Art Armory Backdrop with graceful gradient fallback */}
      <div className="absolute inset-0">
        <img
          src="/src/assets/images/hero_armory_backdrop_1794933859969.jpg"
          alt="Strikeline Tactical Armory"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-55"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(95deg, rgba(11,14,20,0.96) 0%, rgba(11,14,20,0.82) 45%, rgba(11,14,20,0.45) 100%)',
          }}
        />
      </div>

      {/* Top Brand Lockup */}
      <div className="relative z-10 px-6 md:px-14 pt-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <svg width="42" height="42" viewBox="0 0 42 42" fill="none" aria-hidden="true">
            <polygon points="21,2 40,12 40,30 21,40 2,30 2,12" stroke="#f59e0b" strokeWidth="2.2" fill="#111827" />
            <line x1="21" y1="8" x2="21" y2="16" stroke="#f8fafc" strokeWidth="2.2" />
            <line x1="21" y1="26" x2="21" y2="34" stroke="#f8fafc" strokeWidth="2.2" />
            <line x1="8" y1="21" x2="16" y2="21" stroke="#f8fafc" strokeWidth="2.2" />
            <line x1="26" y1="21" x2="34" y2="21" stroke="#f8fafc" strokeWidth="2.2" />
            <circle cx="21" cy="21" r="3" fill="#f59e0b" />
          </svg>
          <div>
            <span className="font-display text-2xl font-bold tracking-wider text-slate-100">
              STRIKELINE
            </span>
          </div>
        </div>
        <div className="text-xs text-slate-400 font-mono-tabular hidden sm:block">
          Season 1 · Competitive 3D Multiplayer
        </div>
      </div>

      {/* Center Hero & Auth Panel */}
      <div className="relative z-10 px-6 md:px-14 my-auto max-w-xl">
        <h1 className="font-display text-4xl md:text-6xl font-bold tracking-tight text-slate-50 leading-tight text-balance">
          Precision Gunplay. Real-Time Combat.
        </h1>
        <p className="mt-3 text-slate-300 text-sm md:text-base max-w-md leading-relaxed">
          Drop directly into authoritative 3D arenas across 8 competitive modes, 7 tuned weapons, and 6 multi-level maps.
        </p>

        {/* Mode Switcher Tabs */}
        <div className="mt-7 inline-flex items-center gap-1 p-1 bg-[#131822] border border-slate-800 rounded-lg">
          {(
            [
              ['quick', 'Quick Deploy'],
              ['login', 'Sign In'],
              ['register', 'Create Account'],
              ['reset', 'Recovery'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                audioEngine.playUiClick();
                setMode(id);
                setError(null);
                setInfo(null);
              }}
              className={`px-3.5 py-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === id
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Auth Form / Quick Deploy */}
        <div className="mt-4 bg-[#111620] border border-slate-800 rounded-xl p-5 shadow-2xl">
          {error && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs">
              {error}
            </div>
          )}
          {info && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-200 text-xs">
              {info}
            </div>
          )}

          {mode === 'quick' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Callsign (optional for guest deployment)
                </label>
                <input
                  type="text"
                  maxLength={14}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Operative"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-[#0b0e14] border border-slate-700 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500"
                />
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={handleGuestDeploy}
                className="w-full py-3 px-5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-base tracking-wide transition-colors cursor-pointer disabled:opacity-50"
              >
                {busy ? 'Initializing Session...' : 'Enter Combat Lobby'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode !== 'reset' && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    {mode === 'login' ? 'Username or Email' : 'Username'}
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={mode === 'login' ? 'Callsign or email' : '3-16 characters'}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#0b0e14] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              {(mode === 'register' || mode === 'reset') && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@domain.com"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#0b0e14] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              {mode === 'reset' && issuedResetToken && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    Verification Token (Issued: <span className="font-mono-tabular text-amber-400">{issuedResetToken}</span>)
                  </label>
                  <input
                    type="text"
                    required
                    value={resetTokenInput}
                    onChange={(e) => setResetTokenInput(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#0b0e14] border border-slate-700 text-sm text-slate-100 font-mono-tabular focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              {(mode !== 'reset' || issuedResetToken) && (
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">
                    {mode === 'reset' ? 'New Password' : 'Password'}
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[#0b0e14] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 px-5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-display font-bold text-sm tracking-wide transition-colors cursor-pointer disabled:opacity-50"
              >
                {busy
                  ? 'Authenticating...'
                  : mode === 'login'
                  ? 'Sign In'
                  : mode === 'register'
                  ? 'Create Account & Deploy'
                  : issuedResetToken
                  ? 'Reset Password'
                  : 'Request Verification Token'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Flat Control Hint Footer */}
      <div className="relative z-10 px-6 md:px-14 pb-6 text-xs text-slate-400 font-mono-tabular flex flex-wrap items-center justify-between gap-4">
        <span>WASD Move · Shift Sprint · C Crouch / Slide · Space Jump · LMB Fire · RMB Aim · R Reload · Esc Pause</span>
        <span>Desktop · Mobile Touch · Gamepad Ready</span>
      </div>
    </div>
  );
}
