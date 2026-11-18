import { motion } from 'motion/react';

interface Props {
  label: string;
  value: number;
  max?: number;
  displayValue?: string;
  tone?: 'amber' | 'cyan' | 'emerald' | 'rose';
}

const TONE_CLASS: Record<NonNullable<Props['tone']>, string> = {
  amber: 'bg-amber-500',
  cyan: 'bg-sky-400',
  emerald: 'bg-emerald-400',
  rose: 'bg-rose-500',
};

export function StatBar({
  label,
  value,
  max = 100,
  displayValue,
  tone = 'amber',
}: Props) {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-300 font-medium">{label}</span>
        <span className="font-mono-tabular text-slate-100 font-semibold">
          {displayValue ?? Math.round(pct)}
        </span>
      </div>
      <div className="relative h-2 bg-[#07090e] border border-slate-800 overflow-hidden">
        <motion.div
          className={`h-full ${TONE_CLASS[tone]}`}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
        />
        {/* Segmented subtle tick overlay */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 grid grid-cols-5"
        >
          <span className="border-r border-[#07090e]/70" />
          <span className="border-r border-[#07090e]/70" />
          <span className="border-r border-[#07090e]/70" />
          <span className="border-r border-[#07090e]/70" />
          <span />
        </div>
      </div>
    </div>
  );
}
