import type { Pad, Sample } from "../types";
import type { AudioEngine } from "./engine";

export interface SequencerCallbacks {
  getSample(id: string): Sample | undefined;
  onStep(step: number): void;
}

/** 16-step sequencer with swing, runs on lookahead scheduling. */
export class Sequencer {
  steps: boolean[][];
  bpm = 100;
  swing = 0; // 0..1
  isPlaying = false;
  isRecording = false;
  metronome = false;

  private engine: AudioEngine;
  private cb: SequencerCallbacks;
  private nextStepTime = 0;
  private currentStep = 0;
  private timer: number | null = null;
  private pads: Pad[];

  constructor(engine: AudioEngine, pads: Pad[], cb: SequencerCallbacks) {
    this.engine = engine;
    this.pads = pads;
    this.cb = cb;
    this.steps = Array.from({ length: 16 }, () => Array(16).fill(false));
  }

  setPads(pads: Pad[]) { this.pads = pads; }

  start() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentStep = 0;
    // Small offset; must be < scheduler's `ahead` (0.1) so the first step is
    // queued immediately. If context is suspended, the BufferSource will start
    // as soon as the context resumes (Web Audio handles past start times).
    this.nextStepTime = this.engine.ctx.currentTime + 0.05;
    this.scheduler();
  }

  stop() {
    this.isPlaying = false;
    if (this.timer != null) clearTimeout(this.timer);
    this.timer = null;
  }

  toggle(padIndex: number, step: number) {
    this.steps[padIndex][step] = !this.steps[padIndex][step];
  }

  clear() {
    for (let i = 0; i < this.steps.length; i++) this.steps[i].fill(false);
  }

  /** Quantize live-played hits stored in `liveHits` to the grid. */
  liveHits: { padIndex: number; time: number }[] = [];
  recordHit(padIndex: number) {
    if (!this.isRecording) return;
    this.liveHits.push({ padIndex, time: this.engine.ctx.currentTime });
  }
  quantize() {
    const stepDur = this.stepDuration();
    for (const hit of this.liveHits) {
      const beats = Math.round(hit.time / stepDur) % 16;
      this.steps[hit.padIndex][beats] = true;
    }
    this.liveHits = [];
  }

  private stepDuration() {
    // 16th notes
    return 60 / this.bpm / 4;
  }

  private lastCtxTime = 0;
  private rebaseTries = 0;

  private scheduler() {
    if (!this.isPlaying) return;
    // iOS may suspend the AudioContext spuriously; nudge it on every tick.
    if (this.engine.ctx.state !== "running") {
      this.engine.ctx.resume().catch(() => {});
    }
    const ahead = 0.1;
    const ctxTime = this.engine.ctx.currentTime;

    // Detect a frozen / non-advancing currentTime (audio session interrupted on
    // iOS even though state may report "running"). If currentTime hasn't moved
    // for several scheduler ticks, rebase nextStepTime to "now" so the next
    // step gets queued immediately once the context wakes up.
    if (ctxTime === this.lastCtxTime) {
      this.rebaseTries++;
      if (this.rebaseTries > 8 /* ~200ms wallclock */) {
        this.nextStepTime = ctxTime + 0.02;
        this.rebaseTries = 0;
      }
    } else {
      this.rebaseTries = 0;
    }
    this.lastCtxTime = ctxTime;

    while (this.nextStepTime < ctxTime + ahead) {
      this.scheduleStep(this.currentStep, this.nextStepTime);
      const base = this.stepDuration();
      const isOff = this.currentStep % 2 === 1;
      const swingShift = isOff ? base * this.swing * 0.5 : 0;
      this.nextStepTime += base + (isOff ? swingShift : -swingShift);
      this.currentStep = (this.currentStep + 1) % 16;
    }
    this.timer = window.setTimeout(() => this.scheduler(), 25);
  }

  private scheduleStep(step: number, when: number) {
    for (let p = 0; p < this.steps.length; p++) {
      if (!this.steps[p][step]) continue;
      const pad = this.pads[p];
      if (!pad?.sampleId) continue;
      const sample = this.cb.getSample(pad.sampleId);
      if (!sample) continue;
      this.engine.trigger(pad, sample, 1, when - this.engine.ctx.currentTime);
    }
    if (this.metronome) {
      this.scheduleMetronome(step, when);
    }
    setTimeout(() => this.cb.onStep(step), Math.max(0, (when - this.engine.ctx.currentTime) * 1000));
  }

  private scheduleMetronome(step: number, when: number) {
    const isDown = step % 4 === 0;
    playMetroTick(this.engine.ctx, this.engine.master, when, isDown);
  }
}

/** Play a short metronome click. Exported so the UI can preview it on toggle. */
export function playMetroTick(
  ctx: BaseAudioContext,
  out: AudioNode,
  when: number,
  isDown: boolean,
) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = "square";
  osc.frequency.value = isDown ? 1500 : 900;
  // Use only positive values for exponential ramps (iOS-safe).
  const peak = isDown ? 0.45 : 0.25;
  g.gain.setValueAtTime(0.001, when);
  g.gain.exponentialRampToValueAtTime(peak, when + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, when + 0.08);
  osc.connect(g).connect(out);
  osc.start(when);
  osc.stop(when + 0.1);
}
