import { useState } from 'react';
import { Check, Shield, Sparkles } from 'lucide-react';
import type { LoadoutConfig, UserProfile, WeaponId } from '../../../shared/types/game.ts';
import { PRIMARY_WEAPONS, SECONDARY_WEAPONS, WEAPONS } from '../../../shared/constants/weapons.ts';
import { COSMETIC_CATALOG } from '../../../shared/constants/catalog.ts';
import { api } from '../../services/api.ts';
import { audioEngine } from '../../game/audio/AudioEngine.ts';

interface Props {
  profile: UserProfile;
  onProfileUpdated: (next: UserProfile) => void;
  onPreviewChange: (weaponId: WeaponId, weaponSkin: string, operatorSkin: string) => void;
}

export function ArsenalTab({ profile, onProfileUpdated, onPreviewChange }: Props) {
  const [loadouts, setLoadouts] = useState<LoadoutConfig[]>(() =>
    JSON.parse(JSON.stringify(profile.loadouts))
  );
  const [activeId, setActiveId] = useState(profile.activeLoadoutId);
  const [equippedOperator, setEquippedOperator] = useState(profile.equippedOperator);
  const [equippedSpray, setEquippedSpray] = useState(profile.equippedSpray);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const activeLoadout = loadouts.find((l) => l.id === activeId) ?? loadouts[0];
  const primaryCfg = WEAPONS[activeLoadout.primaryWeapon];

  const ownedWeaponSkins = COSMETIC_CATALOG.filter(
    (c) => c.category === 'weapon_skin' && profile.inventory.includes(c.id)
  );
  const ownedOperators = COSMETIC_CATALOG.filter(
    (c) => c.category === 'operator_skin' && profile.inventory.includes(c.id)
  );
  const ownedSprays = COSMETIC_CATALOG.filter(
    (c) => c.category === 'spray' && profile.inventory.includes(c.id)
  );

  const updateActive = (patch: Partial<LoadoutConfig>) => {
    const next = loadouts.map((l) => (l.id === activeLoadout.id ? { ...l, ...patch } : l));
    setLoadouts(next);
    const updated = next.find((l) => l.id === activeLoadout.id)!;
    const wId = updated.primaryWeapon;
    const skin = updated.weaponSkins[wId] ?? 'skin_standard_matte';
    onPreviewChange(wId, skin, equippedOperator);
  };

  const handleSave = async () => {
    audioEngine.playUiClick(780);
    setSaving(true);
    setSavedNotice(null);
    try {
      const res = await api.saveLoadouts(loadouts, activeId, equippedOperator, equippedSpray);
      onProfileUpdated(res.profile);
      setSavedNotice('Loadout synchronized with combat servers.');
      setTimeout(() => setSavedNotice(null), 3000);
    } catch (err: unknown) {
      setSavedNotice(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const currentSkin = activeLoadout.weaponSkins[activeLoadout.primaryWeapon] ?? 'skin_standard_matte';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left: Loadout Slots & Weapons */}
      <div className="lg:col-span-7 space-y-4">
        <div className="bg-[#0e131c]/95 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {loadouts.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    audioEngine.playUiClick(660);
                    setActiveId(l.id);
                    onPreviewChange(
                      l.primaryWeapon,
                      l.weaponSkins[l.primaryWeapon] ?? 'skin_standard_matte',
                      equippedOperator
                    );
                  }}
                  className={`px-3.5 py-2 rounded-lg text-xs font-display font-bold uppercase tracking-wider border cursor-pointer whitespace-nowrap shrink-0 transition ${
                    l.id === activeId
                      ? 'bg-amber-500 text-slate-950 border-amber-500'
                      : 'bg-[#090d14] text-slate-300 border-slate-700 hover:border-slate-500'
                  }`}
                >
                  {l.name}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-bold text-xs uppercase tracking-wider cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              {saving ? 'Saving...' : 'Save Loadout'}
            </button>
          </div>
          {savedNotice && <div className="text-xs text-emerald-400 font-medium">{savedNotice}</div>}
        </div>

        {/* Primary Weapons */}
        <div className="bg-[#0e131c]/95 border border-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-slate-200">
            Primary Armament
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PRIMARY_WEAPONS.map((w) => {
              const selected = activeLoadout.primaryWeapon === w.id;
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => {
                    audioEngine.playUiClick(690);
                    updateActive({ primaryWeapon: w.id });
                  }}
                  className={`text-left p-3 rounded-lg border cursor-pointer transition ${
                    selected
                      ? 'bg-amber-500/15 border-amber-500 text-white'
                      : 'bg-[#090d14] border-slate-800 hover:border-slate-600 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold text-sm">{w.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 uppercase">
                      {w.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{w.description}</p>
                  <div className="mt-2 flex items-center gap-3 text-[10px] font-mono text-slate-400 tabular-nums">
                    <span>DMG {w.damageBody}/{w.damageHead}</span>
                    <span>RPM {w.rpm}</span>
                    <span>MAG {w.magSize}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Secondary Weapon */}
        <div className="bg-[#0e131c]/95 border border-slate-800 rounded-xl p-4 space-y-2.5">
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-slate-200">
            Secondary Sidearm
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {SECONDARY_WEAPONS.map((w) => (
              <div
                key={w.id}
                className="p-3 rounded-lg border bg-amber-500/10 border-amber-500/60 text-white"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-sm">{w.name}</span>
                  <span className="text-[10px] font-mono text-amber-300">{w.code}</span>
                </div>
                <p className="text-[11px] text-slate-300 mt-1">{w.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Ballistics Readout + Cosmetics */}
      <div className="lg:col-span-5 space-y-4">
        {/* Ballistics Telemetry */}
        <div className="bg-[#0e131c]/95 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[10px] font-mono uppercase text-amber-400">{primaryCfg.code} · {primaryCfg.fireMode}</div>
              <h3 className="font-display text-lg font-bold text-white">{primaryCfg.name}</h3>
            </div>
            <span className="text-xs font-mono text-slate-400 tabular-nums">
              Reload {primaryCfg.reloadTimeSec}s
            </span>
          </div>

          <div className="space-y-2 text-xs">
            {[
              ['Impact Damage', Math.min(100, (primaryCfg.damageBody * primaryCfg.pellets) / 1.3)],
              ['Fire Cadence', Math.min(100, primaryCfg.rpm / 9)],
              ['Effective Range', Math.min(100, primaryCfg.rangeFalloffEnd / 1.4)],
              ['Mobility', Math.min(100, (primaryCfg.moveSpeedMultiplier - 0.8) * 320)],
            ].map(([label, pct]) => (
              <div key={String(label)} className="space-y-1">
                <div className="flex justify-between text-slate-300">
                  <span>{label}</span>
                  <span className="font-mono tabular-nums">{Math.round(Number(pct))}</span>
                </div>
                <div className="h-1.5 bg-[#090d14] rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Weapon Skins */}
        <div className="bg-[#0e131c]/95 border border-slate-800 rounded-xl p-4 space-y-2.5">
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Owned Weapon Finishes
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {ownedWeaponSkins.map((sk) => {
              const eq = currentSkin === sk.id;
              return (
                <button
                  key={sk.id}
                  type="button"
                  onClick={() => {
                    audioEngine.playUiClick(720);
                    updateActive({
                      weaponSkins: { ...activeLoadout.weaponSkins, [activeLoadout.primaryWeapon]: sk.id },
                    });
                  }}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-left cursor-pointer transition ${
                    eq ? 'border-amber-500 bg-amber-500/15 text-white' : 'border-slate-800 bg-[#090d14] text-slate-300'
                  }`}
                >
                  <span
                    className="w-5 h-5 rounded border border-white/20 shrink-0"
                    style={{ background: sk.previewColor }}
                  />
                  <span className="text-xs font-semibold truncate flex-1">{sk.name}</span>
                  {eq && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Operator Suit & Spray */}
        <div className="bg-[#0e131c]/95 border border-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="font-display text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-sky-400" /> Operator Armor & Spray
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {ownedOperators.map((op) => {
              const eq = equippedOperator === op.id;
              return (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => {
                    audioEngine.playUiClick(710);
                    setEquippedOperator(op.id);
                    onPreviewChange(activeLoadout.primaryWeapon, currentSkin, op.id);
                  }}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-left cursor-pointer ${
                    eq ? 'border-sky-500 bg-sky-500/15 text-white' : 'border-slate-800 bg-[#090d14] text-slate-300'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full shrink-0" style={{ background: op.previewColor }} />
                  <span className="text-xs font-semibold truncate flex-1">{op.name}</span>
                </button>
              );
            })}
          </div>

          <div className="pt-2 border-t border-slate-800">
            <div className="text-[11px] text-slate-400 mb-1.5">Tactical Wall Spray (Press T in-game)</div>
            <div className="flex flex-wrap gap-2">
              {ownedSprays.map((sp) => {
                const eq = equippedSpray === sp.id;
                return (
                  <button
                    key={sp.id}
                    type="button"
                    onClick={() => {
                      audioEngine.playUiClick(690);
                      setEquippedSpray(sp.id);
                    }}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                      eq ? 'border-amber-500 bg-amber-500/15 text-amber-300' : 'border-slate-800 bg-[#090d14] text-slate-300'
                    }`}
                  >
                    {sp.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
