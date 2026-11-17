import type { CrosshairSettings } from '../../shared/types/game.ts';

interface Props {
  config: CrosshairSettings;
  spreadRad?: number;
  isAds?: boolean;
  isSniper?: boolean;
  hitmarker?: { active: boolean; headshot: boolean };
}

export function CrosshairView({ config, spreadRad = 0.02, isAds = false, isSniper = false, hitmarker }: Props) {
  // Sniper scope vignette when ADS
  if (isSniper && isAds) {
    return (
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center z-20">
        <div className="relative w-full h-full flex items-center justify-center">
          <svg className="w-[460px] h-[460px] max-w-[85vw] max-h-[85vh]" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="92" fill="none" stroke="#0b0e14" strokeWidth="18" />
            <circle cx="100" cy="100" r="83" fill="none" stroke="rgba(245,158,11,0.55)" strokeWidth="1" />
            <line x1="16" y1="100" x2="184" y2="100" stroke="rgba(15,23,42,0.9)" strokeWidth="0.9" />
            <line x1="100" y1="16" x2="100" y2="184" stroke="rgba(15,23,42,0.9)" strokeWidth="0.9" />
            <circle cx="100" cy="100" r="2.2" fill="#ef4444" />
            {/* Mildot ticks */}
            {[-40, -25, -12, 12, 25, 40].map((off) => (
              <g key={off}>
                <line x1={100 + off} y1="97" x2={100 + off} y2="103" stroke="#0f172a" strokeWidth="0.8" />
                <line x1="97" y1={100 + off} x2="103" y2={100 + off} stroke="#0f172a" strokeWidth="0.8" />
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  }

  const dynamicGap = config.dynamicSpread ? Math.round(spreadRad * 320) : 0;
  const gap = config.gap + dynamicGap;
  const size = config.size;
  const thick = config.thickness;
  const shadow = config.outline ? '0 0 0 1px rgba(0,0,0,0.85)' : 'none';

  return (
    <div
      className="pointer-events-none fixed inset-0 flex items-center justify-center z-20"
      style={{ opacity: config.opacity }}
    >
      <div className="relative w-0 h-0">
        {config.style !== 'dot' && (
          <>
            {/* Top arm (omitted for T-shape) */}
            {config.style !== 't-shape' && (
              <div
                style={{
                  position: 'absolute',
                  left: -thick / 2,
                  bottom: gap,
                  width: thick,
                  height: size,
                  backgroundColor: config.color,
                  boxShadow: shadow,
                }}
              />
            )}
            {/* Bottom arm */}
            <div
              style={{
                position: 'absolute',
                left: -thick / 2,
                top: gap,
                width: thick,
                height: size,
                backgroundColor: config.color,
                boxShadow: shadow,
              }}
            />
            {/* Left arm */}
            <div
              style={{
                position: 'absolute',
                right: gap,
                top: -thick / 2,
                width: size,
                height: thick,
                backgroundColor: config.color,
                boxShadow: shadow,
              }}
            />
            {/* Right arm */}
            <div
              style={{
                position: 'absolute',
                left: gap,
                top: -thick / 2,
                width: size,
                height: thick,
                backgroundColor: config.color,
                boxShadow: shadow,
              }}
            />
          </>
        )}

        {config.style === 'circle-dot' && (
          <div
            style={{
              position: 'absolute',
              left: -(gap + size),
              top: -(gap + size),
              width: (gap + size) * 2,
              height: (gap + size) * 2,
              borderRadius: '9999px',
              border: `${Math.max(1, thick * 0.75)}px solid ${config.color}`,
              boxShadow: shadow,
            }}
          />
        )}

        {(config.centerDot || config.style === 'dot') && (
          <div
            style={{
              position: 'absolute',
              left: -Math.max(1.5, thick / 2),
              top: -Math.max(1.5, thick / 2),
              width: Math.max(3, thick),
              height: Math.max(3, thick),
              borderRadius: '9999px',
              backgroundColor: config.color,
              boxShadow: shadow,
            }}
          />
        )}

        {/* Hitmarker Feedback X */}
        {hitmarker?.active && (
          <svg
            className="absolute -translate-x-1/2 -translate-y-1/2"
            width="32"
            height="32"
            viewBox="0 0 32 32"
          >
            <g stroke={hitmarker.headshot ? '#ef4444' : '#f8fafc'} strokeWidth="2.2" strokeLinecap="round">
              <line x1="6" y1="6" x2="12" y2="12" />
              <line x1="26" y1="6" x2="20" y2="12" />
              <line x1="6" y1="26" x2="12" y2="20" />
              <line x1="26" y1="26" x2="20" y2="20" />
            </g>
          </svg>
        )}
      </div>
    </div>
  );
}
