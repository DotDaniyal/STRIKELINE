import { useEffect, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { audioEngine } from '../../game/audio/AudioEngine.ts';

interface Props {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  maxWidthClass?: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
}

export function ModalShell({
  title,
  subtitle,
  icon,
  maxWidthClass = 'max-w-3xl',
  onClose,
  footer,
  children,
}: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      className="fixed inset-0 z-50 bg-black/82 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className={`w-full ${maxWidthClass} max-h-[88vh] bg-[#0e131c] border border-slate-700/90 sl-chamfer flex flex-col overflow-hidden shadow-2xl`}
      >
        <div className="h-0.5 w-full bg-amber-500/80" aria-hidden="true" />
        <header className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon}
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold uppercase tracking-wide text-slate-50 truncate">
                {title}
              </h2>
              {subtitle && <p className="text-xs text-slate-400 truncate">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            aria-label="Close modal"
            onClick={() => {
              audioEngine.playUiClick(560);
              onClose();
            }}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">{children}</div>

        {footer && (
          <footer className="px-5 py-3.5 border-t border-slate-800 bg-[#090d14] flex flex-wrap items-center justify-between gap-3">
            {footer}
          </footer>
        )}
      </motion.div>
    </motion.div>
  );
}
