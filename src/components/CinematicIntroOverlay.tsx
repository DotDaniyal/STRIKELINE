import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Volume2, VolumeX, SkipForward, Play } from 'lucide-react';
import { CinematicIntroScene } from '../game/engine/CinematicIntroScene.ts';
import { audioEngine } from '../game/audio/AudioEngine.ts';
import { TacticalButton } from './ui/TacticalButton.tsx';

interface Props {
  onComplete: () => void;
}

export function CinematicIntroOverlay({ onComplete }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<CinematicIntroScene | null>(null);
  const [muted, setMuted] = useState(false);
  const [started, setStarted] = useState(false);

  const startCinematic = () => {
    setStarted(true);
    audioEngine.setAmbientMode('lobby');
    audioEngine.playMatchStart();

    if (containerRef.current && !sceneRef.current) {
      sceneRef.current = new CinematicIntroScene(containerRef.current, () => {
        onComplete();
      });
    }
  };

  useEffect(() => {
    return () => {
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-[#05070b] flex flex-col items-center justify-center select-none overflow-hidden">
      {/* 3D Cinematic Canvas Container */}
      <div ref={containerRef} className="absolute inset-0" />

      {/* Cinematic Vignette & Branding Overlay */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at center, rgba(5,7,11,0.12) 0%, rgba(5,7,11,0.85) 100%)',
        }}
      />

      <AnimatePresence>
        {!started ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            className="relative z-20 flex flex-col items-center gap-6 text-center px-6"
          >
            <div className="space-y-2">
              <span className="text-[11px] font-mono-tabular uppercase tracking-[0.28em] text-amber-400">
                Studio-Grade Tactical Combat
              </span>
              <h1 className="font-display text-5xl sm:text-7xl font-bold uppercase tracking-[0.14em] text-white">
                STRIKELINE
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 max-w-sm">
                Authoritative 3D multiplayer FPS engine initialized.
              </p>
            </div>

            <TacticalButton
              variant="primary"
              size="lg"
              onClick={startCinematic}
              className="px-8 py-4 text-base shadow-[0_0_35px_rgba(245,158,11,0.35)]"
            >
              <Play className="w-5 h-5 fill-current" />
              Initialize Cinematic Experience
            </TacticalButton>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-20 pointer-events-none flex flex-col justify-between p-6 sm:p-10"
          >
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="font-mono-tabular text-[10px] uppercase tracking-widest text-slate-300">
                  Cinematic Sequence Active
                </span>
              </div>
              <div className="pointer-events-auto flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const nextMuted = !muted;
                    setMuted(nextMuted);
                    audioEngine.applySettings({ muted: nextMuted } as any);
                  }}
                  className="p-2.5 bg-[#0e131c]/90 border border-slate-700 text-slate-300 hover:text-white cursor-pointer sl-chamfer-sm"
                  title={muted ? 'Unmute Audio' : 'Mute Audio'}
                >
                  {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    sceneRef.current?.dispose();
                    sceneRef.current = null;
                    onComplete();
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-[#0e131c]/90 border border-slate-700 text-slate-200 hover:text-white cursor-pointer font-display text-xs font-bold uppercase tracking-wider sl-chamfer-sm"
                >
                  <SkipForward className="w-4 h-4" />
                  Skip Intro
                </button>
              </div>
            </div>

            <div className="text-center pb-4">
              <div className="font-display text-xl sm:text-2xl font-bold uppercase tracking-[0.2em] text-white/90">
                STRIKELINE
              </div>
              <div className="text-[10px] font-mono-tabular uppercase tracking-widest text-amber-400 mt-0.5">
                Competitive 3D Multiplayer FPS
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
