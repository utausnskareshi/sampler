// SoundTouchJS based time stretching (pitch independent).
// Uses SimpleFilter pull API for offline rendering into a new AudioBuffer.

// @ts-ignore - soundtouchjs ships its own types-light bundle
import { SoundTouch, SimpleFilter, WebAudioBufferSource } from "soundtouchjs";

/**
 * Renders a time-stretched copy of `buf`.
 * `tempo` < 1 → slower, > 1 → faster, pitch unchanged.
 * `pitchSemitones` shifts pitch independently of tempo (default 0).
 */
export async function timeStretch(
  ctx: BaseAudioContext,
  buf: AudioBuffer,
  tempo: number,
  pitchSemitones = 0,
): Promise<AudioBuffer> {
  if (Math.abs(tempo - 1) < 0.001 && pitchSemitones === 0) return buf;

  try {
    return soundTouchStretch(ctx, buf, tempo, pitchSemitones);
  } catch (e) {
    console.warn("SoundTouch failed, using fallback:", e);
    return wsolaStretch(ctx, buf, tempo);
  }
}

function soundTouchStretch(
  ctx: BaseAudioContext,
  buf: AudioBuffer,
  tempo: number,
  pitchSemitones: number,
): AudioBuffer {
  const st = new SoundTouch();
  st.tempo = tempo;
  st.pitch = Math.pow(2, pitchSemitones / 12);

  const source = new WebAudioBufferSource(buf);
  const filter = new SimpleFilter(source, st);

  // Estimated output length.
  const targetLen = Math.ceil(buf.length / tempo);
  const out = ctx.createBuffer(2, targetLen + 4096, buf.sampleRate);
  const left = out.getChannelData(0);
  const right = out.getChannelData(1);

  const FRAME = 4096;
  const interleaved = new Float32Array(FRAME * 2);
  let written = 0;
  while (written < left.length) {
    const got = filter.extract(interleaved, FRAME);
    if (got <= 0) break;
    for (let i = 0; i < got && written + i < left.length; i++) {
      left[written + i] = interleaved[i * 2];
      right[written + i] = interleaved[i * 2 + 1];
    }
    written += got;
  }
  // Trim trailing zeros into a snug buffer.
  const finalLen = Math.min(written, left.length);
  const snug = ctx.createBuffer(2, Math.max(1, finalLen), buf.sampleRate);
  snug.copyToChannel(left.subarray(0, finalLen), 0);
  snug.copyToChannel(right.subarray(0, finalLen), 1);
  return snug;
}

function wsolaStretch(ctx: BaseAudioContext, buf: AudioBuffer, tempo: number): AudioBuffer {
  const sr = buf.sampleRate;
  const channels = buf.numberOfChannels;
  const win = 2048;
  const hop = 512;
  const newHop = Math.floor(hop / tempo);
  const outLen = Math.ceil(buf.length / tempo) + win;
  const out = ctx.createBuffer(channels, outLen, sr);
  const window = hannWindow(win);
  for (let ch = 0; ch < channels; ch++) {
    const inData = buf.getChannelData(ch);
    const outData = out.getChannelData(ch);
    let inPos = 0;
    let outPos = 0;
    while (inPos + win < inData.length) {
      for (let i = 0; i < win; i++) {
        outData[outPos + i] += inData[inPos + i] * window[i];
      }
      inPos += hop;
      outPos += newHop;
    }
    const norm = win / (newHop * 2);
    for (let i = 0; i < outData.length; i++) outData[i] /= norm;
  }
  return out;
}

function hannWindow(n: number): Float32Array {
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) w[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  return w;
}
