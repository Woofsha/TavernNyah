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

// Upgraded 8-bar (128-step) compositions for the 'new' expressive music engine
const ENHANCED_PHASE_DATA = {
  morning: {
    targetBpm: 76,
    swingMs: 0.0,
    chords: [
      { bass: 43, root: 55, cello: 43, arps: [55, 59, 62, 66, 69], strum: [55, 59, 62, 69] }, // Gadd9
      { bass: 42, root: 54, cello: 42, arps: [54, 57, 62, 66, 69], strum: [54, 57, 62, 66] }, // D/F#
      { bass: 40, root: 52, cello: 40, arps: [52, 55, 59, 62, 66], strum: [52, 55, 59, 66] }, // Em9
      { bass: 48, root: 52, cello: 48, arps: [48, 55, 59, 62, 64], strum: [48, 55, 59, 62] }, // Cmaj9
      { bass: 43, root: 55, cello: 43, arps: [55, 59, 62, 67, 69], strum: [55, 59, 62, 69] }, // Gadd9
      { bass: 47, root: 54, cello: 47, arps: [47, 54, 57, 62, 66], strum: [47, 54, 57, 62] }, // Bm7
      { bass: 45, root: 52, cello: 45, arps: [45, 52, 55, 59, 64], strum: [45, 52, 55, 64] }, // Am9
      { bass: 38, root: 50, cello: 50, arps: [50, 54, 57, 62, 66], strum: [50, 54, 57, 62] }  // D
    ],
    flutePhrases: [
      [
        { step: 8, note: 71, dur: 4, scoop: true },
        { step: 12, note: 74, dur: 4 },
        { step: 16, note: 78, dur: 4, scoop: true },
        { step: 20, note: 81, dur: 4 },
        { step: 24, note: 74, dur: 4 },
        { step: 28, note: 76, dur: 4 },
        { step: 32, note: 79, dur: 6, scoop: true },
        { step: 38, note: 78, dur: 4 },
        { step: 42, note: 76, dur: 5 },
        { step: 48, note: 74, dur: 6 },
        { step: 54, note: 76, dur: 4 },
        { step: 58, note: 79, dur: 6 },
        { step: 64, note: 83, dur: 6, scoop: true },
        { step: 70, note: 81, dur: 4 },
        { step: 74, note: 79, dur: 5 },
        { step: 80, note: 78, dur: 6 },
        { step: 86, note: 74, dur: 4 },
        { step: 90, note: 71, dur: 5 },
        { step: 96, note: 76, dur: 6, scoop: true },
        { step: 102, note: 72, dur: 4 },
        { step: 106, note: 71, dur: 5 },
        { step: 112, note: 69, dur: 6 },
        { step: 118, note: 74, dur: 8 }
      ],
      [
        { step: 12, note: 74, dur: 4, scoop: true },
        { step: 16, note: 78, dur: 5 },
        { step: 22, note: 76, dur: 4 },
        { step: 26, note: 74, dur: 5 },
        { step: 32, note: 71, dur: 6 },
        { step: 38, note: 74, dur: 5 },
        { step: 44, note: 76, dur: 4 },
        { step: 48, note: 79, dur: 8, scoop: true },
        { step: 68, note: 74, dur: 4 },
        { step: 72, note: 76, dur: 4 },
        { step: 76, note: 79, dur: 4 },
        { step: 80, note: 78, dur: 6, scoop: true },
        { step: 86, note: 74, dur: 6 },
        { step: 96, note: 72, dur: 6 },
        { step: 102, note: 71, dur: 4 },
        { step: 106, note: 69, dur: 5 },
        { step: 112, note: 69, dur: 6 },
        { step: 120, note: 67, dur: 8 }
      ],
      []
    ],
    luteRuns: [
      [71, 74, 79, 83],
      [69, 74, 78, 81],
      [71, 74, 76, 83],
      [72, 76, 79, 84],
      [71, 74, 79, 83],
      [71, 74, 78, 83],
      [69, 72, 76, 83],
      [69, 74, 78, 81]
    ]
  },
  afternoon: {
    targetBpm: 84,
    swingMs: 0.009,
    chords: [
      { bass: 48, root: 55, cello: 48, arps: [48, 55, 59, 62, 64], strum: [48, 55, 59, 64] }, // Cmaj9
      { bass: 47, root: 55, cello: 47, arps: [47, 50, 55, 59, 62], strum: [47, 50, 55, 62] }, // G/B
      { bass: 45, root: 52, cello: 45, arps: [45, 52, 55, 60, 64], strum: [45, 52, 55, 60] }, // Am7
      { bass: 43, root: 52, cello: 43, arps: [43, 52, 55, 59, 62], strum: [43, 52, 55, 59] }, // Em7/G
      { bass: 41, root: 48, cello: 41, arps: [41, 48, 53, 57, 60], strum: [41, 48, 53, 60] }, // Fmaj9
      { bass: 40, root: 48, cello: 40, arps: [40, 48, 55, 60, 64], strum: [40, 48, 55, 60] }, // C/E
      { bass: 38, root: 50, cello: 38, arps: [38, 50, 57, 60, 64], strum: [38, 50, 57, 64] }, // Dm9
      { bass: 43, root: 55, cello: 43, arps: [43, 50, 53, 57, 62], strum: [43, 50, 55, 62] }  // G13
    ],
    flutePhrases: [
      [
        { step: 8, note: 76, dur: 4, scoop: true },
        { step: 12, note: 79, dur: 4 },
        { step: 16, note: 83, dur: 6, scoop: true },
        { step: 22, note: 81, dur: 4 },
        { step: 26, note: 79, dur: 5 },
        { step: 32, note: 76, dur: 6 },
        { step: 38, note: 72, dur: 5 },
        { step: 44, note: 76, dur: 4 },
        { step: 48, note: 79, dur: 6 },
        { step: 54, note: 76, dur: 4 },
        { step: 58, note: 74, dur: 5 },
        { step: 64, note: 72, dur: 6, scoop: true },
        { step: 70, note: 76, dur: 4 },
        { step: 74, note: 79, dur: 5 },
        { step: 80, note: 76, dur: 6 },
        { step: 86, note: 79, dur: 4 },
        { step: 90, note: 72, dur: 5 },
        { step: 96, note: 77, dur: 6, scoop: true },
        { step: 102, note: 76, dur: 4 },
        { step: 106, note: 74, dur: 5 },
        { step: 112, note: 74, dur: 6 },
        { step: 118, note: 71, dur: 4 },
        { step: 122, note: 67, dur: 6 }
      ],
      [
        { step: 4, note: 67, dur: 4 },
        { step: 10, note: 72, dur: 5, scoop: true },
        { step: 16, note: 76, dur: 6 },
        { step: 24, note: 74, dur: 4 },
        { step: 32, note: 72, dur: 6 },
        { step: 40, note: 69, dur: 6 },
        { step: 48, note: 71, dur: 6, scoop: true },
        { step: 56, note: 74, dur: 6 },
        { step: 68, note: 76, dur: 4 },
        { step: 74, note: 79, dur: 6 },
        { step: 84, note: 76, dur: 6 },
        { step: 96, note: 74, dur: 6 },
        { step: 104, note: 72, dur: 6 },
        { step: 112, note: 71, dur: 6 },
        { step: 120, note: 72, dur: 8 }
      ],
      []
    ],
    luteRuns: [
      [72, 76, 79, 84],
      [71, 74, 79, 83],
      [69, 72, 76, 81],
      [71, 76, 79, 83],
      [69, 72, 77, 81],
      [72, 76, 79, 84],
      [69, 74, 77, 81],
      [71, 74, 79, 83]
    ]
  },
  evening: {
    targetBpm: 94,
    swingMs: 0.012,
    chords: [
      { bass: 38, fifth: 45, root: 50, cello: 50, arps: [50, 54, 57, 62, 64], strum: [50, 54, 57, 62] }, // D
      { bass: 36, fifth: 43, root: 48, cello: 48, arps: [48, 52, 55, 60, 62], strum: [48, 52, 55, 62] }, // Cadd9
      { bass: 47, fifth: 43, root: 55, cello: 43, arps: [47, 50, 55, 59, 62], strum: [47, 50, 55, 62] }, // G/B
      { bass: 45, fifth: 38, root: 50, cello: 45, arps: [45, 50, 54, 57, 62], strum: [50, 54, 57, 62] }, // D/A
      { bass: 38, fifth: 45, root: 50, cello: 50, arps: [50, 54, 57, 62, 66], strum: [50, 54, 57, 66] }, // D
      { bass: 36, fifth: 43, root: 48, cello: 48, arps: [48, 52, 55, 60, 64], strum: [48, 52, 55, 64] }, // Cadd9
      { bass: 45, fifth: 40, root: 52, cello: 45, arps: [45, 52, 55, 60, 64], strum: [45, 52, 55, 60] }, // Am7
      { bass: 45, fifth: 38, root: 50, cello: 50, arps: [45, 50, 54, 57, 62], strum: [50, 54, 57, 62] }  // D/A -> D
    ],
    flutePhrases: [
      [
        { step: 0, note: 74, dur: 2 },
        { step: 2, note: 76, dur: 2 },
        { step: 4, note: 78, dur: 2, scoop: true },
        { step: 6, note: 81, dur: 2 },
        { step: 8, note: 78, dur: 3 },
        { step: 12, note: 74, dur: 3 },
        { step: 16, note: 72, dur: 2 },
        { step: 18, note: 76, dur: 2 },
        { step: 20, note: 79, dur: 2, scoop: true },
        { step: 22, note: 76, dur: 2 },
        { step: 24, note: 74, dur: 3 },
        { step: 28, note: 72, dur: 3 },
        { step: 32, note: 71, dur: 2 },
        { step: 34, note: 74, dur: 2 },
        { step: 36, note: 79, dur: 2 },
        { step: 38, note: 83, dur: 2, scoop: true },
        { step: 40, note: 79, dur: 3 },
        { step: 44, note: 74, dur: 3 },
        { step: 48, note: 81, dur: 2 },
        { step: 50, note: 79, dur: 2 },
        { step: 52, note: 78, dur: 2 },
        { step: 54, note: 76, dur: 2 },
        { step: 56, note: 74, dur: 5 },
        { step: 64, note: 78, dur: 2, scoop: true },
        { step: 66, note: 81, dur: 2 },
        { step: 68, note: 86, dur: 3 },
        { step: 72, note: 81, dur: 3 },
        { step: 76, note: 78, dur: 3 },
        { step: 80, note: 79, dur: 2 },
        { step: 82, note: 76, dur: 2 },
        { step: 84, note: 72, dur: 3 },
        { step: 88, note: 74, dur: 3 },
        { step: 92, note: 76, dur: 3 },
        { step: 96, note: 81, dur: 2, scoop: true },
        { step: 98, note: 79, dur: 2 },
        { step: 100, note: 76, dur: 3 },
        { step: 104, note: 79, dur: 3 },
        { step: 108, note: 83, dur: 3 },
        { step: 112, note: 81, dur: 3 },
        { step: 116, note: 78, dur: 3 },
        { step: 120, note: 74, dur: 6 }
      ],
      [
        { step: 4, note: 81, dur: 2, scoop: true },
        { step: 6, note: 79, dur: 2 },
        { step: 8, note: 78, dur: 3 },
        { step: 12, note: 74, dur: 3 },
        { step: 18, note: 76, dur: 2 },
        { step: 20, note: 79, dur: 3 },
        { step: 24, note: 72, dur: 4 },
        { step: 32, note: 79, dur: 3, scoop: true },
        { step: 36, note: 83, dur: 3 },
        { step: 40, note: 81, dur: 4 },
        { step: 48, note: 78, dur: 3 },
        { step: 52, note: 74, dur: 5 },
        { step: 68, note: 74, dur: 2 },
        { step: 70, note: 78, dur: 2 },
        { step: 72, note: 81, dur: 4, scoop: true },
        { step: 80, note: 79, dur: 3 },
        { step: 84, note: 76, dur: 3 },
        { step: 88, note: 72, dur: 4 },
        { step: 96, note: 76, dur: 3 },
        { step: 100, note: 79, dur: 3 },
        { step: 104, note: 81, dur: 4 },
        { step: 112, note: 78, dur: 3 },
        { step: 118, note: 74, dur: 6 }
      ],
      []
    ],
    luteRuns: [
      [74, 78, 81, 86],
      [72, 76, 79, 84],
      [71, 74, 79, 83],
      [74, 78, 81, 86],
      [74, 78, 81, 86],
      [72, 76, 79, 84],
      [69, 72, 76, 81],
      [74, 78, 81, 86]
    ]
  },
  night: {
    targetBpm: 62,
    swingMs: 0.0,
    chords: [
      { bass: 41, root: 53, cello: 41, arps: [41, 48, 57, 60, 64], strum: [53, 57, 60, 64] }, // Fmaj9
      { bass: 40, root: 52, cello: 40, arps: [40, 48, 55, 59, 64], strum: [52, 55, 59, 64] }, // Cmaj7/E
      { bass: 38, root: 50, cello: 38, arps: [38, 50, 57, 60, 64], strum: [50, 57, 60, 64] }, // Dm9
      { bass: 36, root: 48, cello: 36, arps: [48, 55, 57, 60, 64], strum: [48, 55, 57, 60] }, // C6
      { bass: 46, root: 53, cello: 46, arps: [46, 53, 57, 62, 65], strum: [53, 57, 62, 65] }, // Bbmaj7
      { bass: 45, root: 53, cello: 45, arps: [45, 53, 57, 60, 65], strum: [53, 57, 60, 65] }, // F/A
      { bass: 43, root: 50, cello: 43, arps: [43, 50, 53, 58, 62], strum: [50, 53, 58, 62] }, // Gm7
      { bass: 36, root: 48, cello: 36, arps: [48, 50, 55, 60, 67], strum: [48, 50, 55, 60] }  // Csus2
    ],
    bellTones: [
      { step: 4, note: 76 },
      { step: 12, note: 81 },
      { step: 20, note: 83 },
      { step: 28, note: 79 },
      { step: 36, note: 81 },
      { step: 44, note: 77 },
      { step: 52, note: 76 },
      { step: 60, note: 72 },
      { step: 68, note: 74 },
      { step: 76, note: 77 },
      { step: 84, note: 81 },
      { step: 92, note: 79 },
      { step: 100, note: 77 },
      { step: 108, note: 74 },
      { step: 116, note: 76 },
      { step: 124, note: 72 }
    ],
    flutePhrases: [
      [
        { step: 64, note: 65, dur: 8, scoop: true },
        { step: 80, note: 69, dur: 8 },
        { step: 96, note: 67, dur: 8 },
        { step: 112, note: 64, dur: 10 }
      ],
      []
    ],
    luteRuns: [
      [77, 81, 84, 88],
      [76, 79, 83, 88],
      [74, 77, 81, 86],
      [72, 76, 79, 84],
      [74, 77, 81, 86],
      [72, 77, 81, 84],
      [70, 74, 77, 82],
      [72, 74, 79, 84]
    ]
  }
};

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.isUnlocked = false;
    this._listenersAttached = false;

    // Volume & music style state ('new' = warm hall acoustics & 8-bar stems, 'old' = classic dry synth)
    this.masterVolume = 0.75;
    this.musicVolume = 0.70;
    this.sfxVolume = 0.85;
    this.muted = false;
    this.musicStyle = 'new';

    // Bus gain & acoustic processing nodes
    this.masterGain = null;
    this.masterCompressor = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.musicianGain = null;
    this.ambientGain = null;
    this.hearthGain = null;
    this.crowdGain = null;
    this.reverbInput = null;
    this.reverbNode = null;
    this.reverbWetGain = null;

    // Generative music engine state
    this.currentPhase = 'morning';
    this.bpm = 76;
    this.targetBpm = 76;
    this.step = 0;              // 0..63 ('old') or 0..127 ('new')
    this.nextStepTime = 0;
    this.phraseIndex = 0;
    this.barCycle = 0;
    this.isMusicianPerforming = false;
    this.crowdCount = 0;
    this.hasFireplace = true;

    // Procedural ambient timers
    this.fireCrackleTimer = 0;
    this.nextCrackleTime = 1.0;

    // SFX burst throttle timestamps keyed by SFX type
    this._sfxLastAt = new Map();

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

  setMusicStyle(style) {
    const nextStyle = style === 'old' ? 'old' : 'new';
    if (this.musicStyle === nextStyle) return;
    this.musicStyle = nextStyle;
    // Keep rhythm continuous across live A/B toggle without out-of-range phrase/step indexes
    this.step = nextStyle === 'old' ? (this.step % 64) : (this.step % 128);
    if (this.ctx && this.reverbWetGain) {
      const wetTarget = nextStyle === 'new' ? 0.26 : 0.0;
      this.reverbWetGain.gain.setTargetAtTime(wetTarget, this.ctx.currentTime, 0.06);
    }
  }

  getState() {
    return {
      masterVolume: this.masterVolume,
      musicVolume: this.musicVolume,
      sfxVolume: this.sfxVolume,
      muted: this.muted,
      musicStyle: this.musicStyle
    };
  }

  applySettings(obj) {
    if (!obj || typeof obj !== 'object') return;
    if (typeof obj.masterVolume === 'number') this.setMasterVolume(obj.masterVolume);
    if (typeof obj.musicVolume === 'number') this.setMusicVolume(obj.musicVolume);
    if (typeof obj.sfxVolume === 'number') this.setSfxVolume(obj.sfxVolume);
    if (typeof obj.muted === 'boolean') this.setMuted(obj.muted);
    if (typeof obj.musicStyle === 'string') this.setMusicStyle(obj.musicStyle);
  }

  // --- Internal Audio Graph Construction ---

  _buildGraph() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Master bus (with transparent safety compressor when supported)
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(this.muted ? 0 : this.masterVolume, now);
    if (typeof this.ctx.createDynamicsCompressor === 'function') {
      try {
        this.masterCompressor = this.ctx.createDynamicsCompressor();
        this.masterCompressor.threshold.setValueAtTime(-10, now);
        this.masterCompressor.knee.setValueAtTime(12, now);
        this.masterCompressor.ratio.setValueAtTime(3, now);
        this.masterCompressor.attack.setValueAtTime(0.008, now);
        this.masterCompressor.release.setValueAtTime(0.16, now);
        this.masterGain.connect(this.masterCompressor);
        this.masterCompressor.connect(this.ctx.destination);
      } catch {
        this.masterCompressor = null;
        this.masterGain.connect(this.ctx.destination);
      }
    } else {
      this.masterGain.connect(this.ctx.destination);
    }

    // Music bus
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.setValueAtTime(this.musicVolume, now);
    this.musicGain.connect(this.masterGain);

    // Warm Wooden Tavern Hall Reverb Send (active only in 'new' mode)
    if (typeof this.ctx.createConvolver === 'function' && typeof this.ctx.createBuffer === 'function') {
      try {
        const ir = this._createTavernReverbIR();
        if (ir) {
          this.reverbInput = this.ctx.createGain();
          this.reverbInput.gain.setValueAtTime(1.0, now);
          this.reverbNode = this.ctx.createConvolver();
          this.reverbNode.buffer = ir;
          this.reverbWetGain = this.ctx.createGain();
          this.reverbWetGain.gain.setValueAtTime(this.musicStyle === 'new' ? 0.26 : 0.0, now);
          this.reverbInput.connect(this.reverbNode);
          this.reverbNode.connect(this.reverbWetGain);
          this.reverbWetGain.connect(this.musicGain);
        }
      } catch {
        this.reverbInput = null;
        this.reverbNode = null;
        this.reverbWetGain = null;
      }
    }

    // SFX bus with gentle warm lowpass tilt so transients never sound brittle/harsh
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(this.sfxVolume, now);
    if (typeof this.ctx.createBiquadFilter === 'function') {
      try {
        this.sfxWarmFilter = this.ctx.createBiquadFilter();
        this.sfxWarmFilter.type = 'lowpass';
        this.sfxWarmFilter.frequency.setValueAtTime(2200, now);
        this.sfxWarmFilter.Q.setValueAtTime(0.55, now);
        this.sfxGain.connect(this.sfxWarmFilter);
        this.sfxWarmFilter.connect(this.masterGain);
      } catch {
        this.sfxWarmFilter = null;
        this.sfxGain.connect(this.masterGain);
      }
    } else {
      this.sfxGain.connect(this.masterGain);
    }

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

  _createTavernReverbIR() {
    if (!this.ctx || typeof this.ctx.createBuffer !== 'function') return null;
    const sampleRate = this.ctx.sampleRate || 44100;
    const len = Math.max(1, Math.floor(sampleRate * 1.35));
    const ir = this.ctx.createBuffer(2, len, sampleRate);
    if (!ir || typeof ir.getChannelData !== 'function') return null;
    const chL = ir.getChannelData(0);
    const chR = ir.getChannelData(1);
    if (!chL || !chR) return null;
    const preDelay = Math.floor(sampleRate * 0.014);
    let lpL = 0;
    let lpR = 0;
    for (let i = preDelay; i < len; i++) {
      const t = (i - preDelay) / (len - preDelay);
      const decay = Math.pow(1 - t, 2.5);
      lpL = lpL * 0.74 + (Math.random() * 2 - 1) * 0.26;
      lpR = lpR * 0.74 + (Math.random() * 2 - 1) * 0.26;
      chL[i] = lpL * decay * 0.65;
      chR[i] = lpR * decay * 0.65;
    }
    return ir;
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

    const isEnhanced = this.musicStyle !== 'old';
    const phase = isEnhanced ? ENHANCED_PHASE_DATA[this.currentPhase] : PHASE_DATA[this.currentPhase];
    const totalSteps = isEnhanced ? 128 : 64;
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
      const swingOffset = isEnhanced && (this.step % 2 === 1) ? (phase.swingMs || 0) : 0;
      if (isEnhanced) {
        this._scheduleEnhancedStep(this.nextStepTime + swingOffset, this.step % 128, phase);
      } else {
        this._scheduleStep(this.nextStepTime, this.step % 64, phase);
      }
      this.nextStepTime += stepDuration;
      this.step = (this.step + 1) % totalSteps;
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

  // --- Upgraded Expressive Music Engine ('new' mode) ---

  _connectMusicVoice(node, targetBus, pan = 0, wetAmount = 0.25) {
    if (!this.ctx || !node || !targetBus) return;
    const now = this.ctx.currentTime;
    if (typeof this.ctx.createStereoPanner === 'function' && Math.abs(pan) > 0.01) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-0.9, Math.min(0.9, pan)), now);
      node.connect(panner);
      panner.connect(targetBus);
    } else {
      node.connect(targetBus);
    }
    if (this.reverbInput && wetAmount > 0.005) {
      const wetSend = this.ctx.createGain();
      wetSend.gain.setValueAtTime(wetAmount, now);
      node.connect(wetSend);
      wetSend.connect(this.reverbInput);
    }
  }

  _scheduleEnhancedStep(time, step, phase) {
    const bar = Math.floor(step / 16);
    const barStep = step % 16;
    const chord = phase.chords[bar % phase.chords.length];
    const stepSec = (60 / this.bpm) / 4;
    const jitter = () => (Math.random() - 0.5) * 0.008;

    // 1. Acoustic Guitar / Nylon Harp & Bowed Cello Backing
    if (this.currentPhase === 'morning' || this.currentPhase === 'afternoon') {
      if (barStep === 0) {
        if (bar % 2 === 0 && chord.strum) {
          this._playRichStrum(time, chord.strum, 0.95, 0.105, 0.015, -0.22);
        } else {
          this._playRichPluck(time, m2f(chord.bass), 0.9, 0.185, { brightness: 1800, pan: -0.20, wet: 0.28 });
        }
        if (bar % 2 === 0 && chord.cello) {
          this._playWarmCello(time, m2f(chord.cello), stepSec * 30, 0.08, -0.10);
        }
      } else if (barStep === 8) {
        this._playRichPluck(time + jitter(), m2f(chord.root), 0.72, 0.15, { brightness: 1650, pan: -0.18, wet: 0.26 });
      } else if (barStep === 2 || barStep === 6 || barStep === 10 || barStep === 14) {
        const arpPattern = bar % 2 === 0 ? [1, 2, 3, 4] : [2, 4, 3, 1];
        const patSlot = ((barStep - 2) / 4) | 0;
        const idx = arpPattern[patSlot % arpPattern.length] % chord.arps.length;
        const vel = barStep === 6 || barStep === 14 ? 0.115 : 0.14;
        this._playRichPluck(time + jitter(), m2f(chord.arps[idx]), 0.55, vel, { brightness: 2250, pan: -0.24 + idx * 0.06, wet: 0.30 });
      } else if (this.currentPhase === 'morning' && bar === 7 && (barStep === 11 || barStep === 13)) {
        // Gentle harp turnaround shimmer into bar 0
        const top = chord.arps[chord.arps.length - 1] + (barStep === 13 ? 7 : 0);
        this._playRichPluck(time, m2f(top), 0.85, 0.08, { brightness: 2800, pan: 0.22, wet: 0.44 });
      }

      if (this.currentPhase === 'afternoon') {
        if (barStep === 0 && bar % 2 === 0) {
          this._playPad(time, [chord.root, chord.arps[1] || chord.root + 4, chord.arps[2] || chord.root + 7], stepSec * 30, 0.055);
        }
        if (bar >= 4 && (barStep === 4 || barStep === 12)) {
          this._playBrushPerc(time + jitter(), 0.028);
        }
      }
    }

    // 2. Evening Tavern Reel: Upright Bass, Chop Strum, Bodhran Frame Drum & Shaker
    if (this.currentPhase === 'evening') {
      if (barStep === 0) {
        this._playBass(time, m2f(chord.bass), 0.52, 0.23);
        this._playRichStrum(time, chord.strum, 0.42, 0.105, 0.010, -0.24);
        this._playBodhran(time, true);
        if (bar % 4 === 0 && chord.cello) {
          this._playWarmCello(time, m2f(chord.cello), stepSec * 28, 0.07, -0.08);
        }
      } else if (barStep === 6) {
        this._playBass(time + jitter(), m2f(chord.fifth || chord.root), 0.30, 0.17);
        this._playBodhran(time + jitter(), false);
      } else if (barStep === 8) {
        this._playBass(time, m2f(chord.root), 0.48, 0.20);
        this._playBodhran(time, true);
      } else if (barStep === 14) {
        this._playBodhran(time + jitter(), false);
      }

      if (barStep === 4 || barStep === 12) {
        // Crisp offbeat folk chop
        this._playRichPluck(time + jitter(), m2f(chord.arps[1]), 0.22, 0.115, { brightness: 3100, pan: -0.26, wet: 0.22 });
        this._playRichPluck(time + 0.008, m2f(chord.arps[2]), 0.22, 0.105, { brightness: 2900, pan: -0.20, wet: 0.22 });
        this._playBrushPerc(time, 0.042);
      } else if (barStep === 2 || barStep === 10) {
        this._playBrushPerc(time + jitter(), 0.022);
      }
    }

    // 3. Night Dreamy Lullaby: Velvety Cello, Soft Pad, Nylon Harp & Celesta Music-Box
    if (this.currentPhase === 'night') {
      if (barStep === 0) {
        this._playBass(time, m2f(chord.bass), 1.9, 0.13);
        if (bar % 2 === 0) {
          this._playWarmCello(time, m2f(chord.cello), stepSec * 31, 0.055, -0.10);
          this._playPad(time, [chord.root, chord.arps[1] || chord.root + 4, chord.arps[2] || chord.root + 7], stepSec * 31, 0.06);
        }
      }
      if (barStep === 2 || barStep === 6 || barStep === 10 || barStep === 14) {
        const arpIdx = ((barStep - 2) / 4) % chord.arps.length;
        this._playRichPluck(time + jitter(), m2f(chord.arps[arpIdx]), 1.15, 0.068, { brightness: 1250, pan: -0.25 + arpIdx * 0.1, wet: 0.42 });
      }
      if (phase.bellTones) {
        for (let i = 0; i < phase.bellTones.length; i++) {
          if (phase.bellTones[i].step === step) {
            this._playCelestaBell(time, m2f(phase.bellTones[i].note), 2.4, 0.115, 0.20);
            break;
          }
        }
      }
    }

    // 4. Expressive Lead Flute / Whistle / Night Alto Flute
    const currentFlutePhrase = phase.flutePhrases[this.phraseIndex % phase.flutePhrases.length];
    if (currentFlutePhrase && currentFlutePhrase.length > 0) {
      for (let i = 0; i < currentFlutePhrase.length; i++) {
        const item = currentFlutePhrase[i];
        if (item.step === step) {
          const durSec = Math.max(0.18, item.dur * stepSec);
          const fluteGain = this.currentPhase === 'night' ? 0.095 : 0.145;
          this._playRichFlute(time, m2f(item.note), durSec, fluteGain, { scoop: !!item.scoop, pan: 0.14 });
          break;
        }
      }
    }

    // 5. Dynamic Musician Stem (Double-course Mandolin / Harp Arpeggios on right stereo stage)
    const canPlayLute = this.isMusicianPerforming || (this.musicianGain && this.musicianGain.gain.value > 0.01);
    if (canPlayLute && phase.luteRuns) {
      const run = phase.luteRuns[bar % phase.luteRuns.length];
      if (this.currentPhase === 'evening') {
        if (barStep % 2 === 0 || barStep === 3 || barStep === 7 || barStep === 11 || barStep === 15) {
          const vel = barStep % 4 === 0 ? 0.175 : 0.13;
          this._playRichMandolin(time + jitter(), m2f(run[barStep % run.length]), 0.26, vel, 0.26);
        }
      } else if (this.currentPhase === 'morning') {
        if (barStep % 2 === 0) {
          const pat = [0, 1, 2, 3, 2, 3, 1, 2][(barStep / 2) % 8];
          this._playRichMandolin(time + jitter(), m2f(run[pat % run.length]), 0.34, 0.13, 0.26);
        }
      } else if (this.currentPhase === 'afternoon') {
        if (barStep === 3 || barStep === 6 || barStep === 11 || barStep === 14) {
          this._playRichMandolin(time + jitter(), m2f(run[barStep % run.length]), 0.38, 0.135, 0.26);
        }
      } else if (this.currentPhase === 'night') {
        if (barStep === 4 || barStep === 12) {
          this._playRichMandolin(time, m2f(run[(barStep / 4) % run.length]), 0.72, 0.10, 0.28);
        }
      }
    }
  }

  _playRichPluck(time, freq, duration, gain = 0.12, opts = {}) {
    if (!this.ctx || !this.musicGain) return;
    try {
      const dur = Math.max(0.08, duration);
      const brightness = opts.brightness ?? 2200;
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const osc3 = this.ctx.createOscillator();
      const bodyEq = this.ctx.createBiquadFilter();
      const filter = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, time);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2, time);
      const o2g = this.ctx.createGain();
      o2g.gain.setValueAtTime(0.24, time);
      osc2.connect(o2g);

      osc3.type = 'sawtooth';
      osc3.frequency.setValueAtTime(freq * 2, time);
      const o3g = this.ctx.createGain();
      o3g.gain.setValueAtTime(0.06, time);
      osc3.connect(o3g);

      bodyEq.type = 'peaking';
      bodyEq.frequency.setValueAtTime(240, time);
      bodyEq.Q.setValueAtTime(1.1, time);
      bodyEq.gain.setValueAtTime(3.0, time);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(brightness, time);
      filter.frequency.exponentialRampToValueAtTime(360, time + Math.min(dur, 0.42));
      filter.Q.setValueAtTime(1.2, time);

      env.gain.setValueAtTime(0.0001, time);
      env.gain.linearRampToValueAtTime(gain, time + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, time + dur);

      osc1.connect(bodyEq);
      o2g.connect(bodyEq);
      o3g.connect(bodyEq);
      bodyEq.connect(filter);
      filter.connect(env);
      this._connectMusicVoice(env, this.musicGain, opts.pan ?? -0.2, opts.wet ?? 0.28);

      osc1.start(time);
      osc2.start(time);
      osc3.start(time);
      osc1.stop(time + dur + 0.05);
      osc2.stop(time + dur + 0.05);
      osc3.stop(time + dur + 0.05);
    } catch {}
  }

  _playRichStrum(time, midiNotes, duration, gain = 0.085, spread = 0.014, pan = -0.22) {
    if (!midiNotes || !midiNotes.length) return;
    midiNotes.forEach((midi, idx) => {
      const noteTime = time + idx * spread;
      const noteGain = gain * (1 - idx * 0.1);
      this._playRichPluck(noteTime, m2f(midi), duration, noteGain, {
        brightness: 2100 - idx * 140,
        pan: pan + idx * 0.05,
        wet: 0.30,
      });
    });
  }

  _playWarmCello(time, freq, duration = 1.6, gain = 0.06, pan = -0.10) {
    if (!this.ctx || !this.musicGain) return;
    try {
      const dur = Math.max(0.5, duration);
      const oscA = this.ctx.createOscillator();
      const oscB = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();

      oscA.type = 'sawtooth';
      oscA.frequency.setValueAtTime(freq, time);
      oscA.detune.setValueAtTime(-3.5, time);

      oscB.type = 'triangle';
      oscB.frequency.setValueAtTime(freq, time);
      oscB.detune.setValueAtTime(3.5, time);

      const mixB = this.ctx.createGain();
      mixB.gain.setValueAtTime(0.6, time);
      oscB.connect(mixB);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(190, time);
      filter.frequency.linearRampToValueAtTime(520, time + Math.min(0.45, dur * 0.35));
      filter.frequency.linearRampToValueAtTime(250, time + dur);
      filter.Q.setValueAtTime(0.8, time);

      const atk = Math.min(0.24, dur * 0.25);
      const holdEnd = Math.max(atk + 0.05, dur - 0.35);
      env.gain.setValueAtTime(0.0001, time);
      env.gain.linearRampToValueAtTime(gain, time + atk);
      env.gain.setValueAtTime(gain * 0.9, time + holdEnd);
      env.gain.exponentialRampToValueAtTime(0.0001, time + dur);

      oscA.connect(filter);
      mixB.connect(filter);
      filter.connect(env);
      this._connectMusicVoice(env, this.musicGain, pan, 0.28);

      oscA.start(time);
      oscB.start(time);
      oscA.stop(time + dur + 0.06);
      oscB.stop(time + dur + 0.06);
    } catch {}
  }

  _playRichFlute(time, freq, duration, gain = 0.125, opts = {}) {
    if (!this.ctx || !this.musicGain) return;
    try {
      const dur = Math.max(0.14, duration);
      const osc = this.ctx.createOscillator();
      const oscTri = this.ctx.createOscillator();
      const triGain = this.ctx.createGain();
      const warmth = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();

      osc.type = 'sine';
      oscTri.type = 'triangle';
      if (opts.scoop) {
        const startFreq = freq * 0.965;
        osc.frequency.setValueAtTime(startFreq, time);
        osc.frequency.linearRampToValueAtTime(freq, time + 0.032);
        oscTri.frequency.setValueAtTime(startFreq, time);
        oscTri.frequency.linearRampToValueAtTime(freq, time + 0.032);
      } else {
        osc.frequency.setValueAtTime(freq, time);
        oscTri.frequency.setValueAtTime(freq, time);
      }

      triGain.gain.setValueAtTime(0.16, time);
      oscTri.connect(triGain);

      // Expressive breath vibrato (~5.1Hz after 110ms)
      const vibrato = this.ctx.createOscillator();
      const vibGain = this.ctx.createGain();
      vibrato.frequency.setValueAtTime(5.1, time);
      vibGain.gain.setValueAtTime(0.0001, time);
      vibGain.gain.setValueAtTime(0.0001, time + Math.min(0.11, dur * 0.4));
      vibGain.gain.linearRampToValueAtTime(freq * 0.015, time + Math.min(0.36, dur));
      vibrato.connect(vibGain);
      vibGain.connect(osc.frequency);
      vibGain.connect(oscTri.frequency);
      vibrato.start(time);
      vibrato.stop(time + dur + 0.06);

      if (this.noiseBuffer) {
        const breath = this.ctx.createBufferSource();
        breath.buffer = this.noiseBuffer;
        const bFilter = this.ctx.createBiquadFilter();
        bFilter.type = 'bandpass';
        bFilter.frequency.setValueAtTime(Math.min(4800, freq * 1.15), time);
        bFilter.Q.setValueAtTime(3.2, time);
        const bEnv = this.ctx.createGain();
        bEnv.gain.setValueAtTime(0.0001, time);
        bEnv.gain.linearRampToValueAtTime(0.018, time + 0.045);
        bEnv.gain.exponentialRampToValueAtTime(0.0001, time + dur);
        breath.connect(bFilter);
        bFilter.connect(bEnv);
        this._connectMusicVoice(bEnv, this.musicGain, opts.pan ?? 0.14, 0.34);
        breath.start(time);
        breath.stop(time + dur + 0.05);
      }

      warmth.type = 'lowpass';
      warmth.frequency.setValueAtTime(3400, time);
      warmth.Q.setValueAtTime(0.7, time);

      const atk = Math.min(0.055, dur * 0.25);
      const relStart = Math.max(atk + 0.02, dur - 0.09);
      env.gain.setValueAtTime(0.0001, time);
      env.gain.linearRampToValueAtTime(gain, time + atk);
      env.gain.setValueAtTime(gain, time + relStart);
      env.gain.exponentialRampToValueAtTime(0.0001, time + dur);

      osc.connect(warmth);
      triGain.connect(warmth);
      warmth.connect(env);
      this._connectMusicVoice(env, this.musicGain, opts.pan ?? 0.14, 0.38);

      osc.start(time);
      oscTri.start(time);
      osc.stop(time + dur + 0.06);
      oscTri.stop(time + dur + 0.06);
    } catch {}
  }

  _playRichMandolin(time, freq, duration = 0.28, gain = 0.14, pan = 0.26) {
    if (!this.ctx || !this.musicianGain) return;
    try {
      const dur = Math.max(0.08, duration);
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const o2g = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, time);
      osc1.detune.setValueAtTime(-5, time);

      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(freq, time);
      osc2.detune.setValueAtTime(6, time);
      o2g.gain.setValueAtTime(0.15, time);
      osc2.connect(o2g);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(4200, time);
      filter.frequency.exponentialRampToValueAtTime(1200, time + Math.min(dur, 0.24));
      filter.Q.setValueAtTime(1.8, time);

      env.gain.setValueAtTime(0.0001, time);
      env.gain.linearRampToValueAtTime(gain, time + 0.003);
      env.gain.exponentialRampToValueAtTime(0.0001, time + dur);

      osc1.connect(filter);
      o2g.connect(filter);
      filter.connect(env);
      this._connectMusicVoice(env, this.musicianGain, pan, 0.30);

      osc1.start(time);
      osc2.start(time);
      osc1.stop(time + dur + 0.05);
      osc2.stop(time + dur + 0.05);
    } catch {}
  }

  _playBodhran(time, accent = true) {
    if (!this.ctx || !this.musicGain) return;
    try {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(accent ? 116 : 148, time);
      osc.frequency.exponentialRampToValueAtTime(accent ? 52 : 68, time + 0.095);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(accent ? 260 : 320, time);

      const g = accent ? 0.16 : 0.085;
      env.gain.setValueAtTime(0.0001, time);
      env.gain.linearRampToValueAtTime(g, time + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, time + (accent ? 0.16 : 0.11));

      osc.connect(filter);
      filter.connect(env);
      this._connectMusicVoice(env, this.musicGain, -0.06, 0.12);

      osc.start(time);
      osc.stop(time + 0.20);
    } catch {}
  }

  _playBrushPerc(time, gain = 0.025) {
    if (!this.ctx || !this.musicGain || !this.noiseBuffer) return;
    try {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'highpass';
      bp.frequency.setValueAtTime(4200, time);
      const env = this.ctx.createGain();
      env.gain.setValueAtTime(0.0001, time);
      env.gain.linearRampToValueAtTime(gain, time + 0.003);
      env.gain.exponentialRampToValueAtTime(0.0001, time + 0.045);

      src.connect(bp);
      bp.connect(env);
      this._connectMusicVoice(env, this.musicGain, 0.18, 0.16);

      src.start(time);
      src.stop(time + 0.06);
    } catch {}
  }

  _playCelestaBell(time, freq, duration = 2.4, gain = 0.115, pan = 0.22) {
    if (!this.ctx || !this.musicGain) return;
    try {
      const dur = Math.max(0.3, duration);
      const osc = this.ctx.createOscillator();
      const oct = this.ctx.createOscillator();
      const octGain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);

      oct.type = 'sine';
      oct.frequency.setValueAtTime(freq * 2, time);
      octGain.gain.setValueAtTime(0.18, time);
      oct.connect(octGain);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(4600, time);

      env.gain.setValueAtTime(0.0001, time);
      env.gain.linearRampToValueAtTime(gain, time + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0001, time + dur);

      osc.connect(filter);
      octGain.connect(filter);
      filter.connect(env);
      this._connectMusicVoice(env, this.musicGain, pan, 0.44);

      osc.start(time);
      oct.start(time);
      osc.stop(time + dur + 0.06);
      oct.stop(time + dur + 0.06);
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
    const minInterval = {
      blip: 0.035,
      coin: 0.045,
      mug_clink: 0.045,
      door_bell: 0.08,
      sizzle: 0.10,
      footstep: 0.08,
      ui_hover: 0.04,
      complaint: 0.15,
      ui_click: 0.02,
      ui_tab: 0.02,
    }[type] ?? 0.03;
    const lastAt = this._sfxLastAt.get(type);
    if (lastAt !== undefined && (t - lastAt) < minInterval) {
      return;
    }
    this._sfxLastAt.set(type, t);

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
        case 'expansion_fanfare':
          this._sfxExpansionFanfare(t, vol, pitch);
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

  // 1. Warm ceramic/wood tavern mug clink + gentle foam sigh (cozy midrange, zero shrill ring)
  _sfxMugClink(t, vol, pitch) {
    const f1 = 680 * pitch;
    const f2 = 880 * pitch;

    const ping = (start, freq, amp, dur) => {
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(amp * vol, start + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      osc.connect(env);
      env.connect(this.sfxGain);
      osc.start(start);
      osc.stop(start + dur + 0.03);
    };

    ping(t, f1, 0.16, 0.22);
    ping(t + 0.022, f2, 0.14, 0.20);

    // Subtle soft foam brush
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1150 * pitch, t);
      filter.Q.setValueAtTime(1.6, t);

      const nEnv = this.ctx.createGain();
      nEnv.gain.setValueAtTime(0.0001, t);
      nEnv.gain.linearRampToValueAtTime(0.035 * vol, t + 0.012);
      nEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);

      noise.connect(filter);
      filter.connect(nEnv);
      nEnv.connect(this.sfxGain);
      noise.start(t);
      noise.stop(t + 0.13);
    }
  }

  // 2. Soft cozy oak plank footstep tap
  _sfxFootstep(t, vol, pitch) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(132 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(56 * pitch, t + 0.055);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(280, t);

    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.11 * vol, t + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.065);

    osc.connect(filter);
    filter.connect(env);
    env.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.075);
  }

  // 3. Stardew / Animal Crossing warm marimba coin chime (C5 -> G5, pure warm tones)
  _sfxCoin(t, vol, pitch) {
    const notes = [
      { delay: 0, freq: 523.25 * pitch, amp: 0.18, dur: 0.16 },
      { delay: 0.065, freq: 783.99 * pitch, amp: 0.20, dur: 0.24 },
    ];
    for (const n of notes) {
      const start = t + n.delay;
      const osc = this.ctx.createOscillator();
      const sub = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, start);
      sub.type = 'triangle';
      sub.frequency.setValueAtTime(n.freq * 0.5, start);

      const subGain = this.ctx.createGain();
      subGain.gain.setValueAtTime(0.20, start);
      sub.connect(subGain);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1450, start);

      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(n.amp * vol, start + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, start + n.dur);

      osc.connect(filter);
      subGain.connect(filter);
      filter.connect(env);
      env.connect(this.sfxGain);

      osc.start(start);
      sub.start(start);
      osc.stop(start + n.dur + 0.03);
      sub.stop(start + n.dur + 0.03);
    }
  }

  // 4. Warm wooden innkeeper shop-chime (F4 -> C5, mellow rounded bell)
  _sfxDoorBell(t, vol, pitch) {
    const strikes = [
      { delay: 0, freq: 349.23 * pitch, amp: 0.16, dur: 0.55 },
      { delay: 0.14, freq: 523.25 * pitch, amp: 0.17, dur: 0.72 },
    ];
    for (const s of strikes) {
      const start = t + s.delay;
      const o1 = this.ctx.createOscillator();
      const o2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();

      o1.type = 'triangle';
      o1.frequency.setValueAtTime(s.freq, start);
      o2.type = 'sine';
      o2.frequency.setValueAtTime(s.freq * 2.0, start);

      const o2Gain = this.ctx.createGain();
      o2Gain.gain.setValueAtTime(0.14, start);
      o2.connect(o2Gain);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1250, start);

      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(s.amp * vol, start + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, start + s.dur);

      o1.connect(filter);
      o2Gain.connect(filter);
      filter.connect(env);
      env.connect(this.sfxGain);

      o1.start(start);
      o2.start(start);
      o1.stop(start + s.dur + 0.04);
      o2.stop(start + s.dur + 0.04);
    }
  }

  // 5. Cozy cast-iron simmer sizzle (warm midrange filter instead of sharp hiss)
  _sfxSizzle(t, vol, pitch) {
    if (!this.noiseBuffer) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1080 * pitch, t);
    filter.Q.setValueAtTime(1.35, t);

    // Gentle AM simmer flutter simulating bubbling stew pot
    const am = this.ctx.createOscillator();
    const amDepth = this.ctx.createGain();
    const amCarrier = this.ctx.createGain();
    am.frequency.setValueAtTime(18, t);
    amDepth.gain.setValueAtTime(0.25, t);
    amCarrier.gain.setValueAtTime(0.75, t);
    am.connect(amDepth);
    amDepth.connect(amCarrier.gain);

    const env = this.ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.14 * vol, t + 0.04);
    env.gain.setValueAtTime(0.12 * vol, t + 0.28);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.44);

    noise.connect(filter);
    filter.connect(amCarrier);
    amCarrier.connect(env);
    env.connect(this.sfxGain);

    noise.start(t);
    am.start(t);
    noise.stop(t + 0.46);
    am.stop(t + 0.46);
  }

  // 6. Cozy Minecraft/Stardew hearth wood pop
  _sfxFireCrackle(t, vol, pitch) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(460 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(135 * pitch, t + 0.025);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(750, t);

    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.12 * vol, t + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);

    osc.connect(filter);
    filter.connect(env);
    env.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.035);
  }

  // 7. Cozy Animal Crossing / Stardew hollow-wood UI taps
  _sfxUiClick(t, vol, pitch) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(380 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(190 * pitch, t + 0.022);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(950, t);

    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.14 * vol, t + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.028);

    osc.connect(filter);
    filter.connect(env);
    env.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.035);
  }

  _sfxUiHover(t, vol, pitch) {
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(290 * pitch, t);
    osc.frequency.exponentialRampToValueAtTime(215 * pitch, t + 0.012);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(680, t);

    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(0.032 * vol, t + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.016);

    osc.connect(filter);
    filter.connect(env);
    env.connect(this.sfxGain);

    osc.start(t);
    osc.stop(t + 0.022);
  }

  _sfxUiTab(t, vol, pitch) {
    // Gentle wooden notebook double tap
    const tap = (delay, f) => {
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();
      const time = t + delay;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * pitch, time);
      osc.frequency.exponentialRampToValueAtTime(f * 0.52 * pitch, time + 0.018);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(880, time);

      env.gain.setValueAtTime(0.0001, time);
      env.gain.linearRampToValueAtTime(0.10 * vol, time + 0.003);
      env.gain.exponentialRampToValueAtTime(0.0001, time + 0.024);

      osc.connect(filter);
      filter.connect(env);
      env.connect(this.sfxGain);
      osc.start(time);
      osc.stop(time + 0.028);
    };

    tap(0, 320);
    tap(0.024, 255);
  }

  // 8. Cozy Stardew kalimba/marimba 4-note triad arpeggio (C4 -> E4 -> G4 -> C5)
  _sfxUpgrade(t, vol, pitch) {
    const triad = [261.63, 329.63, 392.00, 523.25];
    triad.forEach((freq, idx) => {
      const noteTime = t + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const oct = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq * pitch, noteTime);

      oct.type = 'sine';
      oct.frequency.setValueAtTime(freq * 2.0 * pitch, noteTime);
      const otGain = this.ctx.createGain();
      otGain.gain.setValueAtTime(0.14, noteTime);
      oct.connect(otGain);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, noteTime);

      env.gain.setValueAtTime(0.0001, noteTime);
      env.gain.linearRampToValueAtTime(0.18 * vol, noteTime + 0.007);
      env.gain.exponentialRampToValueAtTime(0.0001, noteTime + 0.48);

      osc.connect(filter);
      otGain.connect(filter);
      filter.connect(env);
      env.connect(this.sfxGain);

      osc.start(noteTime);
      oct.start(noteTime);
      osc.stop(noteTime + 0.52);
      oct.stop(noteTime + 0.52);
    });
  }

  // 8b. Celebratory architectural expansion fanfare (warm acoustic harp + marimba chord)
  _sfxExpansionFanfare(t, vol, pitch) {
    const notes = [293.66, 369.99, 440.00, 587.33, 739.99]; // D4, F#4, A4, D5, F#5
    notes.forEach((f, idx) => {
      const noteTime = t + idx * 0.09;
      const isLast = idx >= 3;
      const dur = isLast ? 0.85 : 0.44;

      const osc = this.ctx.createOscillator();
      const overtone = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const env = this.ctx.createGain();
      const otGain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f * pitch, noteTime);

      overtone.type = 'sine';
      overtone.frequency.setValueAtTime(f * 2.0 * pitch, noteTime);
      otGain.gain.setValueAtTime(0.08 * vol, noteTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, noteTime);

      env.gain.setValueAtTime(0.0001, noteTime);
      env.gain.linearRampToValueAtTime((isLast ? 0.20 : 0.16) * vol, noteTime + 0.010);
      env.gain.exponentialRampToValueAtTime(0.0001, noteTime + dur);

      osc.connect(filter);
      overtone.connect(otGain);
      otGain.connect(filter);
      filter.connect(env);
      env.connect(this.sfxGain);

      osc.start(noteTime);
      overtone.start(noteTime);
      osc.stop(noteTime + dur + 0.04);
      overtone.stop(noteTime + dur + 0.04);
    });
  }

  // 9. Soft muted low wood-sigh when guest leaves unhappy
  _sfxComplaint(t, vol, pitch) {
    const step = (start, fStart, fEnd, dur, amp) => {
      const o = this.ctx.createOscillator();
      const f = this.ctx.createBiquadFilter();
      const e = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(fStart * pitch, start);
      if (fEnd !== fStart) o.frequency.exponentialRampToValueAtTime(fEnd * pitch, start + dur * 0.9);
      f.type = 'lowpass';
      f.frequency.setValueAtTime(340, start);
      e.gain.setValueAtTime(0.0001, start);
      e.gain.linearRampToValueAtTime(amp * vol, start + 0.01);
      e.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.connect(f);
      f.connect(e);
      e.connect(this.sfxGain);
      o.start(start);
      o.stop(start + dur + 0.02);
    };
    step(t, 207.65, 207.65, 0.16, 0.14);
    step(t + 0.16, 164.81, 138.00, 0.24, 0.16);
  }

  // 10. Cozy Animal Crossing / Stardew midrange dialogue voice blips (no harsh buzzers!)
  _sfxBlip(t, speaker, vol, pitch) {
    const s = String(speaker).toLowerCase();
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const env = this.ctx.createGain();
    let dur = 0.044;

    if (s === 'nyah') {
      // Playful warm midrange inflection (355 -> 405 Hz, mellow filtered triangle)
      const baseFreq = 360 * pitch;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq * 0.96, t);
      osc.frequency.linearRampToValueAtTime(baseFreq * 1.10, t + 0.038);
      dur = 0.044;

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(760, t);

      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.14 * vol, t + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    } else if (s === 'fifi') {
      // Gentle soft sine inflection (~295 Hz)
      const baseFreq = 295 * pitch;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, t);
      osc.frequency.linearRampToValueAtTime(baseFreq * 0.95, t + 0.038);
      dur = 0.042;

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(680, t);

      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.13 * vol, t + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    } else if (s === 'barnaby') {
      // Cozy warm low bass hum (~135 Hz filtered triangle)
      const baseFreq = 135 * pitch;
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(baseFreq * 1.04, t);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.92, t + 0.055);
      dur = 0.06;

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, t);

      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.17 * vol, t + 0.007);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    } else {
      // Deterministic cozy midrange voice pip (185..335 Hz sine/triangle)
      let hash = 0;
      for (let i = 0; i < s.length; i++) {
        hash = ((hash << 5) - hash) + s.charCodeAt(i);
        hash |= 0;
      }
      const absHash = Math.abs(hash);
      const base = 185 + (absHash % 150);
      const microJitter = 0.97 + Math.random() * 0.06;
      const freq = base * microJitter * pitch;
      osc.type = absHash % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      dur = 0.042;

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(680, t);

      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.13 * vol, t + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    }

    osc.connect(filter);
    filter.connect(env);
    env.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + dur + 0.015);
  }
}
