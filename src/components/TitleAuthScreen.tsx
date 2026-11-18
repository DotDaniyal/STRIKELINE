import { useState, type FormEvent } from 'react';
import { motion } from 'motion/react';
import { Crosshair, Shield, Swords, Target } from 'lucide-react';
import type { UserProfile } from '../../shared/types/game.ts';
import { api, setAuthToken } from '../services/api.ts';
import { audioEngine } from '../game/audio/AudioEngine.ts';
import { TacticalButton } from './ui/TacticalButton.tsx';
import { SegmentedControl } from './ui/SegmentedControl.tsx';
import type { LegalDocType } from './LegalDocumentModal.tsx';

interface Props {
  onAuthenticated: (profile: UserProfile, token: string) => void;
  onOpenLegal: (doc: LegalDocType) => void;
}

const AUTH_TABS = [
  { id: 'quick', label: 'Quick Deploy' },
  { id: 'login', label: 'Sign In' },
  { id: 'register', label: 'Register' },
  { id: 'reset', label: 'Recovery' },
] as const;

export function TitleAuthScreen({ onAuthenticated, onOpenLegal }: Props) {
  const [tab, setTab] = useState<'quick' | 'login' | 'register' | 'reset'>('quick');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetTokenInput, setResetTokenInput] = useState('');
  const [issuedResetToken, setIssuedResetToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleGuestDeploy = async () => {
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
      if (tab === 'login') {
        const res = await api.login(username, password);
        setAuthToken(res.token);
        onAuthenticated(res.profile, res.token);
      } else if (tab === 'register') {
        const res = await api.register(username, email, password);
        setAuthToken(res.token);
        onAuthenticated(res.profile, res.token);
      } else if (tab === 'reset') {
        if (!issuedResetToken) {
          const res = await api.requestPasswordReset(email);
          setIssuedResetToken(res.resetToken);
          setResetTokenInput(res.resetToken);
          setInfo('Verification token generated. Enter new password.');
        } else {
          await api.completePasswordReset(resetTokenInput, password);
          setInfo('Password updated successfully. You may now sign in.');
          setTab('login');
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
    <div className="relative w-full min-h-screen flex flex-col justify-between overflow-x-hidden bg-[#07090e]">
      {/* 3D Key-Art Armory Atmospheric Backdrop */}
      <div className="absolute inset-0 pointer-events-none">
        <img
          src="/src/assets/images/hero_armory_backdrop_1794933859969.jpg"
          alt="Strikeline Armory"
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover opacity-35"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 50% 45%, rgba(7,9,14,0.45) 0%, rgba(7,9,14,0.92) 85%)',
          }}
        />
      </div>

      {/* Top Navigation */}
      <header className="relative z-10 px-6 lg:px-12 py-5 flex items-center justify-between border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <svg width="34" height="34" viewBox="0 0 42 42" fill="none" aria-hidden="true">
            <polygon points="21,2 40,12 40,30 21,40 2,30 2,12" stroke="#f59e0b" strokeWidth="2.4" fill="#0e131c" />
            <circle cx="21" cy="21" r="4" fill="#f59e0b" />
          </svg>
          <div>
            <span className="font-display text-lg font-bold tracking-[0.16em] text-white">
              STRIKELINE
            </span>
            <span className="text-[9px] font-mono-tabular uppercase tracking-widest text-amber-400 block">
              Tactical FPS Arena
            </span>
          </div>
        </div>
        <div className="text-xs font-mono-tabular text-slate-400 hidden sm:block">
          Authoritative 25Hz Netcode
        </div>
      </header>

      {/* Main 3D-Oriented Minimalist Deck */}
      <main className="relative z-10 max-w-6xl w-full mx-auto px-6 lg:px-12 my-auto py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-16 items-center">
          {/* Left Briefing */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7 space-y-6"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#0c1018]/90 border border-amber-500/40 sl-chamfer-sm text-[10px] font-mono-tabular uppercase tracking-wider text-amber-300">
              <Crosshair className="w-3.5 h-3.5" /> Next-Gen Browser FPS
            </div>

            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold uppercase tracking-tight text-white leading-[1.02]">
              Precision Combat.
              <br />
              <span className="text-amber-400">Zero Compromise.</span>
            </h1>

            <p className="text-sm sm:text-base text-slate-300 max-w-lg leading-relaxed">
              Authoritative multiplayer tactical shooter with slide-jump momentum, crisp hit registration, custom weapon finishes, and private bot skirmishes.
            </p>

            <div className="grid grid-cols-3 gap-3 pt-2 max-w-md">
              <div className="p-3 bg-[#0c1018]/80 border border-slate-800/85 sl-chamfer-sm">
                <div className="text-[10px] font-mono-tabular text-amber-400 uppercase">Weapons</div>
                <div className="font-display font-bold text-lg text-white mt-0.5">7 Loadouts</div>
              </div>
              <div className="p-3 bg-[#0c1018]/80 border border-slate-800/85 sl-chamfer-sm">
                <div className="text-[10px] font-mono-tabular text-sky-400 uppercase">Modes</div>
                <div className="font-display font-bold text-lg text-white mt-0.5">8 Rulesets</div>
              </div>
              <div className="p-3 bg-[#0c1018]/80 border border-slate-800/85 sl-chamfer-sm">
                <div className="text-[10px] font-mono-tabular text-emerald-400 uppercase">Arenas</div>
                <div className="font-display font-bold text-lg text-white mt-0.5">6 Maps</div>
              </div>
            </div>
          </motion.div>

          {/* Right Minimalist Auth Terminal */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 bg-[#090c12]/92 border border-slate-800/90 sl-chamfer p-6 sm:p-7 space-y-5 backdrop-blur-md shadow-2xl"
          >
            <SegmentedControl
              layoutId="auth-tab-selector"
              options={AUTH_TABS}
              value={tab}
              onChange={(next) => {
                setTab(next);
                setError(null);
                setInfo(null);
              }}
              size="sm"
            />

            {error && (
              <div className="px-3 py-2 bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs sl-chamfer-sm">
                {error}
              </div>
            )}
            {info && (
              <div className="px-3 py-2 bg-sky-500/15 border border-sky-500/40 text-sky-200 text-xs sl-chamfer-sm">
                {info}
              </div>
            )}

            {tab === 'quick' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-mono-tabular uppercase tracking-wider text-slate-400 mb-1.5">
                    Operator Callsign (Optional)
                  </label>
                  <input
                    type="text"
                    maxLength={14}
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Operative"
                    className="w-full px-3.5 py-2.5 bg-[#07090e] border border-slate-700 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 sl-chamfer-sm"
                  />
                </div>
                <TacticalButton
                  type="button"
                  variant="primary"
                  size="lg"
                  disabled={busy}
                  onClick={handleGuestDeploy}
                  className="w-full"
                >
                  {busy ? 'Initializing Session...' : 'Enter Combat Lobby'}
                </TacticalButton>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {tab !== 'reset' && (
                  <div>
                    <label className="block text-[11px] font-mono-tabular uppercase tracking-wider text-slate-400 mb-1">
                      {tab === 'login' ? 'Username or Email' : 'Username'}
                    </label>
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder={tab === 'login' ? 'Callsign or email' : '3-16 characters'}
                      className="w-full px-3.5 py-2.5 bg-[#07090e] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-amber-500 sl-chamfer-sm"
                    />
                  </div>
                )}

                {(tab === 'register' || tab === 'reset') && (
                  <div>
                    <label className="block text-[11px] font-mono-tabular uppercase tracking-wider text-slate-400 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="operator@domain.com"
                      className="w-full px-3.5 py-2.5 bg-[#07090e] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-amber-500 sl-chamfer-sm"
                    />
                  </div>
                )}

                {tab === 'reset' && issuedResetToken && (
                  <div>
                    <label className="block text-[11px] font-mono-tabular uppercase tracking-wider text-slate-400 mb-1">
                      Verification Token (<span className="text-amber-400">{issuedResetToken}</span>)
                    </label>
                    <input
                      type="text"
                      required
                      value={resetTokenInput}
                      onChange={(e) => setResetTokenInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#07090e] border border-slate-700 text-sm text-slate-100 font-mono-tabular focus:outline-none focus:border-amber-500 sl-chamfer-sm"
                    />
                  </div>
                )}

                {(tab !== 'reset' || issuedResetToken) && (
                  <div>
                    <label className="block text-[11px] font-mono-tabular uppercase tracking-wider text-slate-400 mb-1">
                      {tab === 'reset' ? 'New Password' : 'Password'}
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full px-3.5 py-2.5 bg-[#07090e] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:border-amber-500 sl-chamfer-sm"
                    />
                  </div>
                )}

                <TacticalButton
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={busy}
                  className="w-full"
                >
                  {busy
                    ? 'Authenticating...'
                    : tab === 'login'
                    ? 'Sign In'
                    : tab === 'register'
                    ? 'Create Account & Deploy'
                    : issuedResetToken
                    ? 'Reset Password'
                    : 'Request Verification Token'}
                </TacticalButton>
              </form>
            )}
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 px-6 lg:px-12 py-4 border-t border-slate-800/80 bg-[#07090e]/90 text-[11px] text-slate-400 font-mono-tabular flex flex-wrap items-center justify-between gap-3">
        <span>WASD Move · Shift Sprint · C Slide · Space Jump · LMB Fire · RMB Aim · R Reload</span>
        <div className="flex items-center gap-4">
          <a
            href="/privacy"
            onClick={(e) => {
              e.preventDefault();
              onOpenLegal('privacy');
            }}
            className="hover:text-amber-400 underline underline-offset-4 cursor-pointer"
          >
            Privacy Policy
          </a>
          <a
            href="/terms"
            onClick={(e) => {
              e.preventDefault();
              onOpenLegal('terms');
            }}
            className="hover:text-amber-400 underline underline-offset-4 cursor-pointer"
          >
            Terms &amp; Conditions
          </a>
        </div>
      </footer>
    </div>
  );
}
