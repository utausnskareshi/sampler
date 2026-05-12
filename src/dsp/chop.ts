/** Detect onsets via spectral-flux-style energy diff and return time markers. */
export function detectOnsets(buf: AudioBuffer, opts: { sensitivity?: number; minGapMs?: number } = {}): number[] {
  const sensitivity = opts.sensitivity ?? 1.6;
  const minGap = (opts.minGapMs ?? 70) / 1000;
  const sr = buf.sampleRate;
  const data = buf.getChannelData(0);
  const win = 1024;
  const hop = 256;

  // Compute per-frame RMS.
  const frames: number[] = [];
  for (let i = 0; i + win < data.length; i += hop) {
    let sum = 0;
    for (let j = 0; j < win; j++) {
      const v = data[i + j];
      sum += v * v;
    }
    frames.push(Math.sqrt(sum / win));
  }
  if (frames.length < 4) return [0];

  // Smooth derivative.
  const flux: number[] = [];
  for (let i = 1; i < frames.length; i++) {
    flux.push(Math.max(0, frames[i] - frames[i - 1]));
  }

  let mean = 0;
  for (const v of flux) mean += v;
  mean /= flux.length;

  const threshold = mean * sensitivity;

  const markers: number[] = [];
  let lastT = -Infinity;
  for (let i = 1; i < flux.length - 1; i++) {
    if (flux[i] > threshold && flux[i] > flux[i - 1] && flux[i] >= flux[i + 1]) {
      const t = (i * hop) / sr;
      if (t - lastT >= minGap) {
        markers.push(t);
        lastT = t;
      }
    }
  }
  if (markers.length === 0 || markers[0] > 0.05) markers.unshift(0);
  return markers;
}

/** Slice buffer by markers into [marker_i, marker_{i+1}] AudioBuffers. */
export function sliceBuffer(ctx: BaseAudioContext, buf: AudioBuffer, markers: number[]): AudioBuffer[] {
  const sorted = [...markers].sort((a, b) => a - b);
  const ends = [...sorted.slice(1), buf.duration];
  const out: AudioBuffer[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const startSec = Math.max(0, sorted[i]);
    const endSec = Math.min(buf.duration, ends[i]);
    if (endSec - startSec < 0.01) continue;
    const startFrame = Math.floor(startSec * buf.sampleRate);
    const endFrame = Math.floor(endSec * buf.sampleRate);
    const slice = ctx.createBuffer(buf.numberOfChannels, endFrame - startFrame, buf.sampleRate);
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      slice.copyToChannel(buf.getChannelData(ch).subarray(startFrame, endFrame), ch);
    }
    out.push(slice);
  }
  return out;
}

/** Trim leading/trailing silence below threshold. */
export function trimSilence(ctx: BaseAudioContext, buf: AudioBuffer, threshold = 0.001): AudioBuffer {
  const data = buf.getChannelData(0);
  let start = 0;
  let end = data.length - 1;
  while (start < data.length && Math.abs(data[start]) < threshold) start++;
  while (end > start && Math.abs(data[end]) < threshold) end--;
  if (end <= start) return buf;
  const out = ctx.createBuffer(buf.numberOfChannels, end - start + 1, buf.sampleRate);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    out.copyToChannel(buf.getChannelData(ch).subarray(start, end + 1), ch);
  }
  return out;
}

/** Slice a region of a buffer between [startSec, endSec]. */
export function spliceRegion(ctx: BaseAudioContext, buf: AudioBuffer, startSec: number, endSec: number): AudioBuffer {
  const sr = buf.sampleRate;
  const start = Math.max(0, Math.floor(startSec * sr));
  const end = Math.min(buf.length, Math.floor(endSec * sr));
  const out = ctx.createBuffer(buf.numberOfChannels, Math.max(1, end - start), sr);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    out.copyToChannel(buf.getChannelData(ch).subarray(start, end), ch);
  }
  return out;
}
