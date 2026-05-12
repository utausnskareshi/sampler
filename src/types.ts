export interface Sample {
  id: string;
  name: string;
  /** Source category (builtin / recorded / file). */
  source: "builtin" | "recorded" | "file";
  /** PCM data (mono or stereo). */
  buffer: AudioBuffer;
  /** Optional category for built-in sounds. */
  category?: string;
  /** Original color hint (CSS) for badges/pads. */
  color?: string;
}

export interface Pad {
  index: number;
  sampleId: string | null;
  /** Pitch offset in semitones. */
  pitch: number;
  /** Playback rate (1 = normal). */
  rate: number;
  /** Volume multiplier (0..2). */
  volume: number;
  /** Trim start (seconds). */
  trimStart: number;
  /** Trim end (seconds). */
  trimEnd: number;
  /** Loop region. */
  loop: boolean;
  /** Reverse playback. */
  reverse: boolean;
  /** FX */
  reverbSend: number; // 0..1
  delaySend: number;  // 0..1
  filterCutoff: number; // Hz
  /** UI color */
  color: string;
}

export interface Project {
  pads: Pad[];
  samples: Array<{
    id: string;
    name: string;
    source: Sample["source"];
    category?: string;
    color?: string;
    /** Encoded WAV blob bytes. */
    wav: ArrayBuffer;
  }>;
  bpm: number;
  swing: number;
  steps: boolean[][]; // 16 pads x 16 steps
  key: string;
  scale: string;
  octave: number;
}

export type ScaleName =
  | "chromatic"
  | "major"
  | "minor"
  | "penta-major"
  | "penta-minor"
  | "dorian";
