import type { Pad, Sample } from "../types";
import { makeReverbImpulse } from "./effects";
import { pickMediaRecorderMime } from "./recorder";

export class AudioEngine {
  ctx: AudioContext;
  master: GainNode;
  /** Dry mixer for samples. */
  dry: GainNode;
  reverb: ConvolverNode;
  reverbReturn: GainNode;
  delay: DelayNode;
  delayFb: GainNode;
  delayReturn: GainNode;
  /** Per-pad sends. */
  padBuses: PadBus[] = [];
  recDest: MediaStreamAudioDestinationNode | null = null;
  /** Skip-back ring buffer (mono mix of master). */
  skipBack: SkipBackBuffer;
  private analyzerNode: AnalyserNode;

  constructor() {
    const Ctor =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    this.ctx = new Ctor({ latencyHint: "interactive" });

    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);

    // Skipback capture taps the master via a script-free analyser path.
    this.analyzerNode = this.ctx.createAnalyser();
    this.analyzerNode.fftSize = 2048;
    this.master.connect(this.analyzerNode);

    this.dry = this.ctx.createGain();
    this.dry.connect(this.master);

    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = makeReverbImpulse(this.ctx, 2.4, 2.0);
    this.reverbReturn = this.ctx.createGain();
    this.reverbReturn.gain.value = 0.6;
    this.reverb.connect(this.reverbReturn);
    this.reverbReturn.connect(this.master);

    this.delay = this.ctx.createDelay(2);
    this.delay.delayTime.value = 0.32;
    this.delayFb = this.ctx.createGain();
    this.delayFb.gain.value = 0.4;
    this.delayReturn = this.ctx.createGain();
    this.delayReturn.gain.value = 0.7;
    this.delay.connect(this.delayFb);
    this.delayFb.connect(this.delay);
    this.delay.connect(this.delayReturn);
    this.delayReturn.connect(this.master);

    this.skipBack = new SkipBackBuffer(this.ctx, this.master, 30);
  }

  /** iOS / Safari requires a user gesture to start audio.
   *
   * IMPORTANT: do NOT `await` resume(). On iOS PWA standalone the resume()
   * promise can hang indefinitely (state can be "interrupted" non-spec), and
   * any caller that awaits this method would block forever. Instead, we kick
   * resume() asynchronously and immediately fire the silent priming buffer —
   * `start()` queued during a user gesture is enough to wake iOS audio. */
  unlock() {
    if (this.ctx.state !== "running") {
      this.ctx.resume().catch(() => {});
    }
    try {
      const buf = this.ctx.createBuffer(1, 1, 22050);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.master);
      src.start();
    } catch {
      /* ignore — context may not yet be usable */
    }
  }

  /** Defensive resume — call before every user-initiated playback.
   * iOS Safari suspends/interrupts the AudioContext aggressively (background,
   * phone calls, idle), and `state` may be "suspended" or even non-spec
   * "interrupted". This brings it back to "running" so triggers actually sound. */
  ensureRunning(): Promise<void> {
    const state = this.ctx.state as string;
    if (state === "running") return Promise.resolve();
    return this.ctx.resume().catch(() => {});
  }

  /** Trigger a sample on a pad with velocity. */
  trigger(pad: Pad, sample: Sample, velocity: number, when = 0) {
    const time = this.ctx.currentTime + when;
    const bus = this.getOrCreateBus(pad.index);
    const src = this.ctx.createBufferSource();
    let buf = sample.buffer;
    if (pad.reverse) {
      buf = reverseBuffer(this.ctx, buf);
    }
    src.buffer = buf;
    src.loop = pad.loop;
    const semis = pad.pitch;
    src.playbackRate.value = pad.rate * Math.pow(2, semis / 12);

    const env = this.ctx.createGain();
    const v = clamp(velocity, 0, 1);
    env.gain.value = pad.volume * (0.2 + 0.8 * v);

    src.connect(env);
    env.connect(bus.input);

    const start = Math.max(0, pad.trimStart);
    const end =
      pad.trimEnd > 0 && pad.trimEnd < buf.duration ? pad.trimEnd : buf.duration;
    src.loopStart = start;
    src.loopEnd = end;
    src.start(time, start, pad.loop ? undefined : end - start);
    if (!pad.loop) src.stop(time + (end - start) / src.playbackRate.value + 0.05);

    bus.applyPad(pad);
    return src;
  }

  /** Lazy create a per-pad bus with filter + sends. */
  private getOrCreateBus(index: number): PadBus {
    let bus = this.padBuses[index];
    if (!bus) {
      bus = new PadBus(this);
      this.padBuses[index] = bus;
    }
    return bus;
  }

  /** Render a pad's sample with current FX into a new AudioBuffer (resampling). */
  async renderPadOffline(pad: Pad, sample: Sample): Promise<AudioBuffer> {
    const semis = pad.pitch;
    const rate = pad.rate * Math.pow(2, semis / 12);
    const start = Math.max(0, pad.trimStart);
    const end =
      pad.trimEnd > 0 && pad.trimEnd < sample.buffer.duration
        ? pad.trimEnd
        : sample.buffer.duration;
    const dur = (end - start) / rate;
    const sr = sample.buffer.sampleRate;
    const off = new OfflineAudioContext(2, Math.ceil(dur * sr) + sr, sr);

    let buf = sample.buffer;
    if (pad.reverse) buf = reverseBuffer(off, buf);
    const src = off.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;

    const filter = off.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = pad.filterCutoff;

    const env = off.createGain();
    env.gain.value = pad.volume;

    // dry path
    src.connect(filter);
    filter.connect(env);
    env.connect(off.destination);

    // reverb send
    if (pad.reverbSend > 0) {
      const ir = off.createConvolver();
      ir.buffer = makeReverbImpulse(off, 2.4, 2.0);
      const send = off.createGain();
      send.gain.value = pad.reverbSend;
      env.connect(send);
      send.connect(ir);
      ir.connect(off.destination);
    }
    // delay send
    if (pad.delaySend > 0) {
      const d = off.createDelay(2);
      d.delayTime.value = 0.32;
      const fb = off.createGain();
      fb.gain.value = 0.4;
      d.connect(fb).connect(d);
      const ds = off.createGain();
      ds.gain.value = pad.delaySend;
      env.connect(ds);
      ds.connect(d);
      d.connect(off.destination);
    }

    src.start(0, start);
    src.stop(dur + 0.5);
    const out = await off.startRendering();
    return out;
  }
}

