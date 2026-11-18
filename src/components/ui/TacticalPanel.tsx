import type { ReactNode } from 'react';

interface Props {
  title?: string;
  subtitle?: string;
  eyebrow?: string;
  action?: ReactNode;
  chamfer?: boolean;
  accent?: 'none' | 'amber' | 'cyan' | 'rose' | 'emerald';
  className?: string;
  children: ReactNode;
}

const ACCENT_TOP: Record<NonNullable<Props['accent']>, string> = {
  none: 'bg-slate-700/60',
  amber: 'bg-amber-500',
  cyan: 'bg-sky-400',
  rose: 'bg-rose-500',
  emerald: 'bg-emerald-400',
};

export function TacticalPanel({
  title,
  subtitle,
  eyebrow,
  action,
  chamfer = true,
  accent = 'none',
  className = '',
  children,
}: Props) {
  return (
    <section
      className={`relative bg-[#0c1018]/94 border border-slate-800/90 ${
        chamfer ? 'sl-chamfer' : 'rounded-sm'
      } ${className}`}
    >
      {/* Subtle architectural corner markers */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-0 right-0 w-2.5 h-2.5 border-t border-r border-slate-500/45"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-0 left-0 w-2.5 h-2.5 border-b border-l border-slate-500/45"
      />

      {accent !== 'none' && (
        <div className={`h-0.5 w-14 ${ACCENT_TOP[accent]} mb-0`} aria-hidden="true" />
      )}

      {(title || eyebrow || action) && (
        <header className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3.5 pb-2.5 border-b border-slate-800/80">
          <div className="min-w-0">
            {eyebrow && (
              <div className="text-[10px] font-mono-tabular uppercase tracking-widest text-amber-400/90">
                {eyebrow}
              </div>
            )}
            {title && (
              <h3 className="font-display text-sm font-bold uppercase tracking-wider text-slate-100 truncate">
                {title}
              </h3>
            )}
            {subtitle && <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}

      <div className="p-4">{children}</div>
    </section>
  );
}
