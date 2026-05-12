/** Common synthesis helpers for offline-rendered built-in sounds. */

export function offline(durationSec: number, sampleRate = 44100, channels = 2): OfflineAudioContext {
  return new OfflineAudioContext(channels, Math.ceil(durationSec * sampleRate), sampleRate);
}

export function envADSR(
  ctx: BaseAudioContext,
  param: AudioParam,
  start: number,
  attack: number,
  decay: number,
  sustain: number,
  release: number,
  duration: number,
  peak = 1,
) {
  param.setValueAtTime(0.0001, start);
  param.exponentialRampToValueAtTime(peak, start + attack);
  param.exponentialRampToValueAtTime(Math.max(0.0001, peak * sustain), start + attack + decay);
  const off = start + Math.max(attack + decay, duration - release);
  param.setValueAtTime(Math.max(0.0001, peak * sustain), off);
  param.exponentialRampToValueAtTime(0.0001, off + release);
}

export function noiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

/** Pink-ish noise via Voss-McCartney algorithm. */
export function pinkNoiseBuffer(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return buf;
}

export function noteFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}
