import type { AgentEvent, AgentId } from "@agent-world/core";
import type { SoundSettings } from "../state/useWorldStore";

const STORAGE_KEY = "aaw.sound.v1";
export const DEFAULT_SOUND: SoundSettings = { enabled: true, volume: 0.6, ambient: true };

const AGENT_PITCH: Record<AgentId, number> = { orion: 523.25, piper: 659.25, iris: 587.33, kai: 440, quinn: 698.46, rex: 392 };

export function loadSoundSettings(): SoundSettings {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return DEFAULT_SOUND;
    const parsed = JSON.parse(raw) as Partial<SoundSettings>;
    return {
      enabled: typeof parsed.enabled === "boolean" ? parsed.enabled : DEFAULT_SOUND.enabled,
      volume: typeof parsed.volume === "number" ? Math.min(1, Math.max(0, parsed.volume)) : DEFAULT_SOUND.volume,
      ambient: typeof parsed.ambient === "boolean" ? parsed.ambient : DEFAULT_SOUND.ambient,
    };
  } catch {
    return DEFAULT_SOUND;
  }
}

export function saveSoundSettings(settings: SoundSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // storage unavailable (private mode): settings just won't persist
  }
}

/**
 * Procedural Web Audio cues. The AudioContext is created only from a user gesture (`unlock`);
 * before that `play` is a silent no-op. Every voice disconnects itself when done so nodes never accumulate.
 */
