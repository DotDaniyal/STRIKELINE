import { ArrowLeft, Shield, FileText, X } from 'lucide-react';

export type LegalDocType = 'privacy' | 'terms';

interface Props {
  doc: LegalDocType;
  standalone?: boolean;
  onSwitchDoc: (next: LegalDocType) => void;
  onClose: () => void;
}

export function LegalDocumentView({ doc, standalone = false, onSwitchDoc, onClose }: Props) {
  const isPrivacy = doc === 'privacy';

  const content = (
    <div className="w-full max-w-3xl bg-[#0c1018] border border-slate-700 sl-chamfer flex flex-col overflow-hidden shadow-2xl max-h-[88vh]">
      <div className="h-0.5 w-full bg-amber-500" />
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-slate-800 bg-[#080b10]">
        <div className="flex items-center gap-3">
          {standalone && (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 sl-chamfer-sm bg-[#121824] border border-slate-700 hover:border-slate-500 text-xs font-display font-bold uppercase tracking-wider text-slate-200 cursor-pointer whitespace-nowrap"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to STRIKELINE
            </button>
          )}
          <div className="flex items-center gap-2">
            {isPrivacy ? (
              <Shield className="w-5 h-5 text-amber-400" />
            ) : (
              <FileText className="w-5 h-5 text-amber-400" />
            )}
            <h1 className="font-display text-lg sm:text-xl font-bold uppercase tracking-wide text-white">
              {isPrivacy ? 'Privacy Policy' : 'Terms and Conditions'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSwitchDoc('privacy')}
            className={`px-3 py-1.5 sl-chamfer-sm text-xs font-display font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap ${
              isPrivacy ? 'bg-amber-500 text-slate-950' : 'bg-[#121824] border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            Privacy Policy
          </button>
          <button
            type="button"
            onClick={() => onSwitchDoc('terms')}
            className={`px-3 py-1.5 sl-chamfer-sm text-xs font-display font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap ${
              !isPrivacy ? 'bg-amber-500 text-slate-950' : 'bg-[#121824] border border-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            Terms of Use
          </button>
          {!standalone && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close legal document"
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm text-slate-300 leading-relaxed">
        <div className="text-xs font-mono text-slate-400">Effective Date: 2026-01-01 | Platform: STRIKELINE Web FPS</div>

        {isPrivacy ? (
          <>
            <section className="space-y-1.5">
              <h2 className="font-display text-base font-bold text-white">1. Information We Collect</h2>
              <p>
                When you play STRIKELINE as a guest or registered operator, we store your chosen username, hashed password
                (scrypt + salt for registered accounts), optional email address, match statistics, inventory unlocks, loadouts,
                friends list, and custom settings inside the server SQLite database.
              </p>
            </section>
            <section className="space-y-1.5">
              <h2 className="font-display text-base font-bold text-white">2. Session Storage & Authentication</h2>
              <p>
                Authentication tokens are stored in browser local storage under the session key so you remain signed in across
                page refreshes. We do not use third-party advertising trackers or cross-site tracking cookies.
              </p>
            </section>
            <section className="space-y-1.5">
              <h2 className="font-display text-base font-bold text-white">3. Voice Chat & Real-Time Telemetry</h2>
              <p>
                Optional squad voice chat uses peer-to-peer WebRTC audio streams routed via ICE signaling on our WebSocket
                server. Microphone audio is transmitted only while you explicitly activate Voice Chat in a match and is never
                recorded or archived on our servers. Gameplay input vectors, shot rays, and connection ping are processed in
                memory for authoritative hit validation and anti-cheat checks.
              </p>
            </section>
            <section className="space-y-1.5">
              <h2 className="font-display text-base font-bold text-white">4. Moderation & Audit Records</h2>
              <p>
                Player reports, anti-cheat flag events, and administrative actions are logged to maintain competitive integrity.
                You may request account removal or stop using guest sessions at any time by clearing your browser session and
                signing out.
              </p>
            </section>
          </>
        ) : (
          <>
            <section className="space-y-1.5">
              <h2 className="font-display text-base font-bold text-white">1. Acceptance of Terms</h2>
              <p>
                By accessing or playing STRIKELINE, you agree to abide by these Terms and Conditions and all applicable fair-play
                rules. If you do not agree with these terms, discontinue use of the service immediately.
              </p>
            </section>
            <section className="space-y-1.5">
              <h2 className="font-display text-base font-bold text-white">2. Competitive Integrity & Anti-Cheat</h2>
              <p>
                All matches use server-authoritative movement validation, rate-limiting, and ballistics checks. Using automated
                aiming tools, speed manipulation, packet tampering, or exploiting map geometry is strictly prohibited and may
                result in immediate match termination and permanent account suspension.
              </p>
            </section>
            <section className="space-y-1.5">
              <h2 className="font-display text-base font-bold text-white">3. Code of Conduct</h2>
              <p>
                Operators must not send abusive, hateful, harassing, or spam messages in match chat, team chat, or callsigns.
                Server moderators may review submitted player reports and issue account suspensions where warranted.
              </p>
            </section>
            <section className="space-y-1.5">
              <h2 className="font-display text-base font-bold text-white">4. Accounts & Virtual Progression</h2>
              <p>
                In-game credits, XP, weapon skins, and operator ranks have no monetary value outside STRIKELINE and cannot be
                sold or exchanged. We reserve the right to rebalance weapons, maps, and progression rates to preserve fair
                competitive play.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );

  if (standalone) {
    return (
      <main className="min-h-screen bg-[#0b0e14] flex items-center justify-center p-4 sm:p-8">
        {content}
      </main>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      {content}
    </div>
  );
}
