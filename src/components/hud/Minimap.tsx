import { useMemo } from 'react';
import type {
  FlagRuntimeState,
  MapId,
  ObjectiveRuntimeState,
  PlayerSettings,
  PlayerSnapshot,
  TeamId,
  Vec3,
} from '../../../shared/types/game.ts';
import { MAPS } from '../../../shared/maps/index.ts';
import { getTeamPalette } from '../../utils/theme.ts';

interface Props {
  mapId: MapId;
  localId: string;
  localTeam: TeamId;
  localPos: Vec3;
  localYaw: number;
  players: PlayerSnapshot[];
  objectives: ObjectiveRuntimeState[];
  flags: FlagRuntimeState[];
  colorblindMode: PlayerSettings['colorblindMode'];
}

export function Minimap({
  mapId,
  localId,
  localTeam,
  localPos,
  localYaw,
  players,
  objectives,
  flags,
  colorblindMode,
}: Props) {
  const map = MAPS[mapId];
  const palette = getTeamPalette(colorblindMode);
  if (!map) return null;

  const rangeMeters = 32;
  const radius = 56;
  const cx = 64;
  const cy = 64;
  const scale = radius / rangeMeters;

  const staticGeometry = useMemo(() => {
    if (!map) return null;
    return (
      <>
        <rect
          x={map.bounds.minX}
          y={map.bounds.minZ}
          width={map.bounds.maxX - map.bounds.minX}
          height={map.bounds.maxZ - map.bounds.minZ}
          fill="rgba(30, 41, 59, 0.25)"
          stroke="rgba(148, 163, 184, 0.35)"
          strokeWidth={1 / scale}
        />
        {map.ramps.map((r) => (
          <rect
            key={r.id}
            x={r.x - r.width / 2}
            y={r.z - r.length / 2}
            width={r.width}
            height={r.length}
            fill="rgba(245, 158, 11, 0.16)"
            stroke="rgba(245, 158, 11, 0.3)"
            strokeWidth={0.6 / scale}
          />
        ))}
        {map.colliders
          .filter((c) => !c.decorativeOnly)
          .map((c) => (
            <rect
              key={c.id}
              x={c.min.x}
              y={c.min.z}
              width={Math.max(0.2, c.max.x - c.min.x)}
              height={Math.max(0.2, c.max.z - c.min.z)}
              fill="rgba(148, 163, 184, 0.32)"
            />
          ))}
      </>
    );
  }, [map, scale]);

  // Player looks along (-sin(yaw), -cos(yaw)) in Three.js YXZ euler
  const cosY = Math.cos(localYaw);
  const sinY = Math.sin(localYaw);

  const toRadar = (wx: number, wz: number) => {
    const dx = wx - localPos.x;
    const dz = wz - localPos.z;
    // Rotate world delta so forward (-sinY, -cosY) points UP (0, -1)
    const rx = dx * cosY - dz * sinY;
    const ry = dx * sinY + dz * cosY;
    return {
      x: cx + rx * scale,
      y: cy + ry * scale,
    };
  };

  // North indicator position on radar edge
  const northDir = {
    x: cx + sinY * (radius - 6),
    y: cy - cosY * (radius - 6),
  };

  return (
    <div
      className="relative w-28 h-28 sm:w-32 sm:h-32 bg-[#07090e]/85 border border-slate-700/80 sl-chamfer-sm overflow-hidden shadow-lg"
      aria-label="Tactical Minimap"
    >
      <svg viewBox="0 0 128 128" className="w-full h-full">
        <defs>
          <clipPath id="sl-radar-clip">
            <rect x="4" y="4" width="120" height="120" />
          </clipPath>
        </defs>

        {/* Subtle range rings */}
        <circle cx={cx} cy={cy} r={radius * 0.45} fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="0.8" />
        <circle cx={cx} cy={cy} r={radius * 0.9} fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="0.8" />

        <g clipPath="url(#sl-radar-clip)">
          {/* Rotated map geometry */}
          <g transform={`translate(${cx}, ${cy}) rotate(${(localYaw * 180) / Math.PI}) scale(${scale}) translate(${-localPos.x}, ${-localPos.z})`}>
            {staticGeometry}
          </g>

          {/* Vision Cone */}
          <polygon
            points={`${cx},${cy} ${cx - 24},${cy - 44} ${cx + 24},${cy - 44}`}
            fill="rgba(245, 158, 11, 0.12)"
          />

          {/* Objectives */}
          {objectives
            .filter((o) => o.active)
            .map((o) => {
              const pt = toRadar(o.x, o.z);
              const col =
                o.owner === 'alpha'
                  ? palette.alphaHex
                  : o.owner === 'bravo'
                  ? palette.bravoHex
                  : palette.neutralHex;
              return (
                <g key={o.id} transform={`translate(${pt.x}, ${pt.y})`}>
                  <rect
                    x="-4.5"
                    y="-4.5"
                    width="9"
                    height="9"
                    transform="rotate(45)"
                    fill="rgba(7,9,14,0.8)"
                    stroke={col}
                    strokeWidth="1.5"
                  />
                </g>
              );
            })}

          {/* Flags */}
          {flags.map((f) => {
            const pt = toRadar(f.x, f.z);
            const col = f.team === 'alpha' ? palette.alphaHex : palette.bravoHex;
            return (
              <circle
                key={f.team}
                cx={pt.x}
                cy={pt.y}
                r="3.8"
                fill="none"
                stroke={col}
                strokeWidth="1.8"
              />
            );
          })}

          {/* Teammates (never leaks enemy positions without radar reveal) */}
          {players
            .filter(
              (p) =>
                p.id !== localId &&
                p.alive &&
                localTeam !== 'none' &&
                p.team === localTeam
            )
            .map((p) => {
              const pt = toRadar(p.x, p.z);
              return (
                <circle
                  key={p.id}
                  cx={Math.max(8, Math.min(120, pt.x))}
                  cy={Math.max(8, Math.min(120, pt.y))}
                  r="3"
                  fill={localTeam === 'alpha' ? palette.alphaHex : palette.bravoHex}
                  stroke="#07090e"
                  strokeWidth="1"
                />
              );
            })}

          {/* Local Player Chevron */}
          <polygon
            points={`${cx},${cy - 5} ${cx - 4},${cy + 4} ${cx},${cy + 2} ${cx + 4},${cy + 4}`}
            fill="#f59e0b"
            stroke="#07090e"
            strokeWidth="0.9"
          />
        </g>

        {/* North Marker */}
        <text
          x={northDir.x}
          y={northDir.y}
          textAnchor="middle"
          dominantBaseline="central"
          fill="#94a3b8"
          fontSize="7"
          fontFamily="JetBrains Mono, monospace"
          fontWeight="bold"
        >
          N
        </text>
      </svg>

      <div className="absolute bottom-1 right-1.5 text-[9px] font-mono-tabular uppercase text-slate-400">
        {map.name}
      </div>
    </div>
  );
}
