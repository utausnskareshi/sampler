// Nature ambience samples rendered offline.

import { offline, noiseBuffer, pinkNoiseBuffer } from "./synth-utils";

/** Rain — pink noise + raindrop transients. */
export async function rain(): Promise<AudioBuffer> {
  const ctx = offline(4);
  const n = ctx.createBufferSource();
  n.buffer = pinkNoiseBuffer(ctx, 4);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 5000;
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass"; hp.frequency.value = 400;
  const g = ctx.createGain();
  g.gain.value = 0.4;
  n.connect(hp).connect(lp).connect(g).connect(ctx.destination);
  n.start(0);
  // Drops
  for (let i = 0; i < 60; i++) {
    const t = Math.random() * 4;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(800 + Math.random() * 1500, t);
    o.frequency.exponentialRampToValueAtTime(200, t + 0.05);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.06, t + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(env).connect(ctx.destination);
    o.start(t); o.stop(t + 0.07);
  }
  return ctx.startRendering();
}

/** Ocean waves — slow swelling pink noise. */
export async function waves(): Promise<AudioBuffer> {
  const ctx = offline(6);
  const n = ctx.createBufferSource();
  n.buffer = pinkNoiseBuffer(ctx, 6);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(800, 0);
  // LFO modulating filter cutoff for swell
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.18;
  const lfoG = ctx.createGain();
  lfoG.gain.value = 600;
  lfo.connect(lfoG).connect(lp.frequency);

  const ampLfo = ctx.createOscillator();
  ampLfo.frequency.value = 0.18;
  const ampLfoG = ctx.createGain();
  ampLfoG.gain.value = 0.35;
  const env = ctx.createGain();
  env.gain.value = 0.5;
  ampLfo.connect(ampLfoG).connect(env.gain);

  n.connect(lp).connect(env).connect(ctx.destination);
  n.start(0); lfo.start(0); ampLfo.start(0);
  return ctx.startRendering();
}

/** Wind — filtered noise with slow filter sweeps. */
export async function wind(): Promise<AudioBuffer> {
  const ctx = offline(5);
  const n = ctx.createBufferSource();
  n.buffer = pinkNoiseBuffer(ctx, 5);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(600, 0);
  bp.Q.value = 1.4;
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.28;
  const lfoG = ctx.createGain();
  lfoG.gain.value = 350;
  lfo.connect(lfoG).connect(bp.frequency);
  const g = ctx.createGain();
  g.gain.value = 0.5;
  n.connect(bp).connect(g).connect(ctx.destination);
  n.start(0); lfo.start(0);
  return ctx.startRendering();
}

/** Thunder — low-frequency rumble + crack. */
export async function thunder(): Promise<AudioBuffer> {
  const ctx = offline(3.5);
  // Crack
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx, 3.5);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass"; hp.frequency.value = 1500;
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(0.0001, 0);
  cg.gain.exponentialRampToValueAtTime(0.5, 0.02);
  cg.gain.exponentialRampToValueAtTime(0.0001, 0.5);
  n.connect(hp).connect(cg).connect(ctx.destination);
  n.start(0);

  // Rumble
  const r = ctx.createBufferSource();
  r.buffer = pinkNoiseBuffer(ctx, 3.5);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 200;
  const rg = ctx.createGain();
  rg.gain.setValueAtTime(0.0001, 0);
  rg.gain.linearRampToValueAtTime(0.7, 0.5);
  rg.gain.exponentialRampToValueAtTime(0.0001, 3.4);
  r.connect(lp).connect(rg).connect(ctx.destination);
  r.start(0);
  return ctx.startRendering();
}

/** Fire crackle */
export async function fire(): Promise<AudioBuffer> {
  const ctx = offline(4);
  const n = ctx.createBufferSource();
  n.buffer = pinkNoiseBuffer(ctx, 4);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = 1200; bp.Q.value = 0.7;
  const g = ctx.createGain();
  g.gain.value = 0.25;
  n.connect(bp).connect(g).connect(ctx.destination);
  n.start(0);
  // Crackles
  for (let i = 0; i < 80; i++) {
    const t = Math.random() * 4;
    const cn = ctx.createBufferSource();
    cn.buffer = noiseBuffer(ctx, 0.04);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass"; hp.frequency.value = 2500;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.4, t + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    cn.connect(hp).connect(env).connect(ctx.destination);
    cn.start(t);
  }
  return ctx.startRendering();
}

/** Stream / babbling brook */
export async function stream(): Promise<AudioBuffer> {
  const ctx = offline(5);
  const n = ctx.createBufferSource();
  n.buffer = pinkNoiseBuffer(ctx, 5);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = 1800; bp.Q.value = 0.5;
  const g = ctx.createGain();
  g.gain.value = 0.4;
  // Bubble blips
  for (let i = 0; i < 40; i++) {
    const t = Math.random() * 5;
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(900 + Math.random() * 1200, t);
    o.frequency.exponentialRampToValueAtTime(400, t + 0.08);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.07, t + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(env).connect(ctx.destination);
    o.start(t); o.stop(t + 0.1);
  }
  n.connect(bp).connect(g).connect(ctx.destination);
  n.start(0);
  return ctx.startRendering();
}

/** Vinyl crackle (lo-fi staple) */
export async function vinyl(): Promise<AudioBuffer> {
  const ctx = offline(4);
  const n = ctx.createBufferSource();
  n.buffer = pinkNoiseBuffer(ctx, 4);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass"; bp.frequency.value = 3000; bp.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.value = 0.18;
  n.connect(bp).connect(g).connect(ctx.destination);
  n.start(0);
  // pops
  for (let i = 0; i < 30; i++) {
    const t = Math.random() * 4;
    const cn = ctx.createBufferSource();
    cn.buffer = noiseBuffer(ctx, 0.02);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.5, t + 0.001);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    cn.connect(env).connect(ctx.destination);
    cn.start(t);
  }
  return ctx.startRendering();
}

/** Riser FX */
export async function riser(): Promise<AudioBuffer> {
  const ctx = offline(3);
  const o = ctx.createOscillator();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(80, 0);
  o.frequency.exponentialRampToValueAtTime(2000, 2.9);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.setValueAtTime(400, 0);
  lp.frequency.exponentialRampToValueAtTime(8000, 2.9);
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, 0);
  env.gain.linearRampToValueAtTime(0.5, 2.7);
  env.gain.exponentialRampToValueAtTime(0.0001, 3);
  o.connect(lp).connect(env).connect(ctx.destination);
  o.start(0); o.stop(3);
  return ctx.startRendering();
}
