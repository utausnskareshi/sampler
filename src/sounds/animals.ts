// Synthesized animal sounds rendered offline.
// Best-effort sonic approximations using FM/filtered noise/formants.

import { offline, noiseBuffer } from "./synth-utils";

/** Cat meow — pitch glide on a formant-shaped tone. */
export async function cat(): Promise<AudioBuffer> {
  const ctx = offline(0.7);
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(420, 0);
  o.frequency.linearRampToValueAtTime(700, 0.18);
  o.frequency.linearRampToValueAtTime(380, 0.6);

  const f1 = ctx.createBiquadFilter();
  f1.type = "bandpass"; f1.frequency.value = 800; f1.Q.value = 6;
  const f2 = ctx.createBiquadFilter();
  f2.type = "bandpass"; f2.frequency.value = 1800; f2.Q.value = 4;
  const sum = ctx.createGain();

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, 0);
  env.gain.linearRampToValueAtTime(0.7, 0.05);
  env.gain.linearRampToValueAtTime(0.4, 0.4);
  env.gain.exponentialRampToValueAtTime(0.0001, 0.7);

  o.connect(f1).connect(sum);
  o.connect(f2).connect(sum);
  sum.connect(env).connect(ctx.destination);
  o.start(0); o.stop(0.7);
  return ctx.startRendering();
}

/** Dog bark — quick burst with formant shaping. */
export async function dog(): Promise<AudioBuffer> {
  const ctx = offline(0.45);
  // First bark
  function woof(start: number) {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(220, start);
    o.frequency.linearRampToValueAtTime(160, start + 0.1);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 3;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(0.9, start + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
    o.connect(bp).connect(env).connect(ctx.destination);
    o.start(start); o.stop(start + 0.18);
    // Add noise breath
    const n = ctx.createBufferSource();
    n.buffer = noiseBuffer(ctx, 0.18);
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.2, start);
    ng.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
    n.connect(bp);
    n.connect(ng).connect(ctx.destination);
    n.start(start);
  }
  woof(0);
  woof(0.25);
  return ctx.startRendering();
}

/** Bird chirp — rapidly modulated short whistle. */
export async function bird(): Promise<AudioBuffer> {
  const ctx = offline(0.6);
  function chirp(start: number, base = 2400) {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(base, start);
    o.frequency.exponentialRampToValueAtTime(base * 1.4, start + 0.05);
    o.frequency.exponentialRampToValueAtTime(base * 0.9, start + 0.12);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(0.6, start + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);
    o.connect(env).connect(ctx.destination);
    o.start(start); o.stop(start + 0.13);
  }
  chirp(0.0);
  chirp(0.2, 2700);
  chirp(0.4, 2200);
  return ctx.startRendering();
}

/** Frog ribbit — buzzy croak. */
export async function frog(): Promise<AudioBuffer> {
  const ctx = offline(0.5);
  const o = ctx.createOscillator();
  o.type = "square";
  o.frequency.setValueAtTime(120, 0);
  o.frequency.linearRampToValueAtTime(80, 0.4);
  // Amplitude modulation to give buzz
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 28;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.6;
  const am = ctx.createGain();
  am.gain.value = 0.4;
  lfo.connect(lfoGain).connect(am.gain);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 1500;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, 0);
  env.gain.linearRampToValueAtTime(1, 0.04);
  env.gain.linearRampToValueAtTime(0.6, 0.35);
  env.gain.exponentialRampToValueAtTime(0.0001, 0.5);
  o.connect(am).connect(lp).connect(env).connect(ctx.destination);
  o.start(0); lfo.start(0);
  o.stop(0.5); lfo.stop(0.5);
  return ctx.startRendering();
}

/** Cow moo — long descending lowing. */
export async function cow(): Promise<AudioBuffer> {
  const ctx = offline(1.4);
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(180, 0);
  o.frequency.linearRampToValueAtTime(110, 0.6);
  o.frequency.linearRampToValueAtTime(95, 1.2);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = 600; bp.Q.value = 3;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, 0);
  env.gain.linearRampToValueAtTime(0.6, 0.15);
  env.gain.linearRampToValueAtTime(0.7, 0.9);
  env.gain.exponentialRampToValueAtTime(0.0001, 1.4);
  o.connect(bp).connect(env).connect(ctx.destination);
  o.start(0); o.stop(1.4);
  return ctx.startRendering();
}

/** Owl hoot — soft sine puffs. */
export async function owl(): Promise<AudioBuffer> {
  const ctx = offline(1.2);
  function hoot(start: number) {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(380, start);
    o.frequency.linearRampToValueAtTime(330, start + 0.3);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(0.5, start + 0.08);
    env.gain.exponentialRampToValueAtTime(0.0001, start + 0.4);
    o.connect(env).connect(ctx.destination);
    o.start(start); o.stop(start + 0.4);
  }
  hoot(0);
  hoot(0.5);
  return ctx.startRendering();
}

/** Cricket — fast modulated chirp. */
export async function cricket(): Promise<AudioBuffer> {
  const ctx = offline(1.0);
  for (let i = 0; i < 6; i++) {
    const t = i * 0.15;
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = 4500;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.4, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(env).connect(ctx.destination);
    o.start(t); o.stop(t + 0.07);
  }
  return ctx.startRendering();
}

/** Wolf howl — long pitch glide */
export async function wolf(): Promise<AudioBuffer> {
  const ctx = offline(2.5);
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(180, 0);
  o.frequency.linearRampToValueAtTime(420, 0.6);
  o.frequency.linearRampToValueAtTime(380, 1.6);
  o.frequency.linearRampToValueAtTime(150, 2.4);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 1800;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, 0);
  env.gain.linearRampToValueAtTime(0.6, 0.4);
  env.gain.linearRampToValueAtTime(0.6, 1.8);
  env.gain.exponentialRampToValueAtTime(0.0001, 2.5);
  o.connect(lp).connect(env).connect(ctx.destination);
  o.start(0); o.stop(2.5);
  return ctx.startRendering();
}

/** Rooster crow */
export async function rooster(): Promise<AudioBuffer> {
  const ctx = offline(1.4);
  function part(start: number, freq: number, dur: number) {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(freq, start);
    o.frequency.linearRampToValueAtTime(freq * 1.05, start + dur);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 1500; bp.Q.value = 2;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, start);
    env.gain.linearRampToValueAtTime(0.6, start + 0.04);
    env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    o.connect(bp).connect(env).connect(ctx.destination);
    o.start(start); o.stop(start + dur);
  }
  part(0.0, 480, 0.18);
  part(0.22, 360, 0.18);
  part(0.45, 580, 0.45);
  part(0.95, 380, 0.3);
  return ctx.startRendering();
}

/** Sheep bleat */
export async function sheep(): Promise<AudioBuffer> {
  const ctx = offline(1.0);
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(280, 0);
  o.frequency.linearRampToValueAtTime(220, 0.9);
  // Vibrato for the trembling bleat character
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 12;
  const lfoG = ctx.createGain();
  lfoG.gain.value = 14;
  lfo.connect(lfoG).connect(o.frequency);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = 1200; bp.Q.value = 3;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, 0);
  env.gain.linearRampToValueAtTime(0.6, 0.05);
  env.gain.exponentialRampToValueAtTime(0.0001, 1.0);
  o.connect(bp).connect(env).connect(ctx.destination);
  o.start(0); lfo.start(0);
  o.stop(1.0); lfo.stop(1.0);
  return ctx.startRendering();
}
