import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { audioEngine } from '../../game/audio/AudioEngine.ts';

type Variant = 'primary' | 'secondary' | 'cyan' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  chamfer?: boolean;
  silent?: boolean;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<Variant, string> = {
  primary:
    'bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold border border-amber-300/60 shadow-[0_0_24px_rgba(245,158,11,0.22)]',
  secondary:
    'bg-[#131a26] hover:bg-[#1a2333] active:bg-[#0e141e] text-slate-100 border border-slate-700 hover:border-slate-500 font-semibold',
  cyan:
    'bg-sky-500/15 hover:bg-sky-500/25 active:bg-sky-500/30 text-sky-300 border border-sky-400/45 font-bold',
  ghost:
    'bg-transparent hover:bg-slate-800/70 active:bg-slate-800 text-slate-300 hover:text-white border border-transparent font-medium',
  danger:
    'bg-rose-600/20 hover:bg-rose-600/35 active:bg-rose-600/45 text-rose-300 border border-rose-500/50 font-semibold',
};

const SIZE_CLASSES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-xs',
  lg: 'px-6 py-3 text-sm',
};

export function TacticalButton({
  variant = 'secondary',
  size = 'md',
  chamfer = true,
  silent = false,
  className = '',
  onClick,
  onMouseEnter,
  disabled,
  children,
  ...rest
}: Props) {
  return (
    <button
      disabled={disabled}
      onMouseEnter={(e) => {
        if (!disabled && !silent) audioEngine.playUiHover();
        onMouseEnter?.(e);
      }}
      onClick={(e) => {
        if (!disabled && !silent) {
          audioEngine.playUiClick(variant === 'primary' ? 760 : 660);
        }
        onClick?.(e);
      }}
      className={`inline-flex items-center justify-center gap-2 font-display uppercase tracking-wider transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45 disabled:pointer-events-none active:scale-[0.985] ${
        chamfer ? 'sl-chamfer-sm' : 'rounded-sm'
      } ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
