export type PassengerVoiceCategory = 'boarding' | 'disembarking' | 'comment';

export interface PassengerVoiceClip {
  id: string;
  category: PassengerVoiceCategory;
  speaker: string;
  textBn: string;
  textEn: string;
  pitchHz: number;
  syllableRates: number[];
  vowelPattern: ('a' | 'e' | 'i' | 'o' | 'u')[];
}

// Curated library of randomized Bangladeshi highway coach passenger voice clips
export const PASSENGER_VOICE_LIBRARY: PassengerVoiceClip[] = [
  // Boarding clips
  {
    id: 'board_1',
    category: 'boarding',
    speaker: 'Passenger',
    textBn: 'আসসালামু আলাইকুম, জানালার পাশে সিট আছে?',
    textEn: 'Salam! Is there a window seat?',
    pitchHz: 132,
    syllableRates: [0.16, 0.14, 0.18, 0.12, 0.15, 0.19],
    vowelPattern: ['a', 'a', 'o', 'i', 'a', 'e'],
  },
  {
    id: 'board_2',
    category: 'boarding',
    speaker: 'Passenger',
    textBn: 'ভাই, আমার ব্যাগটা একটু সাবধানে তুলে দেন।',
    textEn: 'Brother, please load my bag carefully.',
    pitchHz: 205,
    syllableRates: [0.15, 0.17, 0.14, 0.16, 0.13, 0.18],
    vowelPattern: ['a', 'a', 'e', 'u', 'o', 'e'],
  },
  {
    id: 'board_3',
    category: 'boarding',
    speaker: 'Supervisor',
    textBn: 'তাড়াতাড়ি ওঠেন সবাই, গাড়ি এখনই ছাড়বে!',
    textEn: 'Board quickly everyone, coach departing!',
    pitchHz: 148,
    syllableRates: [0.14, 0.13, 0.15, 0.17, 0.14, 0.16],
    vowelPattern: ['a', 'o', 'a', 'i', 'e', 'e'],
  },
  {
    id: 'board_4',
    category: 'boarding',
    speaker: 'Passenger',
    textBn: 'রংপুর-পঞ্চগড় দুইটা টিকিট দেন তো ভাই।',
    textEn: 'Two tickets for the highway route, please.',
    pitchHz: 124,
    syllableRates: [0.17, 0.15, 0.13, 0.16, 0.14],
    vowelPattern: ['o', 'u', 'i', 'e', 'a'],
  },
  {
    id: 'board_5',
    category: 'boarding',
    speaker: 'Passenger',
    textBn: 'ভেতরে একটু জায়গা দেন তো, বাচ্চা সাথে আছে।',
    textEn: 'Please make some room inside.',
    pitchHz: 218,
    syllableRates: [0.15, 0.14, 0.18, 0.13, 0.16, 0.15],
    vowelPattern: ['e', 'o', 'a', 'i', 'a', 'e'],
  },

  // Disembarking clips
  {
    id: 'disembark_1',
    category: 'disembarking',
    speaker: 'Passenger',
    textBn: 'এখানেই নামবো ভাই, ব্যাগটা নামিয়ে দেন।',
    textEn: 'Getting off here, please hand my bag.',
    pitchHz: 138,
    syllableRates: [0.15, 0.14, 0.17, 0.14, 0.18],
    vowelPattern: ['e', 'a', 'o', 'i', 'e'],
  },
  {
    id: 'disembark_2',
    category: 'disembarking',
    speaker: 'Passenger',
    textBn: 'ধন্যবাদ ড্রাইভার সাহেব, খুব সুন্দর চালিয়েছেন!',
    textEn: 'Thank you driver, very smooth ride!',
    pitchHz: 212,
    syllableRates: [0.16, 0.14, 0.15, 0.13, 0.17, 0.18],
    vowelPattern: ['o', 'a', 'e', 'u', 'i', 'e'],
  },
  {
    id: 'disembark_3',
    category: 'disembarking',
    speaker: 'Passenger',
    textBn: 'আস্তে নামো সবাই, সিঁড়ি দেখে নামবেন।',
    textEn: 'Step down carefully everyone.',
    pitchHz: 152,
    syllableRates: [0.15, 0.15, 0.14, 0.17, 0.16],
    vowelPattern: ['a', 'e', 'o', 'i', 'e'],
  },
  {
    id: 'disembark_4',
    category: 'disembarking',
    speaker: 'Passenger',
    textBn: 'আল্লাহ হাফেজ ভাই, ভালো থাকবেন।',
    textEn: 'Goodbye brother, safe travels!',
    pitchHz: 126,
    syllableRates: [0.18, 0.15, 0.14, 0.18],
    vowelPattern: ['a', 'e', 'a', 'o'],
  },
  {
    id: 'disembark_5',
    category: 'disembarking',
    speaker: 'Passenger',
    textBn: 'আমাদের স্টপেজ চলে আসছে, গেট খুলুন।',
    textEn: 'Our stop is here, open the door.',
    pitchHz: 198,
    syllableRates: [0.14, 0.16, 0.15, 0.13, 0.17],
    vowelPattern: ['a', 'e', 'o', 'u', 'u'],
  },

  // Occasional in-transit / stop comments
  {
    id: 'comment_1',
    category: 'comment',
    speaker: 'Passenger',
    textBn: 'রাস্তাটা অনেক সুন্দর, দারুণ চালাচ্ছেন!',
    textEn: 'What a scenic highway, great driving!',
    pitchHz: 142,
    syllableRates: [0.15, 0.14, 0.17, 0.15, 0.18],
    vowelPattern: ['a', 'o', 'u', 'a', 'e'],
  },
  {
    id: 'comment_2',
    category: 'comment',
    speaker: 'Passenger',
    textBn: 'ভাই, এসিটা একটু কমিয়ে দেন তো, ঠান্ডা লাগছে।',
    textEn: 'Could you turn the AC down a bit?',
    pitchHz: 215,
    syllableRates: [0.14, 0.15, 0.16, 0.13, 0.17, 0.15],
    vowelPattern: ['a', 'e', 'i', 'u', 'a', 'e'],
  },
  {
    id: 'comment_3',
    category: 'comment',
    speaker: 'Passenger',
    textBn: 'ড্রাইভার ভাই, হর্নটা কিন্তু দারুণ বাজে!',
    textEn: 'Driver bhai, that air horn sounds awesome!',
    pitchHz: 129,
    syllableRates: [0.16, 0.14, 0.15, 0.16, 0.18],
    vowelPattern: ['a', 'i', 'o', 'u', 'e'],
  },
  {
    id: 'comment_4',
    category: 'comment',
    speaker: 'Passenger',
    textBn: 'সামনে চা স্টলে একটু থামলে ভালো হতো।',
    textEn: 'A quick tea break ahead would be nice.',
    pitchHz: 192,
    syllableRates: [0.15, 0.14, 0.16, 0.14, 0.17],
    vowelPattern: ['a', 'e', 'o', 'a', 'o'],
  },
  {
    id: 'comment_5',
    category: 'comment',
    speaker: 'Passenger',
    textBn: 'আজকের যাত্রাটা খুব আরামদায়ক লাগছে।',
    textEn: 'Today’s journey feels super comfortable.',
    pitchHz: 136,
    syllableRates: [0.15, 0.15, 0.14, 0.17, 0.16],
    vowelPattern: ['a', 'e', 'u', 'a', 'e'],
  },
  {
    id: 'comment_6',
    category: 'comment',
    speaker: 'Passenger',
    textBn: 'রাস্তা ফাঁকা আছে, নিরাপদে চালিয়ে যান!',
    textEn: 'Highway is clear, drive safe!',
    pitchHz: 155,
    syllableRates: [0.14, 0.16, 0.14, 0.15, 0.17],
    vowelPattern: ['a', 'a', 'i', 'e', 'a'],
  },
];

