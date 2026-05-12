// FM and subtractive synthesis voices rendered offline.

import { offline, envADSR, noteFreq } from "./synth-utils";

/** FM bell / piano-ish */
export async function fmBell(midi = 60, dur = 1.6): Promise<AudioBuffer> {
  const ctx = offline(dur);
  const f = noteFreq(midi);

  const carrier = ctx.createOscillator();
  carrier.type = "sine";
  carrier.frequency.value = f;

  const mod = ctx.createOscillator();
  mod.type = "sine";
  mod.frequency.value = f * 3.5;

  const modGain = ctx.createGain();
  modGain.gain.setValueAtTime(f * 4, 0);
  modGain.gain.exponentialRampToValueAtTime(f * 0.2, dur * 0.6);

  mod.connect(modGain);
  modGain.connect(carrier.frequency);

  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, 0);
  env.gain.exponentialRampToValueAtTime(0.9, 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, dur);

  carrier.connect(env).connect(ctx.destination);
  carrier.start(0);
  mod.start(0);
  carrier.stop(dur);
  mod.stop(dur);
  return ctx.startRendering();
}

export async function fmEPiano(midi = 60, dur = 1.4): Promise<AudioBuffer> {
  const ctx = offline(dur);
  const f = noteFreq(midi);
  const car = ctx.createOscillator();
  car.frequency.value = f;
  const mod = ctx.createOscillator();
  mod.frequency.value = f * 14;
  const mg = ctx.createGain();
  mg.gain.setValueAtTime(f * 1.5, 0);
  mg.gain.exponentialRampToValueAtTime(f * 0.05, dur);
  mod.connect(mg).connect(car.frequency);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, 0);
  env.gain.exponentialRampToValueAtTime(0.7, 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, dur);
  car.connect(env).connect(ctx.destination);
  car.start(0); mod.start(0);
  car.stop(dur); mod.stop(dur);
  return ctx.startRendering();
}

/** Subtractive saw lead */
export async function sawLead(midi = 60, dur = 1.2): Promise<AudioBuffer> {
  const ctx = offline(dur);
  const f = noteFreq(midi);
  const o1 = ctx.createOscillator();
  o1.type = "sawtooth"; o1.frequency.value = f;
  const o2 = ctx.createOscillator();
  o2.type = "sawtooth"; o2.frequency.value = f * 1.005; // detune
  const filt = ctx.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.setValueAtTime(2400, 0);
  filt.frequency.exponentialRampToValueAtTime(800, dur);
  filt.Q.value = 4;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, 0);
  env.gain.exponentialRampToValueAtTime(0.5, 0.02);
  env.gain.exponentialRampToValueAtTime(0.0001, dur);
  o1.connect(filt); o2.connect(filt);
  filt.connect(env).connect(ctx.destination);
  o1.start(0); o2.start(0);
  o1.stop(dur); o2.stop(dur);
  return ctx.startRendering();
}

/** Pluck (Karplus-Strong style approximation via filtered noise + delay) */
export async function pluck(midi = 60, dur = 1.6): Promise<AudioBuffer> {
  const ctx = offline(dur);
  const f = noteFreq(midi);
  const burst = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, Math.floor(0.02 * ctx.sampleRate), ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  burst.buffer = buf;
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 1 / f;
  const fb = ctx.createGain();
  fb.gain.value = 0.985;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 2500;
  burst.connect(delay);
  delay.connect(lp).connect(fb).connect(delay);
  delay.connect(ctx.destination);
  burst.start(0);
  return ctx.startRendering();
}

/** Sub bass */
export async function subBass(midi = 36, dur = 1.0): Promise<AudioBuffer> {
  const ctx = offline(dur);
  const f = noteFreq(midi);
  const o = ctx.createOscillator();
  o.type = "sine"; o.frequency.value = f;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, 0);
  env.gain.exponentialRampToValueAtTime(0.95, 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, dur);
  o.connect(env).connect(ctx.destination);
  o.start(0); o.stop(dur);
  return ctx.startRendering();
}

/** Pad: detuned saws + slow filter sweep */
export async function pad(midi = 60, dur = 2.5): Promise<AudioBuffer> {
  const ctx = offline(dur);
  const f = noteFreq(midi);
  const detunes = [-12, -7, 0, 7, 12];
  const filt = ctx.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.setValueAtTime(400, 0);
  filt.frequency.exponentialRampToValueAtTime(2000, dur * 0.6);
  filt.Q.value = 1.5;
  for (const c of detunes) {
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = f * Math.pow(2, c / 12);
    const g = ctx.createGain();
    g.gain.value = 0.12;
    o.connect(g).connect(filt);
    o.start(0); o.stop(dur);
  }
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, 0);
  env.gain.exponentialRampToValueAtTime(0.6, 0.4);
  env.gain.exponentialRampToValueAtTime(0.0001, dur);
  filt.connect(env).connect(ctx.destination);
  return ctx.startRendering();
}

/** Bell-like glass */
export async function glass(midi = 72, dur = 2.0): Promise<AudioBuffer> {
  const ctx = offline(dur);
  const f = noteFreq(midi);
  const partials = [1, 2.76, 5.4, 8.93];
  for (const m of partials) {
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.value = f * m;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.3 / m, 0);
    g.gain.exponentialRampToValueAtTime(0.0001, dur * (1 / m));
    o.connect(g).connect(ctx.destination);
    o.start(0); o.stop(dur);
  }
  return ctx.startRendering();
}
