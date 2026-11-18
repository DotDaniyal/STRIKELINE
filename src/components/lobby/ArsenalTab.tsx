import { useRef, useState } from 'react';
import { Check, Eye, RotateCw, Shield, Sparkles } from 'lucide-react';
import type { LoadoutConfig, UserProfile, WeaponId } from '../../../shared/types/game.ts';
import { PRIMARY_WEAPONS, SECONDARY_WEAPONS, WEAPONS } from '../../../shared/constants/weapons.ts';
import { COSMETIC_CATALOG } from '../../../shared/constants/catalog.ts';
import { api } from '../../services/api.ts';
import { audioEngine } from '../../game/audio/AudioEngine.ts';
import type { LobbyFocusMode } from '../../game/engine/LobbyScene.ts';
import { TacticalPanel } from '../ui/TacticalPanel.tsx';
import { TacticalButton } from '../ui/TacticalButton.tsx';
import { StatBar } from '../ui/StatBar.tsx';

interface Props {
  profile: UserProfile;
  onProfileUpdated: (next: UserProfile) => void;
  onPreviewChange: (weaponId: WeaponId, weaponSkin: string, operatorSkin: string) => void;
  onRotateShowcase?: (deltaRad: number) => void;
  onFocusStage?: (mode: LobbyFocusMode) => void;
}

