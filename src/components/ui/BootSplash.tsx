import { motion } from 'motion/react';

const TACTICAL_TIPS = [
  'Slide-jumping preserves momentum across open lanes and tightens peek angles.',
  'Press T near walls or floors to stamp your equipped tactical spray.',
  'Use Training Range Flick and Tracking drills to calibrate ADS sensitivity.',
  'Holding Objective Zones with teammates accelerates capture progress.',
];

export function BootSplash({ label = 'Synchronizing Combat Systems' }: { label?: string }) {
  const tip = TACTICAL_TIPS[Math.floor((Date.now() / 5000) % TACTICAL_TIPS.length)];

  return (
    <div className="fixed inset-0 z-50 bg-[#07090e] sl-grid-bg flex flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center max-w-md w-full"
      >
        <svg width="64" height="64" viewBox="0 0 42 42" fill="none" aria-hidden="true">
          <polygon
            points="21,2 40,12 40,30 21,40 2,30 2,12"
            stroke="#f59e0b"
            strokeWidth="2"
            fill="#0e131c"
          />
          <line x1="21" y1="7" x2="21" y2="15" stroke="#f8fafc" strokeWidth="2.2" />
          <line x1="21" y1="27" x2="21" y2="35" stroke="#f8fafc" strokeWidth="2.2" />
          <line x1="7" y1="21" x2="15" y2="21" stroke="#f8fafc" strokeWidth="2.2" />
          <line x1="27" y1="21" x2="35" y2="21" stroke="#f8fafc" strokeWidth="2.2" />
          <circle cx="21" cy="21" r="3" fill="#f59e0b" />
        </svg>

        <div className="mt-4 font-display text-2xl font-bold tracking-[0.22em] text-slate-50">
          STRIKELINE
        </div>
        <div className="mt-1.5 text-xs font-mono-tabular uppercase tracking-widest text-amber-400">
          {label}
        </div>

        <div className="mt-5 w-56 h-1 bg-[#111620] overflow-hidden border border-slate-800">
          <motion.div
            className="h-full w-24 bg-amber-500"
            animate={{ x: ['-100%', '240%'] }}
            transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
          />
        </div>

        <p className="mt-6 text-xs text-slate-400 leading-relaxed max-w-sm">
          {tip}
        </p>
      </motion.div>
    </div>
  );
}