// Formant frequency targets (F1, F2, F3 in Hz) for natural vowel shaping
const VOWEL_FORMANTS: Record<'a' | 'e' | 'i' | 'o' | 'u', [number, number, number]> = {
  a: [730, 1180, 2500],
  e: [530, 1840, 2550],
  i: [310, 2250, 2900],
  o: [500, 880, 2400],
  u: [340, 760, 2250],
};

export class PassengerVoiceLibrary {
  private readonly bufferCache = new Map<string, AudioBuffer>();
  private readonly lastIndexByCat = new Map<PassengerVoiceCategory, number>();
  private activeSource: AudioBufferSourceNode | null = null;
  private activeGain: GainNode | null = null;
  private lastTriggerTimeMs = 0;

  public pickRandomClip(category: PassengerVoiceCategory): PassengerVoiceClip {
    const pool = PASSENGER_VOICE_LIBRARY.filter((c) => c.category === category);
    const prevIdx = this.lastIndexByCat.get(category) ?? -1;
    let idx = Math.floor(Math.random() * pool.length);
    if (pool.length > 1 && idx === prevIdx) {
      idx = (idx + 1) % pool.length;
    }
    this.lastIndexByCat.set(category, idx);
    return pool[idx];
  }

  public async playClip(
    ctx: AudioContext,
    masterGain: GainNode,
    category: PassengerVoiceCategory,
    muted: boolean
  ): Promise<PassengerVoiceClip | null> {
    const nowMs = performance.now();
    if (nowMs - this.lastTriggerTimeMs < 1100) {
      return null;
    }
    this.lastTriggerTimeMs = nowMs;

    const clip = this.pickRandomClip(category);
    if (muted) {
      return clip;
    }

    // Stop any previous active clip smoothly
    this.stopActive();

    // Use native Bengali SpeechSynthesis when the OS/browser provides a Bengali voice;
    // otherwise synthesize natural formant-modulated voice audio via OfflineAudioContext
    const usedSpeech = this.tryBengaliSpeechSynthesis(clip);
    if (!usedSpeech) {
      const buffer = await this.getOrRenderVoiceBuffer(ctx, clip);
      if (buffer && ctx.state === 'running') {
        const src = ctx.createBufferSource();
        src.buffer = buffer;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.42, ctx.currentTime);
        src.connect(gain);
        gain.connect(masterGain);

        src.onended = () => {
          if (this.activeSource === src) {
            this.activeSource = null;
            this.activeGain = null;
          }
          try {
            gain.disconnect();
          } catch {
            // noop
          }
        };
        src.start();
        this.activeSource = src;
        this.activeGain = gain;
      }
    }

