import { useState } from 'react';
import type { KeyBindings, PlayerSettings } from '../../shared/types/game.ts';
import { DEFAULT_SETTINGS } from '../../shared/constants/modes.ts';
import { CrosshairView } from './hud/CrosshairView.tsx';
import { audioEngine } from '../game/audio/AudioEngine.ts';
import { ModalShell } from './ui/ModalShell.tsx';
import { SegmentedControl } from './ui/SegmentedControl.tsx';
import { TacticalButton } from './ui/TacticalButton.tsx';

interface Props {
  settings: PlayerSettings;
  onSave: (next: PlayerSettings) => void;
  onClose: () => void;
  onReplayIntro?: () => void;
}

const SETTINGS_TABS = [
  { id: 'controls', label: 'Controls' },
  { id: 'crosshair', label: 'Crosshair' },
  { id: 'graphics', label: 'Graphics' },
  { id: 'audio', label: 'Audio' },
  { id: 'access', label: 'Accessibility' },
] as const;

export function SettingsModal({ settings, onSave, onClose, onReplayIntro }: Props) {
  const [draft, setDraft] = useState<PlayerSettings>(() => JSON.parse(JSON.stringify(settings)));
  const [tab, setTab] = useState<'controls' | 'crosshair' | 'graphics' | 'audio' | 'access'>('controls');
  const [rebindingKey, setRebindingKey] = useState<keyof KeyBindings | null>(null);

  const applyPreset = (preset: PlayerSettings['graphicsPreset']) => {
    audioEngine.playUiClick(660);
    const map: Record<PlayerSettings['graphicsPreset'], Partial<PlayerSettings>> = {
      low: { graphicsPreset: 'low', renderScale: 0.75, shadows: false, bloom: false, showTracers: true },
      medium: { graphicsPreset: 'medium', renderScale: 0.9, shadows: true, bloom: false, showTracers: true },
      high: { graphicsPreset: 'high', renderScale: 1.0, shadows: true, bloom: true, showTracers: true },
      ultra: { graphicsPreset: 'ultra', renderScale: 1.0, shadows: true, bloom: true, showTracers: true },
    };
    setDraft({ ...draft, ...map[preset] });
  };

  const handleSave = () => {
    onSave(draft);
    onClose();
  };

  return (
    <div
      onKeyDown={(e) => {
        if (rebindingKey) {
          e.preventDefault();
          e.stopPropagation();
          setDraft({
            ...draft,
            keybinds: { ...draft.keybinds, [rebindingKey]: e.code },
          });
          setRebindingKey(null);
        }
      }}
    >
      <ModalShell
        title="Settings & Crosshair Studio"
        subtitle="Calibrate input curves, reticle geometry, post-processing bloom, and audio mix"
        maxWidthClass="max-w-4xl"
        onClose={onClose}
        footer={
          <>
            <TacticalButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setDraft(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)))}
            >
              Reset Defaults
            </TacticalButton>
            <div className="flex items-center gap-2.5">
              <TacticalButton type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </TacticalButton>
              <TacticalButton type="button" variant="primary" size="md" onClick={handleSave}>
                Save Settings
              </TacticalButton>
            </div>
          </>
        }
      >
        <div className="space-y-5">
          <SegmentedControl
            layoutId="settings-tabs"
            options={SETTINGS_TABS}
            value={tab}
            onChange={setTab}
            size="sm"
          />

          {tab === 'controls' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-display text-xs font-bold uppercase tracking-wider text-amber-400">
                  Mouse &amp; Aim Response
                </h3>
                <SliderField
                  label="Mouse Sensitivity"
                  value={draft.sensitivity}
                  min={0.2}
                  max={3.0}
                  step={0.05}
                  onChange={(v) => setDraft({ ...draft, sensitivity: v })}
                />
                <SliderField
                  label="ADS Sensitivity Multiplier"
                  value={draft.adsSensitivityMultiplier}
                  min={0.2}
                  max={1.5}
                  step={0.05}
                  onChange={(v) => setDraft({ ...draft, adsSensitivityMultiplier: v })}
                />
                <SliderField
                  label="Field of View (FOV)"
                  value={draft.fov}
                  min={68}
                  max={112}
                  step={1}
                  onChange={(v) => setDraft({ ...draft, fov: v })}
                />
                <SliderField
                  label="Gamepad Sensitivity"
                  value={draft.gamepadSensitivity}
                  min={0.3}
                  max={3.0}
                  step={0.1}
                  onChange={(v) => setDraft({ ...draft, gamepadSensitivity: v })}
                />
                <ToggleField
                  label="Invert Y-Axis"
                  checked={draft.invertY}
                  onChange={(c) => setDraft({ ...draft, invertY: c })}
                />
                <ToggleField
                  label="Camera Head Bob"
                  checked={draft.headBob}
                  onChange={(c) => setDraft({ ...draft, headBob: c })}
                />
              </div>

              <div className="space-y-2">
                <h3 className="font-display text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                  Key Bindings (Click to Rebind)
                </h3>
                {(Object.keys(draft.keybinds) as Array<keyof KeyBindings>).map((k) => (
                  <div
                    key={k}
                    className="flex items-center justify-between px-3 py-2 bg-[#07090e] border border-slate-800"
                  >
                    <span className="text-xs text-slate-300 capitalize">
                      {k.replace(/([A-Z])/g, ' $1')}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRebindingKey(k)}
                      className={`px-3 py-1 text-xs font-mono-tabular cursor-pointer sl-chamfer-sm ${
                        rebindingKey === k
                          ? 'bg-amber-500 text-slate-950 font-bold'
                          : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                      }`}
                    >
                      {rebindingKey === k ? 'Press Key...' : draft.keybinds[k]}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'crosshair' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-mono-tabular uppercase text-slate-400 mb-1.5">
                    Reticle Shape
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {(['classic', 'dot', 't-shape', 'circle-dot'] as const).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() =>
                          setDraft({ ...draft, crosshair: { ...draft.crosshair, style: st } })
                        }
                        className={`py-2 px-2 text-xs font-medium border cursor-pointer sl-chamfer-sm ${
                          draft.crosshair.style === st
                            ? 'bg-amber-500 text-slate-950 border-amber-400 font-semibold'
                            : 'bg-[#07090e] text-slate-300 border-slate-700'
                        }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-mono-tabular uppercase text-slate-400 mb-1.5">
                    Reticle Color
                  </label>
                  <div className="flex items-center gap-2">
                    {['#22d3ee', '#4ade80', '#f59e0b', '#ef4444', '#f8fafc', '#e879f9'].map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-label={`Color ${c}`}
                        onClick={() =>
                          setDraft({ ...draft, crosshair: { ...draft.crosshair, color: c } })
                        }
                        className={`w-7 h-7 border-2 cursor-pointer ${
                          draft.crosshair.color === c ? 'border-white scale-110' : 'border-slate-700'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                    <input
                      type="color"
                      value={draft.crosshair.color}
                      onChange={(e) =>
                        setDraft({ ...draft, crosshair: { ...draft.crosshair, color: e.target.value } })
                      }
                      className="w-8 h-7 bg-transparent cursor-pointer"
                    />
                  </div>
                </div>

                <SliderField
                  label="Arm Length"
                  value={draft.crosshair.size}
                  min={2}
                  max={20}
                  step={1}
                  onChange={(v) => setDraft({ ...draft, crosshair: { ...draft.crosshair, size: v } })}
                />
                <SliderField
                  label="Thickness"
                  value={draft.crosshair.thickness}
                  min={1}
                  max={6}
                  step={1}
                  onChange={(v) =>
                    setDraft({ ...draft, crosshair: { ...draft.crosshair, thickness: v } })
                  }
                />
                <SliderField
                  label="Center Gap"
                  value={draft.crosshair.gap}
                  min={0}
                  max={16}
                  step={1}
                  onChange={(v) => setDraft({ ...draft, crosshair: { ...draft.crosshair, gap: v } })}
                />
                <SliderField
                  label="Opacity"
                  value={draft.crosshair.opacity}
                  min={0.2}
                  max={1}
                  step={0.05}
                  onChange={(v) =>
                    setDraft({ ...draft, crosshair: { ...draft.crosshair, opacity: v } })
                  }
                />
                <ToggleField
                  label="Center Dot"
                  checked={draft.crosshair.centerDot}
                  onChange={(c) =>
                    setDraft({ ...draft, crosshair: { ...draft.crosshair, centerDot: c } })
                  }
                />
                <ToggleField
                  label="Contrast Outline"
                  checked={draft.crosshair.outline}
                  onChange={(c) =>
                    setDraft({ ...draft, crosshair: { ...draft.crosshair, outline: c } })
                  }
                />
                <ToggleField
                  label="Dynamic Spread Expansion"
                  checked={draft.crosshair.dynamicSpread}
                  onChange={(c) =>
                    setDraft({ ...draft, crosshair: { ...draft.crosshair, dynamicSpread: c } })
                  }
                />
              </div>

              <div className="relative sl-chamfer border border-slate-700 overflow-hidden bg-[#151c2a] sl-grid-bg min-h-[260px] flex items-center justify-center">
                <div className="absolute top-3 left-3 text-xs font-mono-tabular text-slate-300">
                  Live Contrast Preview
                </div>
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <div className="scale-150">
                    <CrosshairView config={draft.crosshair} spreadRad={0.01} inline />
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'graphics' && (
            <div className="space-y-4 max-w-xl">
              <div>
                <label className="block text-[11px] font-mono-tabular uppercase text-slate-400 mb-2">
                  Quality Preset
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(['low', 'medium', 'high', 'ultra'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => applyPreset(p)}
                      className={`py-2.5 text-xs font-display font-bold uppercase border cursor-pointer sl-chamfer-sm ${
                        draft.graphicsPreset === p
                          ? 'bg-amber-500 text-slate-950 border-amber-400'
                          : 'bg-[#07090e] text-slate-300 border-slate-700'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <SliderField
                label="Render Scale"
                value={draft.renderScale}
                min={0.6}
                max={1.0}
                step={0.05}
                onChange={(v) => setDraft({ ...draft, renderScale: v })}
              />
              <ToggleField
                label="Dynamic Shadows"
                checked={draft.shadows}
                onChange={(c) => setDraft({ ...draft, shadows: c })}
              />
              <ToggleField
                label="Bloom & Cinematic Post-FX"
                checked={draft.bloom}
                onChange={(c) => setDraft({ ...draft, bloom: c })}
              />
              <ToggleField
                label="Bullet Tracers"
                checked={draft.showTracers}
                onChange={(c) => setDraft({ ...draft, showTracers: c })}
              />
              <ToggleField
                label="Show FPS & Ping Telemetry"
                checked={draft.showFps}
                onChange={(c) => setDraft({ ...draft, showFps: c })}
              />
              {onReplayIntro && (
                <div className="pt-2">
                  <TacticalButton
                    variant="secondary"
                    size="md"
                    className="w-full"
                    onClick={() => {
                      onClose();
                      onReplayIntro();
                    }}
                  >
                    Replay Cinematic Intro Sequence
                  </TacticalButton>
                </div>
              )}
            </div>
          )}

          {tab === 'audio' && (
            <div className="space-y-4 max-w-xl">
              <ToggleField
                label="Mute All Audio"
                checked={draft.muted}
                onChange={(c) => setDraft({ ...draft, muted: c })}
              />
              <SliderField
                label="Master Volume"
                value={draft.masterVolume}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => setDraft({ ...draft, masterVolume: v })}
              />
              <SliderField
                label="Weapon Volume"
                value={draft.weaponVolume}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => setDraft({ ...draft, weaponVolume: v })}
              />
              <SliderField
                label="Combat SFX & Footsteps"
                value={draft.sfxVolume}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => setDraft({ ...draft, sfxVolume: v })}
              />
              <SliderField
                label="Environment & Ambient"
                value={draft.ambientVolume}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => setDraft({ ...draft, ambientVolume: v })}
              />
              <SliderField
                label="UI Sounds"
                value={draft.uiVolume}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => setDraft({ ...draft, uiVolume: v })}
              />
              <SliderField
                label="Voice Chat Volume"
                value={draft.voiceVolume}
                min={0}
                max={1}
                step={0.05}
                onChange={(v) => setDraft({ ...draft, voiceVolume: v })}
              />
            </div>
          )}

          {tab === 'access' && (
            <div className="space-y-4 max-w-xl">
              <div>
                <label className="block text-[11px] font-mono-tabular uppercase text-slate-400 mb-1.5">
                  Interface Language
                </label>
                <select
                  value={draft.language}
                  onChange={(e) =>
                    setDraft({ ...draft, language: e.target.value as PlayerSettings['language'] })
                  }
                  className="w-full px-3.5 py-2.5 bg-[#07090e] border border-slate-700 text-sm text-slate-100"
                >
                  <option value="en">English</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="ja">日本語</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-mono-tabular uppercase text-slate-400 mb-1.5">
                  Colorblind Palette Assist
                </label>
                <select
                  value={draft.colorblindMode}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      colorblindMode: e.target.value as PlayerSettings['colorblindMode'],
                    })
                  }
                  className="w-full px-3.5 py-2.5 bg-[#07090e] border border-slate-700 text-sm text-slate-100"
                >
                  <option value="none">Standard (Sky / Crimson)</option>
                  <option value="deuteranopia">Deuteranopia (Sky / Orange)</option>
                  <option value="protanopia">Protanopia (Sky / Orange)</option>
                  <option value="tritanopia">Tritanopia (Teal / Rose)</option>
                </select>
              </div>
              <SliderField
                label="Mobile Touch Controls Scale"
                value={draft.mobileLayoutScale}
                min={0.75}
                max={1.35}
                step={0.05}
                onChange={(v) => setDraft({ ...draft, mobileLayoutScale: v })}
              />
            </div>
          )}
        </div>
      </ModalShell>
    </div>
  );
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono-tabular text-amber-400">{value.toFixed(step < 1 ? 2 : 0)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-amber-500 cursor-pointer"
      />
    </div>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (c: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between px-3 py-2 bg-[#07090e] border border-slate-800 cursor-pointer">
      <span className="text-xs text-slate-300">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-amber-500 cursor-pointer"
      />
    </label>
  );
}
