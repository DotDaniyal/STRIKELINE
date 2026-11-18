import { motion } from 'motion/react';
import { audioEngine } from '../../game/audio/AudioEngine.ts';

export interface SegmentOption<T extends string> {
  id: T;
  label: string;
}

interface Props<T extends string> {
  options: ReadonlyArray<SegmentOption<T>>;
  value: T;
  onChange: (value: T) => void;
  layoutId: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  layoutId,
  size = 'md',
  className = '',
}: Props<T>) {
  return (
    <div
      role="tablist"
      className={`inline-flex items-center gap-1 p-1 bg-[#080b11] border border-slate-800 sl-chamfer-sm overflow-x-auto max-w-full ${className}`}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            role="tab"
            aria-selected={active}
            type="button"
            onMouseEnter={() => {
              if (!active) audioEngine.playUiHover();
            }}
            onClick={() => {
              audioEngine.playUiClick(680);
              onChange(opt.id);
            }}
            className={`relative px-3.5 ${
              size === 'sm' ? 'py-1.5 text-[11px]' : 'py-2 text-xs'
            } font-display font-bold uppercase tracking-wider whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              active ? 'text-slate-950' : 'text-slate-300 hover:text-white'
            }`}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                className="absolute inset-0 bg-amber-500 sl-chamfer-sm"
                aria-hidden="true"
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
