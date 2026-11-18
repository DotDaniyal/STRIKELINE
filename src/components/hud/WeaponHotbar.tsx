import type { WeaponId } from '../../../shared/types/game.ts';
import { WEAPONS } from '../../../shared/constants/weapons.ts';

interface Props {
  primaryWeapon: WeaponId;
  secondaryWeapon: WeaponId;
  activeWeapon: WeaponId;
  onSelectSlot?: (slot: 1 | 2) => void;
}

export function WeaponHotbar({
  primaryWeapon,
  secondaryWeapon,
  activeWeapon,
  onSelectSlot,
}: Props) {
  const slots: Array<{ slot: 1 | 2; weaponId: WeaponId; label: string }> = [
    { slot: 1, weaponId: primaryWeapon, label: 'PRIMARY' },
    { slot: 2, weaponId: secondaryWeapon, label: 'SIDEARM' },
  ];

  return (
    <div className="flex items-center gap-1.5 justify-end">
      {slots.map(({ slot, weaponId, label }) => {
        const w = WEAPONS[weaponId];
        const active = activeWeapon === weaponId;
        return (
          <button
            key={slot}
            type="button"
            onClick={() => onSelectSlot?.(slot)}
            className={`pointer-events-auto flex items-center gap-2 px-2.5 py-1.5 border text-left transition-all sl-chamfer-sm cursor-pointer ${
              active
                ? 'bg-amber-500/18 border-amber-500 text-white'
                : 'bg-[#07090e]/80 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span
              className={`font-mono-tabular text-[10px] font-bold px-1 ${
                active ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'
              }`}
            >
              {slot}
            </span>
            <div className="leading-tight">
              <div className="font-display text-[11px] font-bold uppercase tracking-wider">
                {w.code}
              </div>
              <div className="text-[9px] font-mono-tabular opacity-75">{label}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
