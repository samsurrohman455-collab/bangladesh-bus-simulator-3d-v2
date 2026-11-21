import {
  PassengerVoiceCategory,
  PassengerVoiceClip,
  PassengerVoiceLibrary,
} from './passengerVoices';

export class BusAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;

  private hornGain: GainNode | null = null;
  private hornOscs: OscillatorNode[] = [];
  private hornActive = false;

  private rainSource: AudioBufferSourceNode | null = null;
  private rainFilter: BiquadFilterNode | null = null;
  private rainGain: GainNode | null = null;

  private noiseBuffer: AudioBuffer | null = null;
  private muted = false;
  private initialized = false;
  private readonly passengerVoices = new PassengerVoiceLibrary();

  public unlock(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        void this.ctx.resume();
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.65;
      this.masterGain.connect(this.ctx.destination);

      // Build shared white-noise buffer for air brakes, wipers, and thumps
      const sampleRate = this.ctx.sampleRate;
      const len = sampleRate * 1.5;
      this.noiseBuffer = this.ctx.createBuffer(1, len, sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      // Continuous diesel engine synth (layered sawtooth + triangle through warm low-pass filter)
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 180;
      this.engineFilter.Q.value = 2.2;

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.08;

      this.engineOsc1 = this.ctx.createOscillator();
      this.engineOsc1.type = 'sawtooth';
      this.engineOsc1.frequency.value = 42;

      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'triangle';
      this.engineOsc2.frequency.value = 84;

      this.engineOsc1.connect(this.engineFilter);
      this.engineOsc2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.masterGain);

      this.engineOsc1.start();
      this.engineOsc2.start();

      // Continuous soft highway rain patter bus (idle at 0 gain until rain)
      this.rainFilter = this.ctx.createBiquadFilter();
      this.rainFilter.type = 'bandpass';
      this.rainFilter.frequency.value = 1050;
      this.rainFilter.Q.value = 0.65;

      this.rainGain = this.ctx.createGain();
      this.rainGain.gain.value = 0;

      this.rainSource = this.ctx.createBufferSource();
      this.rainSource.buffer = this.noiseBuffer;
      this.rainSource.loop = true;
      this.rainSource.connect(this.rainFilter);
      this.rainFilter.connect(this.rainGain);
      this.rainGain.connect(this.masterGain);
      this.rainSource.start();

      this.initialized = true;
    } catch {
      // Ignore Web Audio errors on restricted devices
    }
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) {
      this.passengerVoices.stopActive();
    }
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.65, this.ctx.currentTime, 0.04);
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public updateEngine(rpm: number, throttle: number, speedKmh: number): void {
    if (!this.initialized || !this.ctx || !this.engineOsc1 || !this.engineOsc2 || !this.engineFilter || !this.engineGain) {
      return;
    }
    const now = this.ctx.currentTime;
    const normRpm = Math.max(0, Math.min(1, (rpm - 700) / 4800));
    const baseFreq = 34 + normRpm * 74 + Math.min(20, speedKmh * 0.18);
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.06);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.99, now, 0.06);

    const cutoff = 140 + normRpm * 420 + throttle * 180;
    this.engineFilter.frequency.setTargetAtTime(cutoff, now, 0.08);

    const vol = 0.075 + throttle * 0.065 + normRpm * 0.05;
    this.engineGain.gain.setTargetAtTime(vol, now, 0.08);
  }

  public updateRainAmbience(rainFactor: number, insideCockpit: boolean): void {
    if (!this.initialized || !this.ctx || !this.rainGain || !this.rainFilter) {
      return;
    }
    const now = this.ctx.currentTime;
    const clamped = Math.max(0, Math.min(1, rainFactor));
    const targetGain = clamped > 0.01 ? clamped * (insideCockpit ? 0.08 : 0.115) : 0;
    const targetFreq = insideCockpit ? 760 : 1280;
    this.rainGain.gain.setTargetAtTime(targetGain, now, 0.14);
    this.rainFilter.frequency.setTargetAtTime(targetFreq, now, 0.16);
  }

  /**
   * Authentic Bangladeshi highway hydraulic multi-tone air horn (F4 + A4 + C5 brassy triad with slight vibrato)
   */
  public setAirHorn(active: boolean): void {
    if (active === this.hornActive) return;
    this.hornActive = active;
    if (!this.initialized || !this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;
    if (active) {
      this.stopHornOscs();
      const hornBus = this.ctx.createGain();
      hornBus.gain.setValueAtTime(0.001, now);
      hornBus.gain.exponentialRampToValueAtTime(0.32, now + 0.045);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 920;
      filter.Q.value = 1.1;

      hornBus.connect(filter);
      filter.connect(this.masterGain);
      this.hornGain = hornBus;

      // Iconic Bangladeshi dual/triple-reed hydraulic air horn chord
      const freqs = [349.23, 440.0, 523.25, 352.4];
      for (const f of freqs) {
        const osc = this.ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(f * 0.96, now);
        osc.frequency.exponentialRampToValueAtTime(f, now + 0.06);
        osc.connect(hornBus);
        osc.start(now);
        this.hornOscs.push(osc);
      }
    } else {
      if (this.hornGain) {
        const gainRef = this.hornGain;
        const oscsRef = [...this.hornOscs];
        gainRef.gain.cancelScheduledValues(now);
        gainRef.gain.setValueAtTime(Math.max(0.01, gainRef.gain.value), now);
        gainRef.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
        window.setTimeout(() => {
          for (const o of oscsRef) {
            try {
              o.stop();
              o.disconnect();
            } catch {
              // noop
            }
          }
          gainRef.disconnect();
        }, 170);
        this.hornGain = null;
        this.hornOscs = [];
      }
    }
  }

  private stopHornOscs(): void {
    for (const o of this.hornOscs) {
      try {
        o.stop();
        o.disconnect();
      } catch {
        // noop
      }
    }
    this.hornOscs = [];
    if (this.hornGain) {
      this.hornGain.disconnect();
      this.hornGain = null;
    }
  }

  public playAirBrakeHiss(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const hp = this.ctx.createBiquadFilter();
    hp.type = 'bandpass';
    hp.frequency.setValueAtTime(2400, now);
    hp.Q.value = 1.6;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.34);

    src.connect(hp);
    hp.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.36);
  }

  public playIndicatorTick(on: boolean): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = on ? 950 : 720;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.045, now);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.028);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.032);
  }

  public playThump(intensity = 0.7): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.18);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.28 * intensity, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.24);
  }

  public playBoardingChime(): void {
    if (!this.initialized || !this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = this.ctx.createGain();
      const t = now + idx * 0.075;
      gain.gain.setValueAtTime(0.001, t);
      gain.gain.exponentialRampToValueAtTime(0.11, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0005, t + 0.26);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.28);
    });
  }

  public playWiperSwish(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(680, now);
    filter.Q.value = 3.0;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.035, now + 0.07);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.22);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.24);
  }

  public playDoorAir(opening: boolean): void {
    if (!this.initialized || !this.ctx || !this.masterGain || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(opening ? 1900 : 1400, now);
    filter.Q.value = 1.8;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.28);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(now);
    src.stop(now + 0.3);
  }

  public async playPassengerVoice(category: PassengerVoiceCategory): Promise<PassengerVoiceClip | null> {
    if (!this.initialized || !this.ctx || !this.masterGain) {
      return null;
    }
    return this.passengerVoices.playClip(this.ctx, this.masterGain, category, this.muted);
  }

  public stopPassengerVoice(): void {
    this.passengerVoices.stopActive();
  }

  public dispose(): void {
    this.setAirHorn(false);
    this.passengerVoices.dispose();
    try {
      this.engineOsc1?.stop();
      this.engineOsc2?.stop();
      this.rainSource?.stop();
      this.ctx?.close();
    } catch {
      // noop
    }
    this.initialized = false;
  }
}