export function ArsenalTab({
  profile,
  onProfileUpdated,
  onPreviewChange,
  onRotateShowcase,
  onFocusStage,
}: Props) {
  const [loadouts, setLoadouts] = useState<LoadoutConfig[]>(() =>
    JSON.parse(JSON.stringify(profile.loadouts))
  );
  const [activeId, setActiveId] = useState(profile.activeLoadoutId);
  const [inspectSlot, setInspectSlot] = useState<'primary' | 'secondary'>('primary');
  const [stageMode, setStageMode] = useState<'arsenal' | 'operator'>('arsenal');
  const [equippedOperator, setEquippedOperator] = useState(profile.equippedOperator);
  const [equippedSpray, setEquippedSpray] = useState(profile.equippedSpray);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);

  const activeLoadout = loadouts.find((l) => l.id === activeId) ?? loadouts[0];
  const inspectedWeaponId =
    inspectSlot === 'primary' ? activeLoadout.primaryWeapon : activeLoadout.secondaryWeapon;
  const inspectedCfg = WEAPONS[inspectedWeaponId];

  const ownedWeaponSkins = COSMETIC_CATALOG.filter(
    (c) => c.category === 'weapon_skin' && profile.inventory.includes(c.id)
  );
  const ownedOperators = COSMETIC_CATALOG.filter(
    (c) => c.category === 'operator_skin' && profile.inventory.includes(c.id)
  );
  const ownedSprays = COSMETIC_CATALOG.filter(
    (c) => c.category === 'spray' && profile.inventory.includes(c.id)
  );

  const updateActive = (patch: Partial<LoadoutConfig>, slotOverride?: 'primary' | 'secondary') => {
    const next = loadouts.map((l) => (l.id === activeLoadout.id ? { ...l, ...patch } : l));
    setLoadouts(next);
    const updated = next.find((l) => l.id === activeLoadout.id)!;
    const slot = slotOverride ?? inspectSlot;
    const wId = slot === 'primary' ? updated.primaryWeapon : updated.secondaryWeapon;
    const skin = updated.weaponSkins[wId] ?? 'skin_standard_matte';
    onPreviewChange(wId, skin, equippedOperator);
  };

  const handleSave = async () => {
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

  const currentSkin = activeLoadout.weaponSkins[inspectedWeaponId] ?? 'skin_standard_matte';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
      {/* Left: Loadout Slots & Weapons */}
      <div className="lg:col-span-7 space-y-4">
        <TacticalPanel accent="amber">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {loadouts.map((l) => (
                <TacticalButton
                  key={l.id}
                  variant={l.id === activeId ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => {
                    setActiveId(l.id);
                    const wId = inspectSlot === 'primary' ? l.primaryWeapon : l.secondaryWeapon;
                    onPreviewChange(
                      wId,
                      l.weaponSkins[wId] ?? 'skin_standard_matte',
                      equippedOperator
                    );
                  }}
                >
                  {l.name}
                </TacticalButton>
              ))}
            </div>
            <TacticalButton variant="primary" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Loadout'}
            </TacticalButton>
          </div>
          {savedNotice && (
            <div className="text-xs text-emerald-400 font-medium mt-2.5">{savedNotice}</div>
          )}
        </TacticalPanel>

        {/* Primary Weapons */}
        <TacticalPanel
          title="Primary Armament"
          action={
            <span className="text-[11px] font-mono-tabular text-slate-400">
              Slot 1 · Select to equip
            </span>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {PRIMARY_WEAPONS.map((w) => {
              const selected = activeLoadout.primaryWeapon === w.id;
              const inspecting = selected && inspectSlot === 'primary';
              return (
                <button
                  key={w.id}
                  type="button"
                  onMouseEnter={() => {
                    if (!selected) audioEngine.playUiHover();
                  }}
                  onClick={() => {
                    audioEngine.playUiClick(690);
                    setInspectSlot('primary');
                    updateActive({ primaryWeapon: w.id }, 'primary');
                  }}
                  className={`text-left p-3 border sl-chamfer-sm cursor-pointer transition ${
                    inspecting
                      ? 'bg-amber-500/16 border-amber-500 text-white'
                      : selected
                      ? 'bg-amber-500/8 border-amber-500/60 text-white'
                      : 'bg-[#07090e] border-slate-800 hover:border-slate-600 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-bold text-sm uppercase">{w.name}</span>
                    <span className="text-[10px] font-mono-tabular px-1.5 py-0.5 bg-slate-800 text-amber-300 uppercase shrink-0">
                      {w.category}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{w.description}</p>
                  <div className="mt-2 flex items-center gap-3 text-[10px] font-mono-tabular text-slate-400">
                    <span>DMG {w.damageBody}/{w.damageHead}</span>
                    <span>RPM {w.rpm}</span>
                    <span>MAG {w.magSize}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </TacticalPanel>

        {/* Secondary Sidearm */}
        <TacticalPanel title="Secondary Sidearm" subtitle="Slot 2 · Click to customize finish">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {SECONDARY_WEAPONS.map((w) => {
              const selected = activeLoadout.secondaryWeapon === w.id;
              const inspecting = selected && inspectSlot === 'secondary';
              return (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => {
                    audioEngine.playUiClick(690);
                    setInspectSlot('secondary');
                    updateActive({ secondaryWeapon: w.id }, 'secondary');
                  }}
                  className={`text-left p-3 border sl-chamfer-sm cursor-pointer transition ${
                    inspecting
                      ? 'bg-amber-500/16 border-amber-500 text-white'
                      : 'bg-[#07090e] border-slate-800 hover:border-slate-600 text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold text-sm uppercase">{w.name}</span>
                    <span className="text-[10px] font-mono-tabular text-amber-300">{w.code}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">{w.description}</p>
                </button>
              );
            })}
          </div>
        </TacticalPanel>
      </div>

      {/* Right: Interactive 3D Stage Window + Ballistics Readout + Cosmetics */}
      <div className="lg:col-span-5 space-y-4">
        {/* Interactive 3D Inspection Viewport Window */}
        <div
          onPointerDown={(e) => {
            draggingRef.current = true;
            lastXRef.current = e.clientX;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!draggingRef.current) return;
            const dx = e.clientX - lastXRef.current;
            lastXRef.current = e.clientX;
            onRotateShowcase?.(dx * 0.012);
          }}
          onPointerUp={() => {
            draggingRef.current = false;
          }}
          className="relative h-44 border border-slate-700/80 sl-chamfer overflow-hidden cursor-grab active:cursor-grabbing flex flex-col justify-between p-3"
          style={{ background: 'rgba(7, 9, 14, 0.14)' }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-[#07090e]/85 border border-slate-800 text-[10px] font-mono-tabular uppercase text-amber-300">
              <RotateCw className="w-3 h-3" /> Drag to Rotate 3D Model
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  audioEngine.playUiClick(660);
                  setStageMode('arsenal');
                  onFocusStage?.('arsenal');
                }}
                className={`px-2 py-1 text-[10px] font-mono-tabular uppercase cursor-pointer border ${
                  stageMode === 'arsenal'
                    ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                    : 'bg-[#07090e]/85 text-slate-300 border-slate-700'
                }`}
              >
                Weapon
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  audioEngine.playUiClick(660);
                  setStageMode('operator');
                  onFocusStage?.('operator');
                }}
                className={`px-2 py-1 text-[10px] font-mono-tabular uppercase cursor-pointer border ${
                  stageMode === 'operator'
                    ? 'bg-sky-500 text-slate-950 border-sky-400 font-bold'
                    : 'bg-[#07090e]/85 text-slate-300 border-slate-700'
                }`}
              >
                <Eye className="w-3 h-3 inline mr-1" />
                Operator
              </button>
            </div>
          </div>

          <div className="flex items-end justify-between text-[11px] font-mono-tabular text-slate-300">
            <span className="px-2 py-0.5 bg-[#07090e]/85 border border-slate-800 uppercase">
              Inspecting: {inspectedCfg.name}
            </span>
          </div>
        </div>

        {/* Ballistics Telemetry */}
        <TacticalPanel
          eyebrow={`${inspectedCfg.code} · ${inspectedCfg.fireMode}`}
          title={inspectedCfg.name}
          action={
            <span className="text-xs font-mono-tabular text-slate-400">
              Reload {inspectedCfg.reloadTimeSec}s
            </span>
          }
        >
          <div className="space-y-3">
            <StatBar
              label="Impact Damage"
              value={Math.min(100, (inspectedCfg.damageBody * inspectedCfg.pellets) / 1.3)}
              tone="amber"
            />
            <StatBar
              label="Fire Cadence"
              value={Math.min(100, inspectedCfg.rpm / 9)}
              tone="cyan"
            />
            <StatBar
              label="Effective Range"
              value={Math.min(100, inspectedCfg.rangeFalloffEnd / 1.4)}
              tone="emerald"
            />
            <StatBar
              label="Mobility"
              value={Math.min(100, (inspectedCfg.moveSpeedMultiplier - 0.8) * 320)}
              tone="amber"
            />
          </div>
        </TacticalPanel>

        {/* Weapon Skins */}
        <TacticalPanel
          title={`Weapon Finishes (${inspectedCfg.code})`}
          action={<Sparkles className="w-4 h-4 text-amber-400" />}
        >
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
                      weaponSkins: { ...activeLoadout.weaponSkins, [inspectedWeaponId]: sk.id },
                    });
                  }}
                  className={`flex items-center gap-2 p-2.5 border sl-chamfer-sm text-left cursor-pointer transition ${
                    eq
                      ? 'border-amber-500 bg-amber-500/15 text-white'
                      : 'border-slate-800 bg-[#07090e] text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <span
                    className="w-5 h-5 border border-white/20 shrink-0"
                    style={{ background: sk.previewColor }}
                  />
                  <span className="text-xs font-semibold truncate flex-1">{sk.name}</span>
                  {eq && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                </button>
              );
            })}
          </div>
        </TacticalPanel>

        {/* Operator Armor & Spray */}
        <TacticalPanel
          title="Operator Armor & Spray"
          action={<Shield className="w-4 h-4 text-sky-400" />}
        >
          <div className="space-y-3">
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
                      onPreviewChange(inspectedWeaponId, currentSkin, op.id);
                    }}
                    className={`flex items-center gap-2 p-2.5 border sl-chamfer-sm text-left cursor-pointer ${
                      eq
                        ? 'border-sky-500 bg-sky-500/15 text-white'
                        : 'border-slate-800 bg-[#07090e] text-slate-300'
                    }`}
                  >
                    <span className="w-4 h-4 shrink-0 border border-white/20" style={{ background: op.previewColor }} />
                    <span className="text-xs font-semibold truncate flex-1">{op.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="pt-2.5 border-t border-slate-800">
              <div className="text-[11px] font-mono-tabular uppercase text-slate-400 mb-1.5">
                Tactical Wall Spray (Press T in-game)
              </div>
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
                      className={`px-3 py-1.5 border sl-chamfer-sm text-xs font-semibold cursor-pointer ${
                        eq
                          ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                          : 'border-slate-800 bg-[#07090e] text-slate-300'
                      }`}
                    >
                      {sp.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </TacticalPanel>
      </div>
    </div>
  );
}
