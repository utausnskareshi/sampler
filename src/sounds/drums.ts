// Synthesized drums (808/909-ish) — all rendered offline into AudioBuffers.

import { offline, noiseBuffer } from "./synth-utils";

export async function kick808(): Promise<AudioBuffer> {
  const ctx = offline(0.7);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(140, 0);
  osc.frequency.exponentialRampToValueAtTime(40, 0.4);
  g.gain.setValueAtTime(0.0001, 0);
  g.gain.exponentialRampToValueAtTime(1, 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, 0.6);
  osc.connect(g).connect(ctx.destination);
  osc.start(0);
  osc.stop(0.7);
  // click
  const click = ctx.createBufferSource();
  click.buffer = noiseBuffer(ctx, 0.01);
  const cg = ctx.createGain();
  cg.gain.value = 0.4;
  click.connect(cg).connect(ctx.destination);
  click.start(0);
  return ctx.startRendering();
}

export async function kick909(): Promise<AudioBuffer> {
  const ctx = offline(0.4);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(220, 0);
  osc.frequency.exponentialRampToValueAtTime(60, 0.15);
  g.gain.setValueAtTime(0.0001, 0);
  g.gain.exponentialRampToValueAtTime(1, 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, 0.35);
  osc.connect(g).connect(ctx.destination);
  osc.start(0);
  osc.stop(0.4);
  return ctx.startRendering();
}

export async function snare(): Promise<AudioBuffer> {
  const ctx = offline(0.35);
  // Tone
  const osc = ctx.createOscillator();
  const og = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(220, 0);
  osc.frequency.exponentialRampToValueAtTime(140, 0.12);
  og.gain.setValueAtTime(0.5, 0);
  og.gain.exponentialRampToValueAtTime(0.0001, 0.18);
  osc.connect(og).connect(ctx.destination);
  // Noise
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx, 0.35);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.7, 0);
  ng.gain.exponentialRampToValueAtTime(0.0001, 0.3);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1200;
  n.connect(hp).connect(ng).connect(ctx.destination);
  osc.start(0);
  n.start(0);
  osc.stop(0.35);
  return ctx.startRendering();
}

export async function clap(): Promise<AudioBuffer> {
  const ctx = offline(0.35);
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx, 0.35);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1500;
  bp.Q.value = 1.4;
  const g = ctx.createGain();
  // multi-tap envelope (clap stack)
  const t = [0, 0.012, 0.024, 0.036];
  g.gain.setValueAtTime(0.0001, 0);
  for (const ti of t) {
    g.gain.exponentialRampToValueAtTime(0.9, ti + 0.001);
    g.gain.exponentialRampToValueAtTime(0.05, ti + 0.01);
  }
  g.gain.exponentialRampToValueAtTime(0.0001, 0.32);
  n.connect(bp).connect(g).connect(ctx.destination);
  n.start(0);
  return ctx.startRendering();
}

export async function hatClosed(): Promise<AudioBuffer> {
  const ctx = offline(0.12);
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx, 0.12);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, 0);
  g.gain.exponentialRampToValueAtTime(0.6, 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, 0.08);
  n.connect(hp).connect(g).connect(ctx.destination);
  n.start(0);
  return ctx.startRendering();
}

export async function hatOpen(): Promise<AudioBuffer> {
  const ctx = offline(0.5);
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx, 0.5);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 6000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, 0);
  g.gain.exponentialRampToValueAtTime(0.5, 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, 0.45);
  n.connect(hp).connect(g).connect(ctx.destination);
  n.start(0);
  return ctx.startRendering();
}

export async function tom(freq: number, dur = 0.4): Promise<AudioBuffer> {
  const ctx = offline(dur + 0.05);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(freq * 2, 0);
  osc.frequency.exponentialRampToValueAtTime(freq, dur * 0.5);
  g.gain.setValueAtTime(0.0001, 0);
  g.gain.exponentialRampToValueAtTime(0.9, 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, dur);
  osc.connect(g).connect(ctx.destination);
  osc.start(0);
  osc.stop(dur);
  return ctx.startRendering();
}

export async function rim(): Promise<AudioBuffer> {
  const ctx = offline(0.08);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = 1800;
  g.gain.setValueAtTime(0.6, 0);
  g.gain.exponentialRampToValueAtTime(0.0001, 0.06);
  osc.connect(g).connect(ctx.destination);
  osc.start(0);
  osc.stop(0.08);
  return ctx.startRendering();
}

export async function cymbal(): Promise<AudioBuffer> {
  const ctx = offline(1.2);
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx, 1.2);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 5000;
  // Add metallic ringing partials.
  const partials = [3200, 4100, 5300, 6500];
  for (const f of partials) {
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.value = f;
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.04, 0);
    og.gain.exponentialRampToValueAtTime(0.0001, 1.0);
    o.connect(og).connect(ctx.destination);
    o.start(0);
    o.stop(1.0);
  }
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.6, 0);
  g.gain.exponentialRampToValueAtTime(0.0001, 1.1);
  n.connect(hp).connect(g).connect(ctx.destination);
  n.start(0);
  return ctx.startRendering();
}
