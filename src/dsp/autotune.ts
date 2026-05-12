/** Naive autotune: detect average pitch via autocorrelation, snap to scale, return semitone shift. */

const SCALE_NOTES: Record<string, number[]> = {
  chromatic: [0,1,2,3,4,5,6,7,8,9,10,11],
  major: [0,2,4,5,7,9,11],
  minor: [0,2,3,5,7,8,10],
  "penta-major": [0,2,4,7,9],
  "penta-minor": [0,3,5,7,10],
  dorian: [0,2,3,5,7,9,10],
};

const KEY_INDEX: Record<string, number> = {
  C:0, "C#":1, D:2, "D#":3, E:4, F:5, "F#":6, G:7, "G#":8, A:9, "A#":10, B:11,
};

export function detectPitchHz(buf: AudioBuffer): number {
  const data = buf.getChannelData(0);
  const sr = buf.sampleRate;
  const SIZE = Math.min(2048, data.length);
  // Use a frame near the middle, skipping initial transient.
  const start = Math.min(data.length - SIZE, Math.floor(data.length * 0.25));
  const slice = data.subarray(start, start + SIZE);

  let rms = 0;
  for (let i = 0; i < SIZE; i++) rms += slice[i] * slice[i];
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.005) return 0;

  // Autocorrelation
  const minLag = Math.floor(sr / 1000); // 1000 Hz max
  const maxLag = Math.floor(sr / 60);   // 60 Hz min
  let bestLag = -1;
  let bestCorr = 0;
  for (let lag = minLag; lag < Math.min(maxLag, SIZE - 1); lag++) {
    let corr = 0;
    for (let i = 0; i < SIZE - lag; i++) corr += slice[i] * slice[i + lag];
    if (corr > bestCorr) {
      bestCorr = corr;
      bestLag = lag;
    }
  }
  if (bestLag <= 0) return 0;
  return sr / bestLag;
}

/** Returns semitone shift to snap detected pitch to the nearest note in `key/scale`. */
export function snapToScale(detectedHz: number, key: string, scale: string): number {
  if (detectedHz <= 0) return 0;
  const midi = 12 * Math.log2(detectedHz / 440) + 69;
  const keyIdx = KEY_INDEX[key] ?? 0;
  const scaleNotes = SCALE_NOTES[scale] ?? SCALE_NOTES.chromatic;
  const targetNotes = scaleNotes.map((n) => (n + keyIdx) % 12);
  const note = ((Math.round(midi) % 12) + 12) % 12;
  let bestDiff = 12;
  let snap = 0;
  for (const t of targetNotes) {
    for (const offset of [-12, 0, 12]) {
      const cand = t + offset;
      const diff = cand - note;
      if (Math.abs(diff) < Math.abs(bestDiff)) {
        bestDiff = diff;
        snap = diff;
      }
    }
  }
  return snap;
}