class PadBus {
  input: GainNode;
  filter: BiquadFilterNode;
  reverbSend: GainNode;
  delaySend: GainNode;
  constructor(eng: AudioEngine) {
    this.input = eng.ctx.createGain();
    this.filter = eng.ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 20000;

    this.reverbSend = eng.ctx.createGain();
    this.reverbSend.gain.value = 0;
    this.delaySend = eng.ctx.createGain();
    this.delaySend.gain.value = 0;

    this.input.connect(this.filter);
    this.filter.connect(eng.dry);
    this.filter.connect(this.reverbSend);
    this.reverbSend.connect(eng.reverb);
    this.filter.connect(this.delaySend);
    this.delaySend.connect(eng.delay);
  }
  applyPad(pad: Pad) {
    this.filter.frequency.value = pad.filterCutoff;
    this.reverbSend.gain.value = pad.reverbSend;
    this.delaySend.gain.value = pad.delaySend;
  }
}

/** A rolling captures of the last N seconds of master output. */
class SkipBackBuffer {
  private ctx: AudioContext;
  private dest: MediaStreamAudioDestinationNode;
  private chunks: Blob[] = [];
  private rec: MediaRecorder;
  private maxSeconds: number;
  constructor(ctx: AudioContext, source: AudioNode, seconds: number) {
    this.ctx = ctx;
    this.maxSeconds = seconds;
    this.dest = ctx.createMediaStreamDestination();
    source.connect(this.dest);
    const mime = pickMediaRecorderMime();
    try {
      this.rec = mime
        ? new MediaRecorder(this.dest.stream, { mimeType: mime })
        : new MediaRecorder(this.dest.stream);
    } catch {
      // MediaRecorder not available on this platform — skipback unsupported.
      this.rec = null as any;
      return;
    }
    this.rec.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        this.chunks.push(e.data);
        // approximate trimming by size: keep last ~30s worth
        const max = 64 * 1024 * seconds;
        let total = this.chunks.reduce((s, c) => s + c.size, 0);
        while (total > max && this.chunks.length > 1) {
          total -= this.chunks.shift()!.size;
        }
      }
    };
    try { this.rec.start(1000); } catch { /* ignore */ }
  }
  /** Returns the captured audio decoded into an AudioBuffer. */
  async capture(): Promise<AudioBuffer | null> {
    if (!this.rec || this.chunks.length === 0) return null;
    const blob = new Blob(this.chunks, { type: this.rec.mimeType });
    const arr = await blob.arrayBuffer();
    try {
      return await this.ctx.decodeAudioData(arr.slice(0));
    } catch {
      return null;
    }
  }
  get seconds() { return this.maxSeconds; }
}

function reverseBuffer(ctx: BaseAudioContext, buf: AudioBuffer): AudioBuffer {
  const out = ctx.createBuffer(buf.numberOfChannels, buf.length, buf.sampleRate);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const src = buf.getChannelData(ch);
    const dst = out.getChannelData(ch);
    for (let i = 0; i < src.length; i++) dst[i] = src[src.length - 1 - i];
  }
  return out;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