class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private settings: SoundSettings = DEFAULT_SOUND;
  private running = false;
  private ambient: { source: AudioBufferSourceNode; hum: OscillatorNode; gain: GainNode } | null = null;
  private lastPlayed = new Map<string, number>();

  get unlocked(): boolean {
    return this.ctx !== null && this.ctx.state === "running";
  }

  unlock(): void {
    if (typeof window === "undefined") return;
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.ratio.value = 6;
      this.master = this.ctx.createGain();
      this.master.gain.value = this.settings.volume;
      this.master.connect(comp).connect(this.ctx.destination);
      this.noise = this.makeNoise(this.ctx);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    this.syncAmbient();
  }

  configure(settings: SoundSettings): void {
    this.settings = settings;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(settings.enabled ? settings.volume : 0, this.ctx.currentTime, 0.05);
    this.syncAmbient();
  }

  setRunning(running: boolean): void {
    this.running = running;
    this.syncAmbient();
  }

  play(event: AgentEvent): void {
    if (!this.ctx || !this.master || !this.settings.enabled || this.ctx.state !== "running") return;
    if (event.type === "agent.ambient") return;
    const key = event.type === "agent.message" ? `${event.type}:${event.agentId ?? ""}` : event.type;
    const gap = event.type === "agent.arrived" ? 160 : 120;
    const now = performance.now();
    if (now - (this.lastPlayed.get(key) ?? -1e9) < gap) return;
    this.lastPlayed.set(key, now);
    const t = this.ctx.currentTime + 0.01;
    const pitch = event.agentId ? AGENT_PITCH[event.agentId] : 523.25;

    switch (event.type) {
      case "task.created":
        this.tone("sine", 880, 880, t, 0.09, 0.18);
        this.tone("sine", 1174.66, 1174.66, t + 0.09, 0.12, 0.16);
        break;
      case "task.assigned":
      case "agent.message":
        this.tone("triangle", pitch, pitch, t, 0.1, 0.16);
        this.tone("triangle", pitch * 1.5, pitch * 1.5, t + 0.1, 0.14, 0.13);
        break;
      case "plan.created":
        [1, 1.26, 1.5].forEach((m, i) => this.tone("triangle", pitch * m, pitch * m, t + i * 0.07, 0.12, 0.14));
        break;
      case "research.completed":
        this.sweep(600, 3200, t, 0.35, 0.12);
        this.tone("sine", 987.77, 987.77, t + 0.2, 0.25, 0.12);
        break;
      case "implementation.started":
        for (let i = 0; i < 6; i++) this.click(t + i * 0.055 + (i % 2) * 0.012);
        break;
      case "implementation.submitted":
        this.sweep(300, 4000, t, 0.32, 0.14);
        break;
      case "qa.passed":
      case "review.approved":
        [659.25, 830.61, 987.77].forEach((f, i) => this.tone("sine", f, f, t + i * 0.08, 0.28, 0.16));
        break;
      case "qa.failed":
      case "review.changes_requested":
        this.tone("sawtooth", 220, 150, t, 0.28, 0.09);
        this.tone("square", 165, 110, t, 0.28, 0.06);
        break;
      case "task.completed":
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone("triangle", f, f, t + i * 0.1, 0.16, 0.18));
        this.tone("triangle", 1046.5, 1046.5, t + 0.4, 0.7, 0.14);
        break;
      case "task.failed":
        this.tone("sine", 110, 55, t, 0.5, 0.3);
        this.sweep(400, 120, t, 0.4, 0.08);
        [440, 415.3, 349.23].forEach((f, i) => this.tone("triangle", f, f, t + 0.25 + i * 0.14, 0.16, 0.12));
        break;
      case "task.blocked":
      case "agent.paused":
        this.tone("square", 520, 520, t, 0.07, 0.06);
        this.tone("square", 390, 390, t + 0.09, 0.09, 0.06);
        break;
      case "task.unblocked":
      case "agent.resumed":
        this.tone("square", 390, 390, t, 0.07, 0.06);
        this.tone("square", 520, 520, t + 0.09, 0.09, 0.06);
        break;
      case "system.started":
      case "system.resumed":
        this.tone("sine", 220, 440, t, 0.3, 0.12);
        break;
      case "system.paused":
        this.tone("sine", 440, 220, t, 0.3, 0.12);
        break;
      case "system.reset":
        this.sweep(3000, 120, t, 0.45, 0.1);
        break;
      case "agent.arrived":
        if (event.taskId) this.tone("sine", 90, 60, t, 0.12, 0.22);
        break;
      default:
        break;
    }
  }

  private tone(type: OscillatorType, from: number, to: number, start: number, duration: number, level: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, start);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(master);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  private sweep(from: number, to: number, start: number, duration: number, level: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this.noise) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.value = 2.5;
    filter.frequency.setValueAtTime(from, start);
    filter.frequency.exponentialRampToValueAtTime(to, start + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(level, start + duration * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    src.connect(filter).connect(gain).connect(master);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    src.start(start, Math.random() * 1.5);
    src.stop(start + duration + 0.05);
  }

  private click(start: number): void {
    this.sweep(2500, 1800, start, 0.03, 0.12);
  }

  private makeNoise(ctx: AudioContext): AudioBuffer {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02; // brown-ish
      data[i] = i % 3 === 0 ? white * 0.5 + last * 3 : last * 3.5;
    }
    return buffer;
  }

  /** Low room-tone bed while the simulation runs: looped filtered noise + 58 Hz hum. */
  private syncAmbient(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this.noise) return;
    const want = this.running && this.settings.enabled && this.settings.ambient;
    if (want && !this.ambient) {
      const source = ctx.createBufferSource();
      source.buffer = this.noise;
      source.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 260;
      const hum = ctx.createOscillator();
      hum.frequency.value = 58;
      const humGain = ctx.createGain();
      humGain.gain.value = 0.25;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 1.5);
      source.connect(lp).connect(gain);
      hum.connect(humGain).connect(gain);
      gain.connect(master);
      source.start();
      hum.start();
      this.ambient = { source, hum, gain };
    } else if (!want && this.ambient) {
      const { source, hum, gain } = this.ambient;
      this.ambient = null;
      gain.gain.cancelScheduledValues(ctx.currentTime);
      gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      source.stop(ctx.currentTime + 0.3);
      hum.stop(ctx.currentTime + 0.3);
      hum.onended = () => {
        source.disconnect();
        hum.disconnect();
        gain.disconnect();
      };
    }
  }
}

export const soundEngine = new SoundEngine();