    return clip;
  }

  private tryBengaliSpeechSynthesis(clip: PassengerVoiceClip): boolean {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return false;
    }
    try {
      const synth = window.speechSynthesis;
      const voices = synth.getVoices();
      const bnVoice = voices.find((v) => v.lang.toLowerCase().startsWith('bn'));
      if (!bnVoice) {
        return false;
      }

      synth.cancel();
      const utter = new SpeechSynthesisUtterance(clip.textBn);
      utter.voice = bnVoice;
      utter.lang = bnVoice.lang;
      utter.volume = 0.72;
      utter.rate = 0.98;
      utter.pitch = clip.pitchHz > 180 ? 1.28 : clip.pitchHz < 135 ? 0.92 : 1.05;
      synth.speak(utter);
      return true;
    } catch {
      return false;
    }
  }

  private async getOrRenderVoiceBuffer(
    liveCtx: AudioContext,
    clip: PassengerVoiceClip
  ): Promise<AudioBuffer | null> {
    const cached = this.bufferCache.get(clip.id);
    if (cached) return cached;

    try {
      const gap = 0.045;
      const totalDuration =
        clip.syllableRates.reduce((acc, d) => acc + d + gap, 0) + 0.14;
      const sampleRate = liveCtx.sampleRate || 44100;
      const offline = new OfflineAudioContext(1, Math.ceil(totalDuration * sampleRate), sampleRate);

      // Glottal excitation + soft breath aspiration mixed into parallel formant bandpass resonators
      const f1 = offline.createBiquadFilter();
      f1.type = 'bandpass';
      f1.Q.value = 7.5;

      const f2 = offline.createBiquadFilter();
      f2.type = 'bandpass';
      f2.Q.value = 10.0;

      const f3 = offline.createBiquadFilter();
      f3.type = 'bandpass';
      f3.Q.value = 14.0;

      const f1Gain = offline.createGain();
      f1Gain.gain.value = 0.62;
      const f2Gain = offline.createGain();
      f2Gain.gain.value = 0.34;
      const f3Gain = offline.createGain();
      f3Gain.gain.value = 0.14;

      const envGain = offline.createGain();
      envGain.gain.value = 0.0001;

      f1.connect(f1Gain).connect(envGain);
      f2.connect(f2Gain).connect(envGain);
      f3.connect(f3Gain).connect(envGain);
      envGain.connect(offline.destination);

      const glottal = offline.createOscillator();
      glottal.type = 'sawtooth';
      glottal.frequency.value = clip.pitchHz;

      // Slight warm sub-harmonic chest tone
      const chest = offline.createOscillator();
      chest.type = 'triangle';
      chest.frequency.value = clip.pitchHz;

      const glottalMix = offline.createGain();
      glottalMix.gain.value = 0.72;
      const chestMix = offline.createGain();
      chestMix.gain.value = 0.35;

      glottal.connect(glottalMix);
      chest.connect(chestMix);
      glottalMix.connect(f1);
      glottalMix.connect(f2);
      glottalMix.connect(f3);
      chestMix.connect(f1);

      // Gentle consonant aspiration burst buffer
      const noiseLen = Math.ceil(totalDuration * sampleRate);
      const noiseBuf = offline.createBuffer(1, noiseLen, sampleRate);
      const noiseData = noiseBuf.getChannelData(0);
      for (let i = 0; i < noiseLen; i++) {
        noiseData[i] = (Math.random() * 2 - 1) * 0.14;
      }
      const noiseSrc = offline.createBufferSource();
      noiseSrc.buffer = noiseBuf;
      const noiseHp = offline.createBiquadFilter();
      noiseHp.type = 'highpass';
      noiseHp.frequency.value = 2600;
      const noiseGain = offline.createGain();
      noiseGain.gain.value = 0.08;
      noiseSrc.connect(noiseHp).connect(noiseGain).connect(f2);

      // Schedule syllable intonation, vowel formants, and amplitude contour
      let t = 0.04;
      const n = clip.syllableRates.length;
      for (let i = 0; i < n; i++) {
        const dur = clip.syllableRates[i];
        const vowel = clip.vowelPattern[i % clip.vowelPattern.length];
        const [v1, v2, v3] = VOWEL_FORMANTS[vowel];

        // Natural speech prosody: rise in middle, gentle cadence drop at end
        const prosody =
          i === n - 1 ? 0.88 : i === 0 ? 1.04 : 1.0 + Math.sin((i / n) * Math.PI) * 0.11;
        const fTarget = clip.pitchHz * prosody;

        glottal.frequency.setValueAtTime(fTarget, t);
        glottal.frequency.linearRampToValueAtTime(
          i === n - 1 ? fTarget * 0.9 : fTarget * 1.03,
          t + dur
        );
        chest.frequency.setValueAtTime(fTarget, t);
        chest.frequency.linearRampToValueAtTime(
          i === n - 1 ? fTarget * 0.9 : fTarget * 1.03,
          t + dur
        );

        f1.frequency.setValueAtTime(v1, t);
        f2.frequency.setValueAtTime(v2, t);
        f3.frequency.setValueAtTime(v3, t);

        envGain.gain.setValueAtTime(0.0005, t);
        envGain.gain.linearRampToValueAtTime(0.55, t + dur * 0.25);
        envGain.gain.setValueAtTime(0.5, t + dur * 0.65);
        envGain.gain.exponentialRampToValueAtTime(0.001, t + dur);

        t += dur + gap;
      }

      glottal.start(0);
      chest.start(0);
      noiseSrc.start(0);
      glottal.stop(totalDuration);
      chest.stop(totalDuration);
      noiseSrc.stop(totalDuration);

      const rendered = await offline.startRendering();
      this.bufferCache.set(clip.id, rendered);
      return rendered;
    } catch {
      return null;
    }
  }

  public stopActive(): void {
    if (this.activeSource) {
      try {
        this.activeSource.stop();
        this.activeSource.disconnect();
      } catch {
        // noop
      }
      this.activeSource = null;
    }
    if (this.activeGain) {
      try {
        this.activeGain.disconnect();
      } catch {
        // noop
      }
      this.activeGain = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // noop
      }
    }
  }

  public dispose(): void {
    this.stopActive();
    this.bufferCache.clear();
  }
}
