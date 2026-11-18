import type { MaterialTag, PlayerSettings, Vec3, WeaponId } from '../../../shared/types/game.ts';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private weaponGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private uiGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private activeVoices = 0;
  private maxVoices = 24;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
      this.masterGain = this.ctx.createGain();
      this.weaponGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.ambientGain = this.ctx.createGain();
      this.uiGain = this.ctx.createGain();

      this.weaponGain.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.ambientGain.connect(this.masterGain);
      this.uiGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      // Shared white-noise buffer for procedural gunshots, impacts & footsteps
      const sr = this.ctx.sampleRate;
      const buf = this.ctx.createBuffer(1, sr * 1.2, sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noiseBuffer = buf;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public applySettings(s: PlayerSettings) {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.weaponGain || !this.sfxGain || !this.ambientGain || !this.uiGain) return;
    const t = ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(s.muted ? 0 : s.masterVolume, t, 0.02);
    this.weaponGain.gain.setTargetAtTime(s.weaponVolume, t, 0.02);
    this.sfxGain.gain.setTargetAtTime(s.sfxVolume, t, 0.02);
    this.ambientGain.gain.setTargetAtTime(s.ambientVolume, t, 0.02);
    this.uiGain.gain.setTargetAtTime(s.uiVolume, t, 0.02);
  }

  private computeSpatial(listenerPos?: Vec3, listenerYaw = 0, sourcePos?: Vec3): { gain: number; pan: number } {
    if (!listenerPos || !sourcePos) return { gain: 1, pan: 0 };
    const dx = sourcePos.x - listenerPos.x;
    const dy = sourcePos.y - listenerPos.y;
    const dz = sourcePos.z - listenerPos.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist < 0.8) return { gain: 1, pan: 0 };
    const gain = Math.max(0, Math.min(1, 1 - dist / 55));
    const rightX = Math.cos(listenerYaw);
    const rightZ = -Math.sin(listenerYaw);
    const pan = Math.max(-1, Math.min(1, (dx * rightX + dz * rightZ) / dist));
    return { gain: gain * gain, pan };
  }

  public playGunshot(
    weaponId: WeaponId,
    isLocal: boolean,
    listenerPos?: Vec3,
    listenerYaw = 0,
    sourcePos?: Vec3
  ) {
    const ctx = this.ensureContext();
    if (!ctx || !this.weaponGain || !this.noiseBuffer || this.activeVoices >= this.maxVoices) return;

    const spatial = isLocal ? { gain: 1, pan: 0 } : this.computeSpatial(listenerPos, listenerYaw, sourcePos);
    if (spatial.gain < 0.03) return;

    this.activeVoices++;
    const now = ctx.currentTime;
    const panner = ctx.createStereoPanner();
    panner.pan.value = spatial.pan;
    panner.connect(this.weaponGain);

    // Weapon profile
    const isSniper = weaponId === 'longshot_sr';
    const isShotgun = weaponId === 'breacher_sg';
    const isSmg = weaponId === 'spectre_smg';
    const isPistol = weaponId === 'viper_pistol';
    const dur = isSniper ? 0.38 : isShotgun ? 0.32 : isSmg ? 0.11 : 0.18;

    // 1. Punchy low-end transient body
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = isSniper || isShotgun ? 'sawtooth' : 'triangle';
    const startFreq = isSmg ? 220 : isPistol ? 200 : isSniper ? 130 : 165;
    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + dur * 0.55);

    oscGain.gain.setValueAtTime(0.42 * spatial.gain, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 0.65);
    osc.connect(oscGain);
    oscGain.connect(panner);
    osc.start(now);
    osc.stop(now + dur);

    // 2. Filtered noise crack
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isSmg ? 2400 : isSniper ? 1200 : 1850, now);
    filter.frequency.exponentialRampToValueAtTime(340, now + dur);
    filter.Q.value = isSniper ? 0.7 : 1.0;

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime((isSniper || isShotgun ? 0.62 : 0.45) * spatial.gain, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(panner);
    noise.start(now);
    noise.stop(now + dur);
    noise.onended = () => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
      panner.disconnect();
    };
  }

  public playReload() {
    const ctx = this.ensureContext();
    if (!ctx || !this.weaponGain) return;
    const now = ctx.currentTime;
    // Two crisp mechanical clicks
    [0, 0.22].forEach((offset, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(idx === 0 ? 520 : 780, now + offset);
      osc.frequency.exponentialRampToValueAtTime(180, now + offset + 0.04);
      g.gain.setValueAtTime(0.14, now + offset);
      g.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.045);
      osc.connect(g);
      g.connect(this.weaponGain!);
      osc.start(now + offset);
      osc.stop(now + offset + 0.05);
    });
  }

  public playDryFire() {
    const ctx = this.ensureContext();
    if (!ctx || !this.weaponGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1100, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.03);
    g.gain.setValueAtTime(0.16, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    osc.connect(g);
    g.connect(this.weaponGain);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  public playHitmarker(headshot: boolean) {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = headshot ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(headshot ? 1680 : 940, now);
    osc.frequency.exponentialRampToValueAtTime(headshot ? 2150 : 620, now + 0.065);
    g.gain.setValueAtTime(headshot ? 0.28 : 0.18, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.08);
  }

  public playElimination() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    [523.25, 783.99].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.055);
      g.gain.setValueAtTime(0.18, now + idx * 0.055);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.055 + 0.22);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(now + idx * 0.055);
      osc.stop(now + idx * 0.055 + 0.24);
    });
  }

  public playHurt() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.11);
    g.gain.setValueAtTime(0.24, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
    osc.connect(g);
    g.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playFootstep(material: MaterialTag, isSprint: boolean) {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.noiseBuffer || this.activeVoices >= this.maxVoices) return;
    this.activeVoices++;
    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = material === 'metal' ? 'bandpass' : 'lowpass';
    filter.frequency.value =
      material === 'metal' ? 980 : material === 'sand' ? 420 : 620;
    filter.Q.value = material === 'metal' ? 2.4 : 0.8;

    const g = ctx.createGain();
    g.gain.setValueAtTime(isSprint ? 0.11 : 0.065, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.075);

    noise.connect(filter);
    filter.connect(g);
    g.connect(this.sfxGain);
    noise.start(now);
    noise.stop(now + 0.08);
    noise.onended = () => {
      this.activeVoices = Math.max(0, this.activeVoices - 1);
    };
  }

  private ambientOsc: OscillatorNode | null = null;
  private ambientSubOsc: OscillatorNode | null = null;
  private ambientMode: 'off' | 'lobby' | 'match' = 'off';

  public playUiClick(pitch = 640) {
    const ctx = this.ensureContext();
    if (!ctx || !this.uiGain) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(pitch * 0.72, now + 0.045);
    g.gain.setValueAtTime(0.09, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(g);
    g.connect(this.uiGain);
    osc.start(now);
    osc.stop(now + 0.055);
  }

  public playUiHover() {
    const ctx = this.ensureContext();
    if (!ctx || !this.uiGain || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(980, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.02);
    g.gain.setValueAtTime(0.025, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.022);
    osc.connect(g);
    g.connect(this.uiGain);
    osc.start(now);
    osc.stop(now + 0.026);
  }

  public playMatchStart() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    [392.0, 523.25, 659.25].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);
      g.gain.setValueAtTime(0.14, now + idx * 0.09);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.28);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.3);
    });
  }

  public playVictory() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.095);
      g.gain.setValueAtTime(0.16, now + idx * 0.095);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.095 + 0.42);
      osc.connect(g);
      g.connect(this.sfxGain!);
      osc.start(now + idx * 0.095);
      osc.stop(now + idx * 0.095 + 0.45);
    });
  }

  public playDefeat() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain) return;
    const now = ctx.currentTime;
    [329.63, 277.18, 220.0].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 620;
      osc.frequency.setValueAtTime(freq, now + idx * 0.14);
      g.gain.setValueAtTime(0.12, now + idx * 0.14);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.14 + 0.38);
      osc.connect(filter);
      filter.connect(g);
      g.connect(this.sfxGain!);
      osc.start(now + idx * 0.14);
      osc.stop(now + idx * 0.14 + 0.42);
    });
  }

  public setAmbientMode(mode: 'off' | 'lobby' | 'match') {
    if (this.ambientMode === mode) return;
    this.ambientMode = mode;

    if (this.ambientOsc) {
      try {
        this.ambientOsc.stop();
        this.ambientOsc.disconnect();
      } catch {
        // Ignore already stopped
      }
      this.ambientOsc = null;
    }
    if (this.ambientSubOsc) {
      try {
        this.ambientSubOsc.stop();
        this.ambientSubOsc.disconnect();
      } catch {
        // Ignore already stopped
      }
      this.ambientSubOsc = null;
    }

    if (mode === 'off') return;
    const ctx = this.ensureContext();
    if (!ctx || !this.ambientGain) return;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = mode === 'lobby' ? 190 : 140;

    const droneGain = ctx.createGain();
    droneGain.gain.value = mode === 'lobby' ? 0.045 : 0.025;

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = mode === 'lobby' ? 55 : 46;

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = mode === 'lobby' ? 82.41 : 69.3;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(droneGain);
    droneGain.connect(this.ambientGain);

    osc1.start();
    osc2.start();
    this.ambientOsc = osc1;
    this.ambientSubOsc = osc2;
  }
}

export const audioEngine = new AudioEngine();
