import { useRef, useState } from 'react';
import type { GameEngine } from '../game/engine/GameEngine.ts';

interface Props {
  engine: GameEngine | null;
  scale?: number;
}

export function MobileControls({ engine, scale = 1 }: Props) {
  const [stickOffset, setStickOffset] = useState({ x: 0, y: 0 });
  const stickCenterRef = useRef<{ x: number; y: number } | null>(null);
  const lookTouchRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const [adsActive, setAdsActive] = useState(false);

  const handleStickStart = (e: React.TouchEvent) => {
    const touch = e.changedTouches[0];
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    stickCenterRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    updateStick(touch.clientX, touch.clientY);
  };

  const handleStickMove = (e: React.TouchEvent) => {
    if (!stickCenterRef.current) return;
    const touch = e.changedTouches[0];
    updateStick(touch.clientX, touch.clientY);
  };

  const handleStickEnd = () => {
    stickCenterRef.current = null;
    setStickOffset({ x: 0, y: 0 });
    engine?.setTouchMove(0, 0);
  };

  const updateStick = (tx: number, ty: number) => {
    if (!stickCenterRef.current) return;
    const maxR = 42 * scale;
    let dx = tx - stickCenterRef.current.x;
    let dy = ty - stickCenterRef.current.y;
    const dist = Math.hypot(dx, dy);
    if (dist > maxR) {
      dx = (dx / dist) * maxR;
      dy = (dy / dist) * maxR;
    }
    setStickOffset({ x: dx, y: dy });
    engine?.setTouchMove(dx / maxR, dy / maxR);
  };

  const handleLookStart = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    lookTouchRef.current = { id: t.identifier, x: t.clientX, y: t.clientY };
  };

  const handleLookMove = (e: React.TouchEvent) => {
    if (!lookTouchRef.current) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === lookTouchRef.current.id) {
        const dx = t.clientX - lookTouchRef.current.x;
        const dy = t.clientY - lookTouchRef.current.y;
        lookTouchRef.current.x = t.clientX;
        lookTouchRef.current.y = t.clientY;
        engine?.addTouchLook(dx * 2.1, dy * 2.1);
      }
    }
  };

  const handleLookEnd = () => {
    lookTouchRef.current = null;
  };

  return (
    <div className="fixed inset-0 pointer-events-none z-30 select-none">
      {/* Right-half touch aim surface */}
      <div
        className="absolute right-0 top-14 bottom-0 w-1/2 pointer-events-auto"
        onTouchStart={handleLookStart}
        onTouchMove={handleLookMove}
        onTouchEnd={handleLookEnd}
      />

      {/* Left Movement Thumbstick */}
      <div
        className="absolute left-5 bottom-24 sm:bottom-8 w-28 h-28 sl-chamfer border-2 border-slate-500/50 bg-[#07090e]/55 pointer-events-auto flex items-center justify-center touch-none"
        style={{ transform: `scale(${scale})`, transformOrigin: 'bottom left' }}
        onTouchStart={handleStickStart}
        onTouchMove={handleStickMove}
        onTouchEnd={handleStickEnd}
      >
        <div
          className="w-12 h-12 sl-chamfer-sm bg-amber-500/85 border border-amber-200"
          style={{ transform: `translate(${stickOffset.x}px, ${stickOffset.y}px)` }}
        />
      </div>

      {/* Right Action Buttons (>=44px touch targets) */}
      <div
        className="absolute right-4 bottom-24 sm:bottom-7 flex items-end gap-2.5 pointer-events-auto"
        style={{ transform: `scale(${scale})`, transformOrigin: 'bottom right' }}
      >
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onTouchStart={(e) => {
              e.stopPropagation();
              engine?.swapWeaponSlot();
            }}
            className="w-12 h-12 sl-chamfer-sm bg-[#0c1018]/85 border border-slate-500 font-display text-[11px] font-bold text-slate-100 active:bg-amber-500 active:text-slate-950"
          >
            SWAP
          </button>
          <button
            type="button"
            onTouchStart={(e) => {
              e.stopPropagation();
              engine?.triggerReload();
            }}
            className="w-12 h-12 sl-chamfer-sm bg-[#0c1018]/85 border border-slate-500 font-display text-[11px] font-bold text-slate-100 active:bg-amber-500 active:text-slate-950"
          >
            RLD
          </button>
          <button
            type="button"
            onTouchStart={(e) => {
              e.stopPropagation();
              engine?.toggleTouchCrouch();
            }}
            className="w-12 h-12 sl-chamfer-sm bg-[#0c1018]/85 border border-slate-500 font-display text-[11px] font-bold text-slate-100 active:bg-amber-500 active:text-slate-950"
          >
            SLIDE
          </button>
        </div>

        <div className="flex flex-col gap-2.5 items-center">
          <button
            type="button"
            onTouchStart={(e) => {
              e.stopPropagation();
              const next = !adsActive;
              setAdsActive(next);
              engine?.setTouchAds(next);
            }}
            className={`w-13 h-13 sl-chamfer-sm border font-display text-xs font-bold ${
              adsActive
                ? 'bg-sky-500 text-slate-950 border-sky-200'
                : 'bg-[#0c1018]/85 text-slate-100 border-slate-500'
            }`}
          >
            ADS
          </button>
          <button
            type="button"
            onTouchStart={(e) => {
              e.stopPropagation();
              engine?.triggerJump();
            }}
            className="w-14 h-14 sl-chamfer-sm bg-[#0c1018]/85 border border-slate-400 font-display text-xs font-bold text-slate-100 active:bg-slate-600"
          >
            JUMP
          </button>
        </div>

        <button
          type="button"
          onTouchStart={(e) => {
            e.stopPropagation();
            engine?.setTouchFire(true);
          }}
          onTouchEnd={(e) => {
            e.stopPropagation();
            engine?.setTouchFire(false);
          }}
          className="w-18 h-18 sl-chamfer bg-amber-500/90 border-2 border-amber-200 text-sm font-display font-bold text-slate-950 active:scale-95 shadow-lg"
        >
          FIRE
        </button>
      </div>
    </div>
  );
}
