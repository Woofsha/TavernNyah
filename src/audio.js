/**
 * Nyah & Fifi's Tavern — Procedural Web Audio Engine (src/audio.js)
 * 
 * Complete zero-asset procedural Web Audio synthesizer:
 * - Generative cozy Stardew-Valley-style tavern music with smooth day/night shifts
 *   (morning bright G-major acoustic plucks, afternoon warm pastoral plucks & counter-melody,
 *    evening lively D-mixolydian hearth groove & reel flute, night slow dreamy lullaby pad & harmonics)
 * - Dynamic Musician Stem (smoothly fades in extra bright lute/mandolin arpeggio & counter-melody)
 * - Subtle ambient hearth crackle & crowd murmur scaled by crowdCount (0..25)
 * - Tactile procedural SFX (coins, mugs, door bells, footsteps, cooking sizzle, UI, voice blips)
 * - Clean ES module, zero external assets, browser-autoplay safe, headless-safe.
 */

// Pitch converter: MIDI note number to frequency in Hertz
function m2f(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// Day phase musical presets and compositions
const PHASE_DATA = {
  morning: {
    targetBpm: 76,
    // 4 bars of G major / pentatonic progression
    chords: [
      { bass: 43, root: 55, arps: [55, 59, 62, 67, 71] }, // G major (G2 bass, G3 root)
      { bass: 48, root: 48, arps: [48, 52, 55, 59, 64] }, // Cmaj7 (C3 bass)
      { bass: 40, root: 52, arps: [52, 55, 59, 62, 67] }, // Em7 (E2 bass, E3 root)
      { bass: 50, root: 50, arps: [50, 54, 57, 62, 66] }  // D (D3 bass)
    ],
    // Airy flute phrases with rests so music breathes naturally
    flutePhrases: [
      // Variation 1
      [
        { step: 8, note: 71, dur: 3 },  // B4
        { step: 12, note: 74, dur: 3 }, // D5
        { step: 16, note: 76, dur: 5 }, // E5
        { step: 22, note: 79, dur: 4 }, // G5
        { step: 26, note: 76, dur: 3 }, // E5
        { step: 30, note: 74, dur: 4 }, // D5
        { step: 34, note: 71, dur: 4 }, // B4
        { step: 40, note: 69, dur: 3 }, // A4
        { step: 44, note: 67, dur: 6 }  // G4
      ],
      // Variation 2
      [
        { step: 18, note: 74, dur: 3 }, // D5
        { step: 22, note: 76, dur: 3 }, // E5
        { step: 26, note: 79, dur: 4 }, // G5
        { step: 32, note: 81, dur: 5 }, // A5
        { step: 38, note: 79, dur: 3 }, // G5
        { step: 42, note: 76, dur: 4 }, // E5
        { step: 48, note: 74, dur: 4 }, // D5
        { step: 54, note: 71, dur: 3 }, // B4
        { step: 58, note: 67, dur: 5 }  // G4
      ],
      // Variation 3 (breathing rest)
      [
        { step: 4, note: 67, dur: 4 },  // G4
        { step: 12, note: 71, dur: 4 }, // B4
        { step: 20, note: 74, dur: 6 }, // D5
        { step: 36, note: 76, dur: 4 }, // E5
        { step: 44, note: 74, dur: 4 }, // D5
        { step: 52, note: 67, dur: 8 }  // G4
      ],
      // Variation 4 (full rest bar: guitar and tavern ambiance only)
      []
    ],
    // Musician lute stem (bright 16th arpeggio runs)
    luteRuns: [
      [71, 74, 79, 83], // G arpeggio
      [72, 76, 79, 84], // C arpeggio
      [71, 74, 76, 83], // Em arpeggio
      [69, 74, 78, 81]  // D arpeggio
    ]
  },
  afternoon: {
    targetBpm: 84,
    // Warm C/G pastoral chordal progression
    chords: [
      { bass: 48, root: 48, arps: [48, 55, 60, 64, 71] }, // Cmaj7 (C3 bass)
      { bass: 47, root: 47, arps: [47, 50, 55, 62, 67] }, // G/B (B2 bass)
      { bass: 45, root: 45, arps: [45, 52, 57, 60, 64] }, // Am7 (A2 bass)
      { bass: 41, root: 50, arps: [41, 48, 53, 57, 62] }  // Fmaj7 -> G (F2 bass)
    ],
    flutePhrases: [
      [
        { step: 8, note: 76, dur: 4 },  // E5
        { step: 12, note: 79, dur: 4 }, // G5
        { step: 16, note: 71, dur: 5 }, // B4
        { step: 24, note: 69, dur: 4 }, // A4
        { step: 28, note: 67, dur: 4 }, // G4
        { step: 34, note: 72, dur: 4 }, // C5
        { step: 40, note: 76, dur: 4 }, // E5
        { step: 46, note: 74, dur: 5 }, // D5
        { step: 54, note: 67, dur: 8 }  // G4
      ],
      [
        { step: 4, note: 67, dur: 4 },  // G4
        { step: 10, note: 72, dur: 4 }, // C5
        { step: 16, note: 76, dur: 5 }, // E5
        { step: 26, note: 74, dur: 4 }, // D5
        { step: 32, note: 69, dur: 5 }, // A4
        { step: 40, note: 71, dur: 4 }, // B4
        { step: 46, note: 72, dur: 6 }  // C5
      ],
      []
    ],
    luteRuns: [
      [72, 76, 79, 84], // C
      [71, 74, 79, 83], // G
      [69, 72, 76, 81], // Am
      [69, 74, 77, 81]  // F/G
    ]
  },
  evening: {
    targetBpm: 94,
    // Lively D-mixolydian / G-major warm hearth groove
    chords: [
      { bass: 38, root: 50, arps: [50, 54, 57, 62] }, // D (D2 bass, D3 root)
      { bass: 36, root: 48, arps: [48, 52, 55, 60] }, // C (C2 bass, C3 root)
      { bass: 43, root: 55, arps: [55, 59, 62, 67] }, // G (G2 bass, G3 root)
      { bass: 38, root: 50, arps: [50, 54, 57, 62] }  // D (D2 bass, D3 root)
    ],
    flutePhrases: [
      // Lively Irish / Celtic tavern reel
      [
        { step: 0, note: 74, dur: 2 },  // D5
        { step: 2, note: 78, dur: 2 },  // F#5
        { step: 4, note: 81, dur: 2 },  // A5
        { step: 6, note: 78, dur: 2 },  // F#5
        { step: 8, note: 74, dur: 3 },  // D5
        { step: 12, note: 76, dur: 3 }, // E5
        { step: 16, note: 72, dur: 2 }, // C5
        { step: 18, note: 76, dur: 2 }, // E5
        { step: 20, note: 79, dur: 2 }, // G5
        { step: 22, note: 76, dur: 2 }, // E5
        { step: 24, note: 72, dur: 3 }, // C5
        { step: 28, note: 74, dur: 3 }, // D5
        { step: 32, note: 71, dur: 2 }, // B4
        { step: 34, note: 74, dur: 2 }, // D5
        { step: 36, note: 79, dur: 3 }, // G5
        { step: 40, note: 83, dur: 3 }, // B5
        { step: 44, note: 81, dur: 3 }, // A5
        { step: 48, note: 78, dur: 3 }, // F#5
        { step: 52, note: 74, dur: 3 }, // D5
        { step: 56, note: 74, dur: 4 }  // D5
      ],
      // Alternate reel flourish
      [
        { step: 4, note: 81, dur: 2 },  // A5
        { step: 6, note: 79, dur: 2 },  // G5
        { step: 8, note: 78, dur: 3 },  // F#5
        { step: 12, note: 74, dur: 3 }, // D5
        { step: 18, note: 76, dur: 2 }, // E5
        { step: 20, note: 79, dur: 3 }, // G5
        { step: 24, note: 72, dur: 4 }, // C5
        { step: 32, note: 79, dur: 3 }, // G5
        { step: 36, note: 83, dur: 3 }, // B5
        { step: 40, note: 81, dur: 4 }, // A5
        { step: 46, note: 78, dur: 3 }, // F#5
        { step: 50, note: 74, dur: 5 }  // D5
      ],
      []
    ],
    luteRuns: [
      [74, 78, 81, 86], // D
      [72, 76, 79, 84], // C
      [71, 74, 79, 83], // G
      [74, 78, 81, 86]  // D
    ]
  },
  night: {
    targetBpm: 64,
    // Slow Fmaj7 / Cmaj7 dreamy lullaby
    chords: [
      { bass: 41, root: 53, arps: [41, 48, 57, 64] },     // Fmaj7 (F2 bass, F3 root)
      { bass: 36, root: 48, arps: [48, 55, 60, 64, 71] }, // Cmaj7 (C2 bass, C3 root)
      { bass: 38, root: 50, arps: [50, 57, 62, 65, 72] }, // Dm7 (D2 bass, D3 root)
      { bass: 36, root: 48, arps: [48, 55, 60, 64, 67] }  // Cmaj7 (C2 bass, C3 root)
    ],
    // High dreamy music box bell harmonics
    bellTones: [
      { step: 4, note: 76 },  // E5
      { step: 12, note: 81 }, // A5
      { step: 20, note: 83 }, // B5
      { step: 28, note: 84 }, // C6
      { step: 36, note: 81 }, // A5
      { step: 44, note: 77 }, // F5
      { step: 52, note: 76 }, // E5
      { step: 60, note: 72 }  // C5
    ],
    flutePhrases: [
      [
        { step: 16, note: 65, dur: 6 }, // F4
        { step: 24, note: 64, dur: 8 }, // E4
        { step: 48, note: 62, dur: 6 }, // D4
        { step: 56, note: 60, dur: 8 }  // C4
      ],
      []
    ],
    luteRuns: [
      [77, 81, 84, 88], // F
      [76, 79, 83, 88], // C
      [74, 77, 81, 86], // Dm
      [72, 76, 79, 84]  // C
    ]
  }
};

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.isUnlocked = false;
    this._listenersAttached = false;

    // Volume state
    this.masterVolume = 0.75;
    this.musicVolume = 0.70;
    this.sfxVolume = 0.85;
    this.muted = false;

    // Bus gain nodes
    this.masterGain = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicianGain = null;
    this.ambientGain = null;
    this.hearthGain = null;
    this.crowdGain = null;

    // Generative music engine state
    this.currentPhase = 'morning';
    this.bpm = 76;
    this.targetBpm = 76;
    this.step = 0;              // 0..63 (4 bars of 16 sixteenth-notes)
    this.nextStepTime = 0;
    this.phraseIndex = 0;
    this.barCycle = 0;
    this.isMusicianPerforming = false;
    this.crowdCount = 0;
    this.hasFireplace = true;

    // Procedural ambient timers
    this.fireCrackleTimer = 0;
    this.nextCrackleTime = 1.0;

    // Reusable noise buffer
    this.noiseBuffer = null;
  }

  /**
   * Initializes / unlocks the Web Audio context on user gesture.
   * Safe no-op in headless test environments (e.g. Node.js).
   */
  init() {
    if (typeof window === 'undefined') return false;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return false;

    if (!this._listenersAttached) {
      this._listenersAttached = true;
      const unlockHandler = () => {
        this.unlock();
      };
      ['pointerdown', 'keydown', 'touchstart'].forEach(evt => {
        window.addEventListener(evt, unlockHandler, { once: true, passive: true });
      });
    }

    if (!this.ctx) {
      try {
        this.ctx = new AudioCtx();
        this._buildGraph();
      } catch {
        return false;
      }
    }

    if (this.ctx && this.ctx.state === 'running') {
      this.isUnlocked = true;
    }
    return true;
  }

  /**
   * Resumes a suspended AudioContext after a user gesture.
   */
  unlock() {
    const ok = this.init();
    if (!ok || !this.ctx) return false;

    if (this.ctx.state === 'suspended') {
      this.ctx.resume().then(() => {
        this.isUnlocked = (this.ctx && this.ctx.state === 'running');
      }).catch(() => {});
    } else if (this.ctx.state === 'running') {
      this.isUnlocked = true;
    }
    return true;
  }

  // --- Volume and Settings ---

  setMasterVolume(v) {
    this.masterVolume = Math.max(0, Math.min(1, Number(v) || 0));
    if (this.masterGain && this.ctx) {
      const target = this.muted ? 0 : this.masterVolume;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.04);
    }
  }

  setMusicVolume(v) {
    this.musicVolume = Math.max(0, Math.min(1, Number(v) || 0));
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(this.musicVolume, this.ctx.currentTime, 0.04);
    }
  }

  setSfxVolume(v) {
    this.sfxVolume = Math.max(0, Math.min(1, Number(v) || 0));
    if (this.sfxGain && this.ctx) {
      this.sfxGain.gain.setTargetAtTime(this.sfxVolume, this.ctx.currentTime, 0.04);
    }
  }

  setMuted(bool) {
    this.muted = !!bool;
    if (this.masterGain && this.ctx) {
      const target = this.muted ? 0 : this.masterVolume;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.04);
    }
  }

  getState() {
    return {
      masterVolume: this.masterVolume,
      musicVolume: this.musicVolume,
      sfxVolume: this.sfxVolume,
      muted: this.muted
    };
  }

  applySettings(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (typeof obj.masterVolume === 'number') this.setMasterVolume(obj.masterVolume);
    if (typeof obj.musicVolume === 'number') this.setMusicVolume(obj.musicVolume);
    if (typeof obj.sfxVolume === 'number') this.setSfxVolume(obj.sfxVolume);
    if (typeof obj.muted === 'boolean') this.setMuted(obj.muted);
  }

  // --- Internal Audio Graph Construction ---

  _buildGraph() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Master bus
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.masterVolume, now);
    this.masterGain.connect(this.ctx.destination);

    // Music bus
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.setValueAtTime(this.musicVolume, now);
    this.musicGain.connect(this.masterGain);

    // SFX bus
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(this.sfxVolume, now);
    this.sfxGain.connect(this.masterGain);

    // Dynamic Musician stem (connects to Music bus, starts silent at gain 0)
    this.musicianGain = this.ctx.createGain();
    this.musicianGain.gain.setValueAtTime(0.0, now);
    this.musicianGain.connect(this.musicGain);

    // Ambient bus
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.setValueAtTime(1.0, now);
    this.ambientGain.connect(this.musicGain);

    // Ambient hearth crackle/rumble bus
    this.hearthGain = this.ctx.createGain();
    this.hearthGain.gain.setValueAtTime(0.04, now);
    this.hearthGain.connect(this.ambientGain);

    // Ambient crowd murmur bus
    this.crowdGain = this.ctx.createGain();
    this.crowdGain.gain.setValueAtTime(0.0, now);
    this.crowdGain.connect(this.ambientGain);

    this._createNoiseBuffer();
    this._startAmbientBackground();
  }

  _createNoiseBuffer() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate || 44100;
    const length = sampleRate * 3; // 3-second buffer
    this.noiseBuffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      // Gentle warm pinking filter
      lastOut = (lastOut + 0.025 * white) / 1.025;
      data[i] = lastOut * 3.5;
    }
  }

  _startAmbientBackground() {
    if (!this.ctx || !this.noiseBuffer) return;

    try {
      // Warm continuous hearth low rumble
      const hearthSource = this.ctx.createBufferSource();
      hearthSource.buffer = this.noiseBuffer;
      hearthSource.loop = true;

      const hearthFilter = this.ctx.createBiquadFilter();
      hearthFilter.type = 'lowpass';
      hearthFilter.frequency.setValueAtTime(130, this.ctx.currentTime);

      hearthSource.connect(hearthFilter);
      hearthFilter.connect(this.hearthGain);
      hearthSource.start(0);

      // Distant tavern crowd murmur loops (parallel formants)
      const crowdSource = this.ctx.createBufferSource();
      crowdSource.buffer = this.noiseBuffer;
      crowdSource.loop = true;

      const crowdFilter1 = this.ctx.createBiquadFilter();
      crowdFilter1.type = 'bandpass';
      crowdFilter1.frequency.setValueAtTime(450, this.ctx.currentTime);
      crowdFilter1.Q.setValueAtTime(2.2, this.ctx.currentTime);

      const crowdFilter2 = this.ctx.createBiquadFilter();
      crowdFilter2.type = 'bandpass';
      crowdFilter2.frequency.setValueAtTime(950, this.ctx.currentTime);
      crowdFilter2.Q.setValueAtTime(3.0, this.ctx.currentTime);

      crowdSource.connect(crowdFilter1);
      crowdSource.connect(crowdFilter2);
      crowdFilter1.connect(this.crowdGain);
      crowdFilter2.connect(this.crowdGain);
      crowdSource.start(0);
    } catch {
      // Safe fallback if audio hardware prevents looping sources
    }
  }

  // --- Generative Music Engine & Scheduler ---

  /**
   * Updates audio synthesis state. Called each frame/tick from main loop.
   * @param {number} dt Frame delta time in seconds
   * @param {string} [dayPhase='morning'] 'morning' | 'afternoon' | 'evening' | 'night'
   * @param {boolean} [isMusicianPerforming=false] Whether entertainer is on stage
   * @param {number} [crowdCount=0] Number of patrons in tavern (0..25)
   */
  update(dt, dayPhase = 'morning', isMusicianPerforming = false, crowdCount = 0) {
    this.currentPhase = (dayPhase in PHASE_DATA) ? dayPhase : 'morning';
    this.isMusicianPerforming = !!isMusicianPerforming;
    this.crowdCount = Math.max(0, Math.min(25, Number(crowdCount) || 0));

    // Headless / pre-unlock guard: return safely
    if (!this.ctx || this.ctx.state !== 'running') {
      return;
    }

    const phase = PHASE_DATA[this.currentPhase];
    this.targetBpm = phase.targetBpm;

    // Smooth BPM interpolation
    this.bpm += (this.targetBpm - this.bpm) * Math.min(1, dt * 0.4);

    // Musician layer smooth gain ramp (~1.5s fade in / fade out)
    if (this.musicianGain) {
      const targetMusicianGain = this.isMusicianPerforming ? 0.85 : 0.0;
      this.musicianGain.gain.setTargetAtTime(targetMusicianGain, this.ctx.currentTime, 0.4);
    }

    // Crowd murmur gain scaling
    if (this.crowdGain) {
      const targetCrowd = (this.crowdCount / 25) * 0.08;
      this.crowdGain.gain.setTargetAtTime(targetCrowd, this.ctx.currentTime, 0.25);
    }

    // Procedural hearth crackles
    if (this.hasFireplace) {
      this.fireCrackleTimer += dt;
      if (this.fireCrackleTimer >= this.nextCrackleTime) {
        this.fireCrackleTimer = 0;
        this.nextCrackleTime = 0.8 + Math.random() * 2.2;
        this._playHearthPop(this.ctx.currentTime);
      }
    }

    // Musical step scheduling (16th note grid)
    const scheduleHorizon = this.ctx.currentTime + 0.18;
    const stepDuration = (60 / this.bpm) / 4;

    if (!this.nextStepTime || this.nextStepTime < this.ctx.currentTime - 0.5) {
      this.nextStepTime = this.ctx.currentTime + 0.03;
    }

    while (this.nextStepTime < scheduleHorizon) {
      this._scheduleStep(this.nextStepTime, this.step, phase);
      this.nextStepTime += stepDuration;
      this.step = (this.step + 1) % 64; // 4 bars = 64 sixteenth steps
      if (this.step === 0) {
        this.barCycle = (this.barCycle + 1) % 8;
        this.phraseIndex = (this.phraseIndex + 1) % phase.flutePhrases.length;
      }
    }
  }

  /**
   * Schedules notes for a single 16th-note step across all instrument stems.
   */
  _scheduleStep(time, step, phase) {
    const bar = Math.floor(step / 16);
    const barStep = step % 16;
    const chord = phase.chords[bar % phase.chords.length];

    // 1. Acoustic Pluck / Guitar / Harp Stem
    if (this.currentPhase !== 'night') {
      // Fingerpicking pattern
      if (barStep === 0) {
        // Downbeat root bass note
        this._playPluck(time, m2f(chord.bass), 0.75, 0.18, 2200);
      } else if (barStep === 8) {
        // Alternate bass
        this._playPluck(time, m2f(chord.root), 0.6, 0.14, 2000);
      } else if (barStep === 2 || barStep === 6 || barStep === 10 || barStep === 14) {
        // Arpeggio notes
        const noteIdx = (barStep / 2) % chord.arps.length;
        const midi = chord.arps[noteIdx];
        this._playPluck(time, m2f(midi), 0.45, 0.12, 2600);
      }
    }

    // 2. Evening Groove: Bass Pluck & Rhythmic Hearth Plucks
    if (this.currentPhase === 'evening') {
      if (barStep === 0 || barStep === 8) {
        this._playBass(time, m2f(chord.bass), 0.5, 0.22);
      } else if (barStep === 4 || barStep === 12) {
        this._playBass(time, m2f(chord.root), 0.4, 0.18);
        // Offbeat percussive strum
        this._playPluck(time, m2f(chord.arps[1]), 0.25, 0.10, 3200);
        this._playPluck(time + 0.005, m2f(chord.arps[2]), 0.25, 0.09, 3000);
      }
    }

    // 3. Afternoon: Warm Lowpass Pad on downbeat
    if (this.currentPhase === 'afternoon' && barStep === 0) {
      this._playPad(time, [chord.root, chord.arps[1] || chord.root + 4, chord.arps[2] || chord.root + 7], 3.2, 0.06);
    }

    // 4. Night: Dreamy Lullaby Soft Pad & Bell Harmonics
    if (this.currentPhase === 'night') {
      if (barStep === 0) {
        // Deep root and lush warm pad
        this._playBass(time, m2f(chord.bass), 1.8, 0.15);
        this._playPad(time, [chord.root, chord.arps[1] || chord.root + 4, chord.arps[2] || chord.root + 7], 4.2, 0.08);
      }
      // Sparse music-box bell harmonics
      if (phase.bellTones) {
        for (let i = 0; i < phase.bellTones.length; i++) {
          if (phase.bellTones[i].step === step) {
            this._playHarmonicBell(time, m2f(phase.bellTones[i].note), 2.2, 0.14);
            break;
          }
        }
      }
    }

    // 5. Air Vibrato Flute Melody
    const currentFlutePhrase = phase.flutePhrases[this.phraseIndex % phase.flutePhrases.length];
    if (currentFlutePhrase && currentFlutePhrase.length > 0) {
      for (let i = 0; i < currentFlutePhrase.length; i++) {
        const item = currentFlutePhrase[i];
        if (item.step === step) {
          const stepSec = (60 / this.bpm) / 4;
          const durSec = item.dur * stepSec;
          this._playFlute(time, m2f(item.note), durSec, 0.14);
          break;
        }
      }
    }

    // 6. Dynamic Musician Layer (Lute / Mandolin Stem)
    // Synchronized to the beat; audibility handled smoothly via musicianGain
    const canPlayLute = this.isMusicianPerforming || (this.musicianGain && this.musicianGain.gain.value > 0.01);
    if (canPlayLute && phase.luteRuns) {
      const run = phase.luteRuns[bar % phase.luteRuns.length];
      if (this.currentPhase === 'evening') {
        // Fast 16th-note folk reel mandolin runs
        if (barStep % 2 === 0 || barStep === 3 || barStep === 7 || barStep === 11 || barStep === 15) {
          const luteNote = run[barStep % run.length];
          this._playLute(time, m2f(luteNote), 0.24, 0.16);
        }
      } else if (this.currentPhase === 'morning') {
        // Bright 16th arpeggios
        if (barStep === 0 || barStep === 2 || barStep === 4 || barStep === 6 ||
            barStep === 8 || barStep === 10 || barStep === 12 || barStep === 14) {
          const luteNote = run[(barStep / 2) % run.length];
          this._playLute(time, m2f(luteNote), 0.28, 0.15);
        }
      } else if (this.currentPhase === 'afternoon') {
        // Syncopated pastoral mandolin strum
        if (barStep === 3 || barStep === 7 || barStep === 11 || barStep === 14) {
          const luteNote = run[(barStep) % run.length];
          this._playLute(time, m2f(luteNote), 0.32, 0.15);
        }
      } else if (this.currentPhase === 'night') {
        // Slow cascading harp-like lute arpeggio
        if (barStep === 4 || barStep === 12) {
          const luteNote = run[(barStep / 4) % run.length];
          this._playLute(time, m2f(luteNote), 0.5, 0.12);
        }
      }
    }
  }

  // --- Instrument Synthesizers ---

  /**
   * Acoustic Guitar / Harp Pluck.
   * Dual-oscillator with warm dynamic resonant filter.
   */
  _playPluck(time, freq, duration, gain = 0.15, brightness = 2400) {
    if (!this.ctx || !this.musicGain) return;
    try {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, time);

      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(freq * 2, time);

      const osc2Gain = this.ctx.createGain();
      osc2Gain.gain.setValueAtTime(0.12, time);
      osc2.connect(osc2Gain);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(brightness, time);
      filter.frequency.exponentialRampToValueAtTime(320, time + Math.min(duration, 0.45));
      filter.Q.setValueAtTime(1.6, time);

      env.gain.setValueAtTime(0.0001, time);
      env.gain.linearRampToValueAtTime(gain, time + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc1.connect(filter);
      osc2Gain.connect(filter);
      filter.connect(env);
      env.connect(this.musicGain);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + duration + 0.05);
      osc2.stop(time + duration + 0.05);
    } catch {}
  }

  /**
   * Breathy Vibrato Flute with subtle filtered noise breath.
   */
  _playFlute(time, freq, duration, gain = 0.14) {
    if (!this.ctx || !this.musicGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const oscTriangle = this.ctx.createOscillator();
      const triGain = this.ctx.createGain();
      const env = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      oscTriangle.type = 'triangle';
      oscTriangle.frequency.setValueAtTime(freq, time);
      triGain.gain.setValueAtTime(0.15, time);
      oscTriangle.connect(triGain);

      // Delayed expressive vibrato LFO (~5.3 Hz)
      const vibrato = this.ctx.createOscillator();
      const vibratoGain = this.ctx.createGain();
      vibrato.frequency.setValueAtTime(5.3, time);
      vibratoGain.gain.setValueAtTime(0.0001, time);
      vibratoGain.gain.setValueAtTime(0.0001, time + 0.1);
      vibratoGain.gain.linearRampToValueAtTime(freq * 0.016, time + 0.35);

      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);
      vibratoGain.connect(oscTriangle.frequency);
      vibrato.start(time);
      vibrato.stop(time + duration + 0.05);

      // Breath noise whisper
      let noiseNode = null;
      let noiseEnv = null;
      if (this.noiseBuffer) {
        const noise = this.ctx.createBufferSource();
        noise.buffer = this.noiseBuffer;
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.setValueAtTime(freq, time);
        noiseFilter.Q.setValueAtTime(3.5, time);

        noiseEnv = this.ctx.createGain();
        noiseEnv.gain.setValueAtTime(0.0001, time);
        noiseEnv.gain.linearRampToValueAtTime(0.022, time + 0.05);
        noiseEnv.gain.exponentialRampToValueAtTime(0.0001, time + duration);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseEnv);
        noiseEnv.connect(this.musicGain);
        noise.start(time);
        noise.stop(time + duration + 0.05);
        noiseNode = noise;
      }

      // Main amplitude envelope (soft breath attack and gentle release)
      env.gain.setValueAtTime(0.0001, time);
      env.gain.linearRampToValueAtTime(gain, time + 0.055);
      env.gain.setValueAtTime(gain, time + Math.max(0.06, duration - 0.08));
      env.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc.connect(env);
      triGain.connect(env);
      env.connect(this.musicGain);

      osc.start(time);
      oscTriangle.start(time);
      osc.stop(time + duration + 0.05);
      oscTriangle.stop(time + duration + 0.05);
    } catch {}
  }

  /**
   * Warm Lowpass Pad.
   * Detuned oscillators with warm muffled lowpass filter.
   */
  _playPad(time, notes, duration, gain = 0.06) {
    if (!this.ctx || !this.musicGain) return;
    try {
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(420, time);
      filter.Q.setValueAtTime(0.7, time);

      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, time);
      env.gain.linearRampToValueAtTime(gain, time + 0.7);
      env.gain.setValueAtTime(gain, time + Math.max(0.8, duration - 0.9));
      env.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      filter.connect(env);
      env.connect(this.musicGain);

      notes.forEach((midi, i) => {
        const osc = this.ctx.createOscillator();
        osc.type = i % 2 === 0 ? 'triangle' : 'sawtooth';
        const detune = (i % 2 === 0 ? -4 : 4);
        osc.frequency.setValueAtTime(m2f(midi), time);
        osc.detune.setValueAtTime(detune, time);

        const subGain = this.ctx.createGain();
        subGain.gain.setValueAtTime(0.18, time);
        osc.connect(subGain);
        subGain.connect(filter);

        osc.start(time);
        osc.stop(time + duration + 0.1);
      });
    } catch {}
  }

  /**
   * Acoustic Bass Pluck.
   */
  _playBass(time, freq, duration = 0.5, gain = 0.20) {
    if (!this.ctx || !this.musicGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, time);
      filter.frequency.exponentialRampToValueAtTime(80, time + Math.min(duration, 0.4));

      env.gain.setValueAtTime(0.0001, time);
      env.gain.linearRampToValueAtTime(gain, time + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc.connect(filter);
      filter.connect(env);
      env.connect(this.musicGain);

      osc.start(time);
      osc.stop(time + duration + 0.05);
    } catch {}
  }

  /**
   * Dynamic Musician Lute / Mandolin.
   * Routed to musicianGain for seamless beat-synced fade-in / fade-out.
   */
  _playLute(time, freq, duration = 0.28, gain = 0.15) {
    if (!this.ctx || !this.musicianGain) return;
    try {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, time);

      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(freq, time);
      osc2.detune.setValueAtTime(5, time); // slight double-course string chorusing

      const osc2Gain = this.ctx.createGain();
      osc2Gain.gain.setValueAtTime(0.16, time);
      osc2.connect(osc2Gain);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(4500, time);
      filter.frequency.exponentialRampToValueAtTime(1400, time + Math.min(duration, 0.22));
      filter.Q.setValueAtTime(2.2, time);

      env.gain.setValueAtTime(0.0001, time);
      env.gain.linearRampToValueAtTime(gain, time + 0.002);
      env.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc1.connect(filter);
      osc2Gain.connect(filter);
      filter.connect(env);
      env.connect(this.musicianGain);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + duration + 0.05);
      osc2.stop(time + duration + 0.05);
    } catch {}
  }

  /**
   * Dreamy high bell harmonics for Night lullaby.
   */
  _playHarmonicBell(time, freq, duration = 2.2, gain = 0.12) {
    if (!this.ctx || !this.musicGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const oscOvertone = this.ctx.createOscillator();
      const highpass = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      oscOvertone.type = 'sine';
      oscOvertone.frequency.setValueAtTime(freq * 2.756, time); // bell overtone

      const otGain = this.ctx.createGain();
      otGain.gain.setValueAtTime(0.12, time);
      oscOvertone.connect(otGain);

      highpass.type = 'highpass';
      highpass.frequency.setValueAtTime(400, time);

      env.gain.setValueAtTime(0.0001, time);
      env.gain.linearRampToValueAtTime(gain, time + 0.003);
      env.gain.exponentialRampToValueAtTime(0.0001, time + duration);

      osc.connect(highpass);
      otGain.connect(highpass);
      highpass.connect(env);
      env.connect(this.musicGain);

      osc.start(time);
      oscOvertone.start(time);
      osc.stop(time + duration + 0.05);
      oscOvertone.stop(time + duration + 0.05);
    } catch {}
  }

  /**
   * Tiny procedural warm pop in the hearth.
   */
  _playHearthPop(time) {
    if (!this.ctx || !this.hearthGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();

      const startPitch = 800 + Math.random() * 1200;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(startPitch, time);
      osc.frequency.exponentialRampToValueAtTime(220, time + 0.018);

      env.gain.setValueAtTime(0.0001, time);
      env.gain.linearRampToValueAtTime(0.06, time + 0.002);
      env.gain.exponentialRampToValueAtTime(0.0001, time + 0.022);

      osc.connect(env);
      env.connect(this.hearthGain);

      osc.start(time);
      osc.stop(time + 0.03);
    } catch {}
  }

  // --- Procedural Sound Effects Engine ---

  /**
   * Plays a procedural sound effect.
   * @param {string} type SFX identifier
   * @param {object|string|number} [opts] Options (e.g. { speaker: 'nyah' }, or volume multiplier)
   */
  playSfx(type, opts = {}) {
    if (!this.ctx || this.ctx.state !== 'running' || !this.sfxGain) {
      return;
    }

    let speaker = null;
    let vol = 1.0;
    let pitch = 1.0;

    if (typeof opts === 'string') {
      speaker = opts;
    } else if (typeof opts === 'number') {
      vol = opts;
    } else if (opts && typeof opts === 'object') {
      if (opts.speaker) speaker = String(opts.speaker);
      if (typeof opts.volume === 'number') vol = opts.volume;
      if (typeof opts.pitch === 'number') pitch = opts.pitch;
    }

    const t = this.ctx.currentTime;

    try {
      switch (type) {
        case 'mug_clink':
          this._sfxMugClink(t, vol, pitch);
          break;
        case 'footstep':
          this._sfxFootstep(t, vol, pitch);
          break;
        case 'coin':
          this._sfxCoin(t, vol, pitch);
          break;
        case 'door_bell':
          this._sfxDoorBell(t, vol, pitch);
          break;
        case 'sizzle':
          this._sfxSizzle(t, vol, pitch);
          break;
        case 'fire_crackle':
          this._sfxFireCrackle(t, vol, pitch);
          break;
        case 'ui_click':
          this._sfxUiClick(t, vol, pitch);
          break;
        case 'ui_hover':
          this._sfxUiHover(t, vol, pitch);
          break;
        case 'ui_tab':
          this._sfxUiTab(t, vol, pitch);
          break;
        case 'upgrade':
          this._sfxUpgrade(t, vol, pitch);
          break;
        case 'complaint':
          this._sfxComplaint(t, vol, pitch);
          break;
        case 'blip':
          this._sfxBlip(t, speaker || 'nyah', vol, pitch);
          break;
        default:
          // Default tactile click fallback
          this._sfxUiClick(t, vol, pitch);
          break;
      }
    } catch {}
  }

  // 1. Dual high resonant glass/ceramic ping + foam hiss
  _sfxMugClink(t, vol, pitch) {
    const f1 = 2280 * pitch;
    const f2 = 2920 * pitch;

    // Ping 1
    const osc1 = this.ctx.createOscillator();
    const env1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(f1, t);
    env1.gain.setValueAtTime(0.0001, t);
    env1.gain.linearRampToValueAtTime(0.24 * vol, t + 0.002);
    env1.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc1.connect(env1);
    env1.connect(this.sfxGain);
    osc1.start(t);
    osc1.stop(t + 0.4);

    // Ping 2 (dual clink)
    const t2 = t + 0.016;
    const osc2 = this.ctx.createOscillator();
    const env2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(f2, t2);
    env2.gain.setValueAtTime(0.0001, t2);
    env2.gain.linearRampToValueAtTime(0.20 * vol, t2 + 0.002);
    env2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.28);
    osc2.connect(env2);
    env2.connect(this.sfxGain);
    osc2.start(t2);
    osc2.stop(t2 + 0.32);

    // Foam hiss
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(3800 * pitch, t);
      filter.Q.setValueAtTime(2.4, t);

      const nEnv = this.ctx.createGain();
      nEnv.gain.setValueAtTime(0.0001, t);
      nEnv.gain.linearRampToValueAtTime(0.08 * vol, t + 0.008);
      nEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);

      noise.connect(filter);
      filter.connect(nEnv);
      nEnv.connect(this.sfxGain);
      noise.start(t);
      noise.stop(t + 0.16);
    }
  }

  // 2. Very soft lowpass wood thud
  _sfxFootstep(t, vol, pitch) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(115 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(48 * pitch, t + 0.055);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(240, t);

    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.12 * vol, t + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.065);

    osc.connect(filter);
    filter.connect(env);
    env.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.07);
  }

  // 3. Crisp two-note metallic shimmer (B5 -> E6)
  _sfxCoin(t, vol, pitch) {
    const b5 = 987.77 * pitch;
    const e6 = 1318.51 * pitch;

    // Note 1: B5
    const osc1 = this.ctx.createOscillator();
    const osc1H = this.ctx.createOscillator();
    const env1 = this.ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(b5, t);
    osc1H.type = 'sine';
    osc1H.frequency.setValueAtTime(b5 * 3, t);

    const h1Gain = this.ctx.createGain();
    h1Gain.gain.setValueAtTime(0.18, t);
    osc1H.connect(h1Gain);

    env1.gain.setValueAtTime(0.0001, t);
    env1.gain.linearRampToValueAtTime(0.22 * vol, t + 0.002);
    env1.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);

    osc1.connect(env1);
    h1Gain.connect(env1);
    env1.connect(this.sfxGain);

    osc1.start(t);
    osc1H.start(t);
    osc1.stop(t + 0.2);
    osc1H.stop(t + 0.2);

    // Note 2: E6 (staggered ~0.065s later)
    const t2 = t + 0.065;
    const osc2 = this.ctx.createOscillator();
    const osc2H = this.ctx.createOscillator();
    const env2 = this.ctx.createGain();

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(e6, t2);
    osc2H.type = 'sine';
    osc2H.frequency.setValueAtTime(e6 * 3, t2);

    const h2Gain = this.ctx.createGain();
    h2Gain.gain.setValueAtTime(0.22, t2);
    osc2H.connect(h2Gain);

    env2.gain.setValueAtTime(0.0001, t2);
    env2.gain.linearRampToValueAtTime(0.25 * vol, t2 + 0.002);
    env2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.25);

    osc2.connect(env2);
    h2Gain.connect(env2);
    env2.connect(this.sfxGain);

    osc2.start(t2);
    osc2H.start(t2);
    osc2.stop(t2 + 0.28);
    osc2H.stop(t2 + 0.28);
  }

  // 4. Cozy brass shopkeeper bell chime
  _sfxDoorBell(t, vol, pitch) {
    const d6 = 1174.66 * pitch;
    const a5 = 880.00 * pitch;

    // First strike (D6 + brass overtones)
    const o1 = this.ctx.createOscillator();
    const o1Overtone = this.ctx.createOscillator();
    const env1 = this.ctx.createGain();

    o1.type = 'sine';
    o1.frequency.setValueAtTime(d6, t);
    o1Overtone.type = 'sine';
    o1Overtone.frequency.setValueAtTime(d6 * 2.0, t);

    const otGain1 = this.ctx.createGain();
    otGain1.gain.setValueAtTime(0.18, t);
    o1Overtone.connect(otGain1);

    env1.gain.setValueAtTime(0.0001, t);
    env1.gain.linearRampToValueAtTime(0.24 * vol, t + 0.003);
    env1.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);

    o1.connect(env1);
    otGain1.connect(env1);
    env1.connect(this.sfxGain);

    o1.start(t);
    o1Overtone.start(t);
    o1.stop(t + 0.9);
    o1Overtone.stop(t + 0.9);

    // Second strike (A5 + overtones at t + 0.14s)
    const t2 = t + 0.14;
    const o2 = this.ctx.createOscillator();
    const o2Overtone = this.ctx.createOscillator();
    const env2 = this.ctx.createGain();

    o2.type = 'sine';
    o2.frequency.setValueAtTime(a5, t2);
    o2Overtone.type = 'sine';
    o2Overtone.frequency.setValueAtTime(a5 * 2.0, t2);

    const otGain2 = this.ctx.createGain();
    otGain2.gain.setValueAtTime(0.15, t2);
    o2Overtone.connect(otGain2);

    env2.gain.setValueAtTime(0.0001, t2);
    env2.gain.linearRampToValueAtTime(0.22 * vol, t2 + 0.003);
    env2.gain.exponentialRampToValueAtTime(0.0001, t2 + 1.15);

    o2.connect(env2);
    otGain2.connect(env2);
    env2.connect(this.sfxGain);

    o2.start(t2);
    o2Overtone.start(t2);
    o2.stop(t2 + 1.2);
    o2Overtone.stop(t2 + 1.2);
  }

  // 5. Short bandpass noise pan sizzle
  _sfxSizzle(t, vol, pitch) {
    if (!this.noiseBuffer) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2500 * pitch, t);
    filter.Q.setValueAtTime(2.2, t);

    // AM tremolo flutter simulating bubbling hot skillet
    const am = this.ctx.createOscillator();
    const amGain = this.ctx.createGain();
    am.frequency.setValueAtTime(32, t);
    amGain.gain.setValueAtTime(0.3, t);
    am.connect(amGain.gain);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.20 * vol, t + 0.03);
    env.gain.setValueAtTime(0.18 * vol, t + 0.28);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.44);

    noise.connect(filter);
    filter.connect(env);
    env.connect(this.sfxGain);

    noise.start(t);
    am.start(t);
    noise.stop(t + 0.46);
    am.stop(t + 0.46);
  }

  // 6. Tiny warm pop
  _sfxFireCrackle(t, vol, pitch) {
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1400 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(320 * pitch, t + 0.02);

    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.18 * vol, t + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.025);

    osc.connect(env);
    env.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.03);
  }

  // 7. Tactile wooden UI clicks
  _sfxUiClick(t, vol, pitch) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(720 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(220 * pitch, t + 0.022);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, t);

    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.16 * vol, t + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.026);

    osc.connect(filter);
    filter.connect(env);
    env.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.03);
  }

  _sfxUiHover(t, vol, pitch) {
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1080 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(620 * pitch, t + 0.012);

    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.05 * vol, t + 0.001);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.015);

    osc.connect(env);
    env.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.02);
  }

  _sfxUiTab(t, vol, pitch) {
    // Tactile double micro-tap
    const tap = (delay, f) => {
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      const time = t + delay;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f * pitch, time);
      osc.frequency.exponentialRampToValueAtTime(f * 0.4 * pitch, time + 0.018);

      env.gain.setValueAtTime(0.0001, time);
      env.gain.linearRampToValueAtTime(0.12 * vol, time + 0.002);
      env.gain.exponentialRampToValueAtTime(0.0001, time + 0.022);

      osc.connect(env);
      env.connect(this.sfxGain);
      osc.start(time);
      osc.stop(time + 0.025);
    };

    tap(0, 480);
    tap(0.024, 380);
  }

  // 8. Warm celebratory 4-note triad arpeggio chime (C5 -> E5 -> G5 -> C6)
  _sfxUpgrade(t, vol, pitch) {
    const triad = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    triad.forEach((freq, idx) => {
      const noteTime = t + idx * 0.075;
      const osc = this.ctx.createOscillator();
      const overtone = this.ctx.createOscillator();
      const env = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq * pitch, noteTime);

      overtone.type = 'sine';
      overtone.frequency.setValueAtTime(freq * 2.76 * pitch, noteTime);
      const otGain = this.ctx.createGain();
      otGain.gain.setValueAtTime(0.12, noteTime);
      overtone.connect(otGain);

      env.gain.setValueAtTime(0.0001, noteTime);
      env.gain.linearRampToValueAtTime(0.20 * vol, noteTime + 0.003);
      env.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.52);

      osc.connect(env);
      otGain.connect(env);
      env.connect(this.sfxGain);

      osc.start(noteTime);
      overtone.start(noteTime);
      osc.stop(noteTime + 0.55);
      overtone.stop(noteTime + 0.55);
    });
  }

  // 9. Downward muted grumpy two-tone
  _sfxComplaint(t, vol, pitch) {
    // Note 1: G#3 (~207.65 Hz)
    const o1 = this.ctx.createOscillator();
    const f1 = this.ctx.createBiquadFilter();
    const e1 = this.ctx.createGain();

    o1.type = 'sawtooth';
    o1.frequency.setValueAtTime(207.65 * pitch, t);
    f1.type = 'lowpass';
    f1.frequency.setValueAtTime(380, t);

    e1.gain.setValueAtTime(0.0001, t);
    e1.gain.linearRampToValueAtTime(0.18 * vol, t + 0.008);
    e1.gain.setValueAtTime(0.16 * vol, t + 0.12);
    e1.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);

    o1.connect(f1);
    f1.connect(e1);
    e1.connect(this.sfxGain);

    o1.start(t);
    o1.stop(t + 0.17);

    // Note 2: E3 (~164.81 Hz dropping to ~135 Hz)
    const t2 = t + 0.16;
    const o2 = this.ctx.createOscillator();
    const f2 = this.ctx.createBiquadFilter();
    const e2 = this.ctx.createGain();

    o2.type = 'sawtooth';
    o2.frequency.setValueAtTime(164.81 * pitch, t2);
    o2.frequency.exponentialRampToValueAtTime(135.00 * pitch, t2 + 0.22);
    f2.type = 'lowpass';
    f2.frequency.setValueAtTime(320, t2);

    e2.gain.setValueAtTime(0.0001, t2);
    e2.gain.linearRampToValueAtTime(0.20 * vol, t2 + 0.008);
    e2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.24);

    o2.connect(f2);
    f2.connect(e2);
    e2.connect(this.sfxGain);

    o2.start(t2);
    o2.stop(t2 + 0.26);
  }

  // 10. Dialogue voice blip taking { speaker }
  _sfxBlip(t, speaker, vol, pitch) {
    const s = String(speaker).toLowerCase();
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    let filter = null;
    let dur = 0.045;

    if (s === 'nyah') {
      // Sassy higher triangle/square wave ~540 Hz (inflects 510 -> 560 Hz)
      const baseFreq = 540 * pitch;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq * 0.95, t);
      osc.frequency.linearRampToValueAtTime(baseFreq * 1.05, t + 0.04);
      dur = 0.045;

      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.18 * vol, t + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    } else if (s === 'fifi') {
      // Soft timid sine/triangle wave ~390 Hz
      const baseFreq = 390 * pitch;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, t);
      osc.frequency.linearRampToValueAtTime(baseFreq * 0.96, t + 0.04);
      dur = 0.04;

      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.14 * vol, t + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    } else if (s === 'barnaby') {
      // Gruff low ~190 Hz with lowpass filter
      const baseFreq = 190 * pitch;
      osc.type = 'square';
      osc.frequency.setValueAtTime(baseFreq * 1.05, t);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.92, t + 0.06);
      dur = 0.065;

      filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, t);

      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.20 * vol, t + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    } else {
      // Deterministic seeded variation for hireable staff or patrons
      let hash = 0;
      for (let i = 0; i < s.length; i++) {
        hash = ((hash << 5) - hash) + s.charCodeAt(i);
        hash |= 0;
      }
      const absHash = Math.abs(hash);
      const base = 220 + (absHash % 260); // 220Hz .. 480Hz
      const microJitter = 0.97 + Math.random() * 0.06;
      const freq = base * microJitter * pitch;
      const waveforms = ['sine', 'triangle', 'sawtooth'];
      osc.type = waveforms[absHash % waveforms.length];
      osc.frequency.setValueAtTime(freq, t);
      dur = 0.042;

      filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(800, t);

      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.15 * vol, t + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }

    if (filter) {
      osc.connect(filter);
      filter.connect(env);
    } else {
      osc.connect(env);
    }

    env.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.01);
  }
}
