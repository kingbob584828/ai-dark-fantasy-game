class DarkFantasyAudioEngine {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;
  public masterVolume: number = 0.7;
  public sfxVolume: number = 0.85;
  public musicVolume: number = 0.55;
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;
  private currentMood: string = 'none';

  private ensureContext(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(mute: boolean) {
    this.muted = mute;
    if (this.droneGain && this.ctx) {
      this.droneGain.gain.setTargetAtTime(
        mute ? 0 : this.masterVolume * this.musicVolume * 0.08,
        this.ctx.currentTime,
        0.2
      );
    }
  }

  public updateAmbientDrone(mood: 'oakhaven' | 'bramblewood' | 'cathedral' | 'catacombs' | 'bastion' | 'crucible') {
    const ctx = this.ensureContext();
    if (!ctx) return;
    if (this.currentMood === mood && this.droneOsc1) return;
    this.currentMood = mood;

    const rootFreqMap: Record<string, [number, number]> = {
      oakhaven: [55.0, 82.41],     // A1 + E2 warm somber fifth
      bramblewood: [49.0, 73.42],  // G1 + D2 eerie forest
      cathedral: [65.41, 98.0],    // C2 + G2 modal organ resonance
      catacombs: [41.2, 61.74],    // E1 + B1 deep subterranean
      bastion: [58.27, 87.31],     // Bb1 + F2 martial tension
      crucible: [46.25, 65.41],    // F#1 + C2 tritone dread
    };
    const [f1, f2] = rootFreqMap[mood] || [55.0, 82.41];

    if (!this.droneOsc1) {
      try {
        this.droneOsc1 = ctx.createOscillator();
        this.droneOsc2 = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 190;

        this.droneGain = ctx.createGain();
        this.droneGain.gain.value = this.muted ? 0 : this.masterVolume * this.musicVolume * 0.07;

        this.droneOsc1.type = 'sawtooth';
        this.droneOsc2.type = 'triangle';
        this.droneOsc1.frequency.value = f1;
        this.droneOsc2.frequency.value = f2;

        this.droneOsc1.connect(filter);
        this.droneOsc2.connect(filter);
        filter.connect(this.droneGain);
        this.droneGain.connect(ctx.destination);

        this.droneOsc1.start();
        this.droneOsc2.start();
      } catch {
        // Ignore audio autoplay block until user interacts
      }
    } else if (this.droneOsc1 && this.droneOsc2) {
      this.droneOsc1.frequency.setTargetAtTime(f1, ctx.currentTime, 0.8);
      this.droneOsc2.frequency.setTargetAtTime(f2, ctx.currentTime, 0.8);
    }
  }

  public playSwing(heavy: boolean = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(heavy ? 180 : 280, now);
    osc.frequency.exponentialRampToValueAtTime(heavy ? 48 : 85, now + (heavy ? 0.22 : 0.13));

    const vol = this.masterVolume * this.sfxVolume * (heavy ? 0.28 : 0.18);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (heavy ? 0.24 : 0.14));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (heavy ? 0.25 : 0.15));
  }

  public playHit(heavy: boolean = false, critical: boolean = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Low impact thump
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = critical ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(critical ? 150 : heavy ? 120 : 95, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + (critical ? 0.28 : 0.16));

    const vol = this.masterVolume * this.sfxVolume * (critical ? 0.38 : heavy ? 0.3 : 0.22);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (critical ? 0.3 : 0.18));

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (critical ? 0.31 : 0.19));
  }

  public playParryClang() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = [880, 1320, 1760];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.92, now + 0.45);
      gain.gain.setValueAtTime(this.masterVolume * this.sfxVolume * (0.2 / (idx + 1)), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.46);
    });
  }

  public playDodge() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(210, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + 0.15);
    gain.gain.setValueAtTime(this.masterVolume * this.sfxVolume * 0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  public playSpellCast(school: string, isSynergy: boolean = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    if (isSynergy) {
      // Dramatic harmonic explosion
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(42, now + 0.55);
      gain.gain.setValueAtTime(this.masterVolume * this.sfxVolume * 0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.56);
    } else if (school === 'graviturgy') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(65, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.35);
      gain.gain.setValueAtTime(this.masterVolume * this.sfxVolume * 0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    } else if (school === 'pyromancy') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.3);
      gain.gain.setValueAtTime(this.masterVolume * this.sfxVolume * 0.26, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
    } else if (school === 'vitalism') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(330, now);
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.35);
      gain.gain.setValueAtTime(this.masterVolume * this.sfxVolume * 0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.25);
      gain.gain.setValueAtTime(this.masterVolume * this.sfxVolume * 0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
    }

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.6);
  }

  public playShrineChime() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    [220, 277.18, 329.63, 440].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.08);
      gain.gain.setValueAtTime(this.masterVolume * this.sfxVolume * 0.16, now + i * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.7);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.08);
      osc.stop(now + i * 0.08 + 0.72);
    });
  }

  public playFootstep() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(75 + Math.random() * 20, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.045);
    gain.gain.setValueAtTime(this.masterVolume * this.sfxVolume * 0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.055);
  }
}

export const audioEngine = new DarkFantasyAudioEngine();
