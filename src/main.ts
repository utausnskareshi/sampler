// Sampler app entry — wires engine + UI + storage together.

import { registerSW } from "virtual:pwa-register";

import { AudioEngine } from "./audio/engine";
import { MicRecorder, MicRecorderError } from "./audio/recorder";
import { Sequencer, playMetroTick } from "./audio/sequencer";

import { detectOnsets, sliceBuffer, spliceRegion } from "./dsp/chop";
import { normalizeBuffer } from "./dsp/normalize";
import { timeStretch } from "./dsp/timestretch";
import { detectPitchHz, snapToScale } from "./dsp/autotune";
import { encodeWav } from "./dsp/wav";

import { BUILTIN_SOUNDS, getBuiltin } from "./sounds/library";

import * as DB from "./storage/db";

import { PAD_COLORS, PAD_KEYS, PadGrid } from "./ui/pads";
import { WaveformView } from "./ui/waveform";
import { SequencerView } from "./ui/sequencer-view";
import { LibraryView, LibraryItem } from "./ui/library-view";
import { setupMidi } from "./ui/midi";
import { requestWakeLock } from "./ui/wakelock";
import { TapTempo } from "./ui/tap-tempo";
import { History } from "./ui/history";
import { Tutorial } from "./ui/tutorial";
import { toast } from "./ui/toast";
import { bindTap } from "./ui/bind-tap";

import type { Pad, Sample } from "./types";

registerSW({ immediate: true });

// ---------- App state ----------

const engine = new AudioEngine();
const recorder = new MicRecorder(engine.ctx);
const sampleMap = new Map<string, Sample>();
let pads: Pad[] = makeDefaultPads();
const seq = new Sequencer(engine, pads, {
  getSample: (id) => sampleMap.get(id),
  onStep: (s) => seqView?.setStep(s),
});

let padGrid!: PadGrid;
let waveform!: WaveformView;
let seqView!: SequencerView;
let libView!: LibraryView;
let tapTempo = new TapTempo();
let history!: History<{ pads: Pad[]; steps: boolean[][] }>;
let tutorial: Tutorial | null = null;

let selectedPad = 0;

function makeDefaultPads(): Pad[] {
  return Array.from({ length: 16 }, (_, i) => ({
    index: i,
    sampleId: null,
    pitch: 0,
    rate: 1,
    volume: 1,
    trimStart: 0,
    trimEnd: 0,
    loop: false,
    reverse: false,
    reverbSend: 0,
    delaySend: 0,
    filterCutoff: 20000,
    color: PAD_COLORS[i],
  }));
}

// ---------- Splash / unlock ----------

const splash = document.getElementById("splash")!;
const startBtn = document.getElementById("start-btn") as HTMLButtonElement;
const app = document.getElementById("app")!;
// On iOS Safari, tapping the start button fires BOTH the splash pointerdown
// (bubbled from the child) AND the startBtn click — even with { once: true }
// they run in sequence and would call boot() twice, double-binding every UI
// listener. Guard ensures boot only runs once total.
let bootStarted = false;
const bootGuard = () => {
  if (bootStarted) return;
  bootStarted = true;
  // Remove the *other* listener so it definitely doesn't fire later.
  splash.removeEventListener("pointerdown", bootGuard);
  startBtn.removeEventListener("click", bootGuard);
  boot();
};
splash.addEventListener("pointerdown", bootGuard);
startBtn.addEventListener("click", bootGuard);

async function boot() {
  // unlock() is synchronous (does not await resume()); call but don't block.
  // iOS PWA can leave resume() unresolved indefinitely, which would otherwise
  // hang boot() and prevent the splash from hiding.
  try { engine.unlock(); } catch { /* ignore */ }
  splash.style.display = "none";
  app.hidden = false;
  await initUI();
  await preloadDefaultBank();
  if (Tutorial.shouldShow()) {
    tutorial = new Tutorial(() => { tutorial = null; });
    tutorial.start();
  }
  requestWakeLock();
  // iOS suspends the AudioContext when backgrounded; resume on return.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && engine.ctx.state === "suspended") {
      engine.ctx.resume().catch(() => {});
    }
  });
  // Orientation change can leave iOS Safari with stale layout dimensions.
  // Force a reflow + waveform redraw a few times after rotation.
  const handleReflow = () => {
    // Force layout recalculation, then redraw the waveform a few times to
    // catch iOS Safari's delayed orientation settle.
    void document.body.offsetHeight;
    requestAnimationFrame(() => {
      waveform?.draw();
      requestAnimationFrame(() => waveform?.draw());
    });
    setTimeout(() => waveform?.draw(), 250);
    setTimeout(() => waveform?.draw(), 600);
  };
  window.addEventListener("orientationchange", handleReflow);
  window.addEventListener("resize", handleReflow);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", handleReflow);
  }
  setupMidi({
    onNoteOn: (n, v) => {
      const idx = (n - 36) % 16;
      if (idx < 0 || idx >= 16) return;
      triggerPad(idx, v);
      padGrid.flash(idx);
    },
    onConnected: (name) => toast(`MIDI 接続: ${name}`),
    onDisconnected: () => {},
  });
  await loadSavedProject();
}

// ---------- UI bootstrap ----------

async function initUI() {
  // Pads
  padGrid = new PadGrid(
    document.getElementById("pads")!,
    pads,
    (i) => {
      const p = pads[i];
      if (!p.sampleId) return "";
      return sampleMap.get(p.sampleId)?.name || "";
    },
    {
      onTrigger: (i, v) => triggerPad(i, v),
      onSelect: (i) => selectPad(i),
    },
  );

  // Waveform
  waveform = new WaveformView(document.getElementById("waveform") as HTMLCanvasElement);
  waveform.onSelect = () => { /* selection just stored */ };

  // Sequencer
  seqView = new SequencerView(
    document.getElementById("seq-grid")!,
    seq,
    (i) => {
      const id = pads[i].sampleId;
      return id ? sampleMap.get(id)?.name || `Pad ${i + 1}` : `Pad ${i + 1}`;
    },
    (i) => pads[i].color,
    (p, s) => tutorial?.notify("seq-toggle", `${p}-${s}`),
  );

  // Library
  libView = new LibraryView(
    document.getElementById("lib-list")!,
    document.querySelector(".lib-tabs")!,
    {
      onAssign: (item) => assignItemToPad(item, selectedPad),
      onPreview: (item) => previewItem(item),
      onDeleteRecorded: async (item) => {
        sampleMap.delete(item.id);
        await DB.deleteSample(item.id);
        libView.removeRecorded(item.id);
        toast("削除しました");
      },
    },
  );

  // History
  history = new History(
    () => ({
      pads: JSON.parse(JSON.stringify(pads)),
      steps: seq.steps.map((r) => [...r]),
    }),
    (s) => {
      pads = s.pads;
      seq.steps = s.steps.map((r) => [...r]);
      seq.setPads(pads);
      padGrid.setPads(pads);
      seqView.refresh();
      refreshEditor();
    },
  );

  bindTopbar();
  bindEditor();
  bindMobileMenu();
  bindHelp();
  bindMicHelp();
}

function bindHelp() {
  const panel = document.getElementById("help-panel")!;
  const open = () => {
    panel.hidden = false;
  };
  const close = () => {
    panel.hidden = true;
  };
  bindTap(document.getElementById("help-btn")!, open);
  bindTap(document.getElementById("help-close")!, close);
  bindTap(document.getElementById("help-done")!, close);
  bindTap(document.getElementById("help-restart-tutorial")!, () => {
    close();
    localStorage.removeItem("sampler.tutorial.done");
    if (tutorial) {
      tutorial = null;
    }
    tutorial = new Tutorial(() => { tutorial = null; });
    tutorial.start();
  });
  // Click backdrop (panel itself but not the card) to close.
  // Use pointerdown too for iOS PWA compatibility.
  const backdropClose = (e: Event) => {
    if (e.target === panel) close();
  };
  panel.addEventListener("click", backdropClose);
  panel.addEventListener("pointerdown", backdropClose);
  // Escape key
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !panel.hidden) {
      close();
    }
  });
}

// ---------- Pad triggering ----------

function triggerPad(index: number, velocity: number) {
  const pad = pads[index];
  if (!pad.sampleId) return;
  const sample = sampleMap.get(pad.sampleId);
  if (!sample) return;
  // Defensive: iOS may have suspended the context since the last gesture.
  if (engine.ctx.state !== "running") engine.ensureRunning();
  const chromatic = (document.getElementById("chromatic-mode") as HTMLInputElement).checked;
  if (chromatic) {
    // Treat the 16 pads as semitones above the selected pad's sample.
    const root = pads[selectedPad];
    const rootSample = root.sampleId ? sampleMap.get(root.sampleId) : null;
    if (rootSample) {
      const tempPad: Pad = { ...root, pitch: root.pitch + (index - selectedPad) };
      engine.trigger(tempPad, rootSample, velocity);
      seq.recordHit(selectedPad);
      tutorial?.notify("pad-trigger", index);
      return;
    }
  }
  engine.trigger(pad, sample, velocity);
  seq.recordHit(index);
  tutorial?.notify("pad-trigger", index);
}

function selectPad(i: number) {
  selectedPad = i;
  padGrid.selectIndex(i);
  refreshEditor();
}

// ---------- Library assignment ----------

async function assignItemToPad(item: LibraryItem, padIndex: number) {
  const sample = await materializeItem(item);
  if (!sample) return;
  pads[padIndex] = {
    ...pads[padIndex],
    sampleId: sample.id,
    trimStart: 0,
    trimEnd: sample.buffer.duration,
    color: sample.color || pads[padIndex].color,
  };
  history.push();
  padGrid.setPads(pads);
  seqView.refresh();
  refreshEditor();
  toast(`Pad ${padIndex + 1}: ${sample.name}`);
  tutorial?.notify("lib-assign");
  // Auto-close the sidebar on mobile so the user immediately sees the pad/editor.
  (window as any).__samplerCloseSidebar?.();
}

async function previewItem(item: LibraryItem) {
  await engine.ensureRunning();
  const s = await materializeItem(item);
  if (!s) return;
  const tempPad: Pad = {
    ...makeDefaultPads()[0],
    sampleId: s.id,
    color: s.color || PAD_COLORS[0],
    trimEnd: s.buffer.duration,
  };
  engine.trigger(tempPad, s, 0.85);
}

async function materializeItem(item: LibraryItem): Promise<Sample | null> {
  if (sampleMap.has(item.id)) return sampleMap.get(item.id)!;
  if (item.source === "builtin") {
    const def = getBuiltin(item.id);
    if (!def) return null;
    const buf = await def.render();
    const s: Sample = {
      id: item.id,
      name: def.name,
      source: "builtin",
      category: def.category,
      color: def.color,
      buffer: buf,
    };
    sampleMap.set(s.id, s);
    return s;
  }
  // recorded / file: must already be in sampleMap; if not, hydrate from DB.
  const rec = await DB.getSampleRecord(item.id);
  if (!rec) return null;
  const s = await DB.hydrateSample(engine.ctx, rec);
  sampleMap.set(s.id, s);
  return s;
}

// ---------- Default sound bank (auto-load drums on first 8 pads for instant fun) ----------

async function preloadDefaultBank() {
  const defaults = [
    "kick-808", "snare", "hat-c", "hat-o",
    "clap", "tom-mid", "rim", "cymbal",
  ];
  for (let i = 0; i < defaults.length; i++) {
    const def = BUILTIN_SOUNDS.find((s) => s.id === defaults[i]);
    if (!def) continue;
    const buf = await def.render();
    const sample: Sample = {
      id: def.id,
      name: def.name,
      source: "builtin",
      category: def.category,
      color: def.color,
      buffer: buf,
    };
    sampleMap.set(sample.id, sample);
    pads[i] = {
      ...pads[i],
      sampleId: sample.id,
      trimEnd: sample.buffer.duration,
      color: sample.color || pads[i].color,
    };
  }
  padGrid.setPads(pads);
  seqView.refresh();
}

// ---------- Editor ----------

function refreshEditor() {
  const pad = pads[selectedPad];
  const titleEl = document.getElementById("editor-title")!;
  if (!pad.sampleId) {
    titleEl.textContent = `編集 — Pad ${selectedPad + 1} (空)`;
    waveform.setBuffer(null);
    return;
  }
  const sample = sampleMap.get(pad.sampleId);
  if (!sample) return;
  titleEl.textContent = `編集 — Pad ${selectedPad + 1}: ${sample.name}`;
  waveform.setBuffer(sample.buffer, { start: pad.trimStart, end: pad.trimEnd || sample.buffer.duration }, pad.color);
  (document.getElementById("vol") as HTMLInputElement).value = String(pad.volume);
  (document.getElementById("pitch") as HTMLInputElement).value = String(pad.pitch);
  (document.getElementById("rate") as HTMLInputElement).value = String(pad.rate);
  (document.getElementById("fx-reverb") as HTMLInputElement).value = String(pad.reverbSend);
  (document.getElementById("fx-delay") as HTMLInputElement).value = String(pad.delaySend);
  (document.getElementById("fx-filter") as HTMLInputElement).value = String(pad.filterCutoff);
}

function bindEditor() {
  const onChange = (id: string, fn: (v: number) => void) => {
    document.getElementById(id)!.addEventListener("input", (e) => {
      fn(parseFloat((e.target as HTMLInputElement).value));
    });
  };
  onChange("vol", (v) => { pads[selectedPad].volume = v; });
  onChange("pitch", (v) => { pads[selectedPad].pitch = v; });
  onChange("rate", (v) => { pads[selectedPad].rate = v; });
  onChange("fx-reverb", (v) => { pads[selectedPad].reverbSend = v; });
  onChange("fx-delay", (v) => { pads[selectedPad].delaySend = v; });
  onChange("fx-filter", (v) => { pads[selectedPad].filterCutoff = v; });

  bindTap(document.getElementById("trim-btn")!, () => applyTrim());
  bindTap(document.getElementById("normalize-btn")!, () => applyNormalize());
  bindTap(document.getElementById("chop-btn")!, () => applyChop());
  bindTap(document.getElementById("resample-btn")!, () => applyResample());
  bindTap(document.getElementById("reverse-btn")!, () => {
    pads[selectedPad].reverse = !pads[selectedPad].reverse;
    history.push();
    toast(`リバース: ${pads[selectedPad].reverse ? "ON" : "OFF"}`);
  });
  bindTap(document.getElementById("loop-btn")!, () => {
    pads[selectedPad].loop = !pads[selectedPad].loop;
    history.push();
    toast(`ループ: ${pads[selectedPad].loop ? "ON" : "OFF"}`);
  });
  bindTap(document.getElementById("autotune-btn")!, () => applyAutotune());
  bindTap(document.getElementById("apply-stretch")!, () => applyTimeStretch());
}

async function applyTrim() {
  const pad = pads[selectedPad];
  if (!pad.sampleId) return;
  const sample = sampleMap.get(pad.sampleId)!;
  const sel = waveform.selection;
  if (!sel) {
    toast("波形をドラッグして範囲を選んでください");
    return;
  }
  const newBuf = spliceRegion(engine.ctx, sample.buffer, sel.start, sel.end);
  await replacePadSample(sample, newBuf, sample.name + " (Trim)");
}

async function applyNormalize() {
  const pad = pads[selectedPad];
  if (!pad.sampleId) return;
  const s = sampleMap.get(pad.sampleId)!;
  // Copy buffer to avoid mutating the source for other pads.
  const dup = engine.ctx.createBuffer(s.buffer.numberOfChannels, s.buffer.length, s.buffer.sampleRate);
  for (let ch = 0; ch < s.buffer.numberOfChannels; ch++) {
    dup.copyToChannel(s.buffer.getChannelData(ch).slice(), ch);
  }
  normalizeBuffer(dup);
  await replacePadSample(s, dup, s.name + " (Norm)");
  toast("ノーマライズ完了");
}

async function applyChop() {
  const pad = pads[selectedPad];
  if (!pad.sampleId) return;
  const s = sampleMap.get(pad.sampleId)!;
  const markers = detectOnsets(s.buffer);
  waveform.setMarkers(markers);
  const slices = sliceBuffer(engine.ctx, s.buffer, markers);
  let assigned = 0;
  // Assign slices to subsequent empty pads.
  for (let i = selectedPad; i < 16 && assigned < slices.length; i++) {
    if (!pads[i].sampleId || i === selectedPad) {
      const id = `chop-${Date.now()}-${i}`;
      const sample: Sample = {
        id,
        name: `${s.name} #${assigned + 1}`,
        source: "recorded",
        category: "チョップ",
        color: pads[i].color,
        buffer: slices[assigned++],
      };
      sampleMap.set(id, sample);
      await DB.persistSample(sample);
      libView.addRecorded({ id, name: sample.name, source: "recorded", color: sample.color, category: "チョップ" });
      pads[i] = {
        ...pads[i],
        sampleId: id,
        trimStart: 0,
        trimEnd: sample.buffer.duration,
      };
    }
  }
  history.push();
  padGrid.setPads(pads);
  seqView.refresh();
  refreshEditor();
  toast(`チョップ: ${slices.length} 個を割り当て`);
}

async function applyResample() {
  const pad = pads[selectedPad];
  if (!pad.sampleId) return;
  const s = sampleMap.get(pad.sampleId)!;
  const buf = await engine.renderPadOffline(pad, s);
  const id = `resamp-${Date.now()}`;
  const sample: Sample = {
    id, name: s.name + " (FX)", source: "recorded", category: "リサンプル",
    color: pad.color, buffer: buf,
  };
  sampleMap.set(id, sample);
  await DB.persistSample(sample);
  libView.addRecorded({ id, name: sample.name, source: "recorded", color: pad.color, category: "リサンプル" });
  pads[selectedPad] = {
    ...pads[selectedPad],
    sampleId: id,
    trimStart: 0,
    trimEnd: buf.duration,
    pitch: 0, rate: 1,
    reverbSend: 0, delaySend: 0, filterCutoff: 20000,
  };
  history.push();
  padGrid.setPads(pads);
  seqView.refresh();
  refreshEditor();
  toast("リサンプリング完了");
}

async function applyAutotune() {
  const pad = pads[selectedPad];
  if (!pad.sampleId) return;
  const s = sampleMap.get(pad.sampleId)!;
  const hz = detectPitchHz(s.buffer);
  if (hz <= 0) {
    toast("ピッチが検出できませんでした");
    return;
  }
  const key = (document.getElementById("key-select") as HTMLSelectElement).value;
  const scale = (document.getElementById("scale-select") as HTMLSelectElement).value;
  const shift = snapToScale(hz, key, scale);
  pads[selectedPad].pitch += shift;
  history.push();
  refreshEditor();
  toast(`キー補正: ${shift > 0 ? "+" : ""}${shift} 半音`);
}

async function applyTimeStretch() {
  const pad = pads[selectedPad];
  if (!pad.sampleId) return;
  const s = sampleMap.get(pad.sampleId)!;
  const tempo = parseFloat((document.getElementById("fx-stretch") as HTMLInputElement).value);
  toast("ストレッチ中…");
  const out = await timeStretch(engine.ctx, s.buffer, tempo);
  await replacePadSample(s, out, `${s.name} (×${tempo.toFixed(2)})`);
  toast("タイムストレッチ完了");
}

async function replacePadSample(prev: Sample, newBuf: AudioBuffer, name: string) {
  const id = `edit-${Date.now()}`;
  const sample: Sample = {
    id, name, source: "recorded", category: prev.category, color: prev.color, buffer: newBuf,
  };
  sampleMap.set(id, sample);
  await DB.persistSample(sample);
  libView.addRecorded({ id, name, source: "recorded", color: prev.color, category: "編集" });
  pads[selectedPad] = {
    ...pads[selectedPad],
    sampleId: id,
    trimStart: 0,
    trimEnd: newBuf.duration,
  };
  history.push();
  padGrid.setPads(pads);
  seqView.refresh();
  refreshEditor();
}

// ---------- Topbar / transport ----------

function bindTopbar() {
  const playBtn = document.getElementById("play-btn") as HTMLButtonElement;
  const recBtn = document.getElementById("rec-btn") as HTMLButtonElement;
  const metroBtn = document.getElementById("metro-btn") as HTMLButtonElement;
  const bpmInput = document.getElementById("bpm") as HTMLInputElement;
  const swingInput = document.getElementById("swing") as HTMLInputElement;
  const tapBtn = document.getElementById("tap-btn") as HTMLButtonElement;
  const themeBtn = document.getElementById("theme-btn") as HTMLButtonElement;
  const undoBtn = document.getElementById("undo-btn") as HTMLButtonElement;
  const redoBtn = document.getElementById("redo-btn") as HTMLButtonElement;
  const exportBtn = document.getElementById("export-btn") as HTMLButtonElement;
  const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;

  bindTap(playBtn, () => togglePlay());
  bindTap(recBtn, () => toggleRec());
  bindTap(metroBtn, () => {
    seq.metronome = !seq.metronome;
    metroBtn.classList.toggle("active", seq.metronome);
    if (seq.metronome) {
      // Preview tick so the user immediately hears that it's on.
      if (engine.ctx.state !== "running") engine.ctx.resume().catch(() => {});
      playMetroTick(engine.ctx, engine.master, engine.ctx.currentTime + 0.01, true);
    }
    toast(seq.metronome ? "メトロノーム ON" : "メトロノーム OFF");
  });
  bpmInput.addEventListener("input", () => {
    seq.bpm = Math.max(40, Math.min(240, parseInt(bpmInput.value) || 100));
  });
  swingInput.addEventListener("input", () => {
    seq.swing = (parseInt(swingInput.value) || 0) / 100;
  });
  bindTap(tapBtn, () => {
    const bpm = tapTempo.tap();
    if (bpm) {
      seq.bpm = bpm;
      bpmInput.value = String(bpm);
      toast(`BPM: ${bpm}`);
    }
  });
  bindTap(themeBtn, () => toggleTheme());
  bindTap(undoBtn, () => history.undo());
  bindTap(redoBtn, () => history.redo());
  bindTap(exportBtn, () => exportWav());
  bindTap(saveBtn, () => saveProjectNow());

  // Mic recording / skipback / file import
  bindTap(document.getElementById("record-btn")!, () => toggleMicRec());
  bindTap(document.getElementById("skipback-btn")!, () => grabSkipback());
  bindTap(document.getElementById("import-btn")!, () => {
    (document.getElementById("file-input") as HTMLInputElement).click();
  });
  document.getElementById("file-input")!.addEventListener("change", (e) => onFiles(e));

  // Sequencer extra
  bindTap(document.getElementById("seq-clear")!, () => {
    seq.clear();
    seqView.refresh();
    history.push();
  });
  bindTap(document.getElementById("seq-quantize")!, () => {
    seq.quantize();
    seqView.refresh();
    toast("クオンタイズ完了");
  });

  // Key/scale/octave/chromatic mode are read at trigger time.
  document.getElementById("octave")!.addEventListener("input", () => { /* applied via pad pitch */ });

  // Global keyboard shortcuts.
  window.addEventListener("keydown", (e) => {
    const tag = (e.target as HTMLElement).tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    if (e.code === "Space") { e.preventDefault(); togglePlay(); return; }
    if (e.key === "r" || e.key === "R") {
      if (!e.ctrlKey && !e.metaKey) { e.preventDefault(); toggleRec(); return; }
    }
    if (e.key === "b" || e.key === "B") { grabSkipback(); return; }
    if (e.key === "t" || e.key === "T") {
      const bpm = tapTempo.tap();
      if (bpm) { seq.bpm = bpm; bpmInput.value = String(bpm); }
      return;
    }
    if (e.key === "m" || e.key === "M") {
      seq.metronome = !seq.metronome;
      metroBtn.classList.toggle("active", seq.metronome);
      return;
    }
    if ((e.key === "z" || e.key === "Z") && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (e.shiftKey) history.redo();
      else history.undo();
      return;
    }
    if (e.shiftKey && (e.key === "D" || e.key === "d")) {
      toggleTheme();
      return;
    }
  });
}

function togglePlay() {
  const btn = document.getElementById("play-btn")!;
  if (seq.isPlaying) {
    seq.stop();
    seqView?.clearStep();
    btn.classList.remove("active");
    btn.textContent = "▶";
    return;
  }
  // Update UI state SYNCHRONOUSLY first so the user gets immediate feedback.
  btn.classList.add("active");
  btn.textContent = "■";
  tutorial?.notify("play");

  // Aggressive iOS audio wakeup — must happen synchronously inside the click
  // handler so the user gesture activates the audio session.
  if (engine.ctx.state !== "running") {
    engine.ctx.resume().catch(() => {});
  }
  try {
    const buf = engine.ctx.createBuffer(1, 1, 22050);
    const src = engine.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(engine.master);
    src.start(0);
  } catch { /* ignore */ }

  seq.start();
}

function toggleRec() {
  const btn = document.getElementById("rec-btn")!;
  seq.isRecording = !seq.isRecording;
  btn.classList.toggle("active", seq.isRecording);
  if (!seq.isRecording) {
    if (seq.liveHits.length) seq.quantize();
    seqView.refresh();
  }
}

async function toggleMicRec() {
  const btn = document.getElementById("record-btn") as HTMLButtonElement;
  const status = document.getElementById("rec-status")!;
  if (recorder.isRecording) {
    btn.disabled = true;
    btn.textContent = "🎙 録音";
    try {
      const buf = await recorder.stop();
      const id = `rec-${Date.now()}`;
      const sample: Sample = {
        id, name: `録音 ${new Date().toLocaleTimeString()}`,
        source: "recorded", category: "録音", color: "#ff565f", buffer: buf,
      };
      sampleMap.set(id, sample);
      await DB.persistSample(sample);
      libView.addRecorded({ id, name: sample.name, source: "recorded", color: sample.color, category: "録音" });
      toast("録音を保存しました");
    } catch (err) {
      handleMicError(err);
    } finally {
      btn.disabled = false;
      status.hidden = true;
    }
  } else {
    try {
      await recorder.start();
      btn.textContent = "■ 停止";
      status.hidden = false;
    } catch (err) {
      handleMicError(err);
    }
  }
}

function handleMicError(err: unknown) {
  if (err instanceof MicRecorderError) {
    switch (err.code) {
      case "permission-denied":
        showMicHelp("マイクの使用が許可されていません。下記の手順でマイクを有効にしてください。");
        return;
      case "no-mic":
        toast("マイクが見つかりません");
        return;
      case "in-use":
        toast("マイクが他のアプリで使用中です");
        return;
      case "https-required":
        toast("マイクは HTTPS 接続でのみ利用できます");
        return;
      case "no-recorder":
        toast("このブラウザはマイク録音に対応していません");
        return;
      case "empty":
        showMicHelp(
          "音声が録音できませんでした。マイク権限が拒否されている可能性があります。下記の手順をご確認ください。",
        );
        return;
      case "decode-failed":
        toast("録音データを読み込めませんでした");
        return;
      default:
        toast(`録音エラー: ${err.message}`);
        return;
    }
  }
  toast(`録音エラー: ${String(err)}`);
}

function showMicHelp(reason: string) {
  const panel = document.getElementById("mic-help")!;
  const reasonEl = document.getElementById("mic-help-reason")!;
  if (reason) reasonEl.textContent = reason;
  panel.hidden = false;
}

function bindMicHelp() {
  const panel = document.getElementById("mic-help")!;
  const close = () => { panel.hidden = true; };
  bindTap(document.getElementById("mic-help-close")!, close);
  bindTap(document.getElementById("mic-help-done")!, close);
  bindTap(document.getElementById("mic-help-retry")!, () => {
    close();
    toggleMicRec();
  });
  const backdropClose = (e: Event) => { if (e.target === panel) close(); };
  panel.addEventListener("click", backdropClose);
  panel.addEventListener("pointerdown", backdropClose);
}

async function grabSkipback() {
  const buf = await engine.skipBack.capture();
  if (!buf) {
    toast("スキップバック: 音がありません");
    return;
  }
  const id = `sb-${Date.now()}`;
  const sample: Sample = {
    id, name: `スキップバック ${new Date().toLocaleTimeString()}`,
    source: "recorded", category: "スキップバック", color: "#7882ff", buffer: buf,
  };
  sampleMap.set(id, sample);
  await DB.persistSample(sample);
  libView.addRecorded({ id, name: sample.name, source: "recorded", color: sample.color, category: "スキップバック" });
  toast("過去 30 秒をキャプチャしました");
}

async function onFiles(e: Event) {
  const input = e.target as HTMLInputElement;
  if (!input.files) return;
  for (const f of Array.from(input.files)) {
    try {
      const arr = await f.arrayBuffer();
      const buf = await engine.ctx.decodeAudioData(arr);
      const id = `file-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const sample: Sample = {
        id, name: f.name, source: "file", category: "ファイル", color: "#50dcb4", buffer: buf,
      };
      sampleMap.set(id, sample);
      await DB.persistSample(sample);
      libView.addFile({ id, name: f.name, source: "file", color: sample.color, category: "ファイル" });
    } catch (err) {
      toast(`読み込み失敗: ${f.name}`);
    }
  }
  input.value = "";
}

// ---------- Render export (WAV) ----------

async function exportWav() {
  toast("書き出し中…");
  const stepDur = 60 / seq.bpm / 4;
  const totalDur = stepDur * 16 + 1.5;
  const sr = engine.ctx.sampleRate;
  const off = new OfflineAudioContext(2, Math.ceil(totalDur * sr), sr);
  // Use dry triggers without effects (simplified) for predictable export.
  for (let s = 0; s < 16; s++) {
    for (let p = 0; p < 16; p++) {
      if (!seq.steps[p][s]) continue;
      const pad = pads[p];
      if (!pad.sampleId) continue;
      const sample = sampleMap.get(pad.sampleId);
      if (!sample) continue;
      const src = off.createBufferSource();
      src.buffer = sample.buffer;
      src.playbackRate.value = pad.rate * Math.pow(2, pad.pitch / 12);
      const g = off.createGain();
      g.gain.value = pad.volume;
      const lp = off.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = pad.filterCutoff;
      src.connect(lp).connect(g).connect(off.destination);
      const t = s * stepDur;
      const start = pad.trimStart;
      const end = pad.trimEnd > 0 ? pad.trimEnd : sample.buffer.duration;
      src.start(t, start, end - start);
    }
  }
  const buf = await off.startRendering();
  const wav = encodeWav(buf);
  const blob = new Blob([wav], { type: "audio/wav" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `sampler-${Date.now()}.wav`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast("WAV を書き出しました");
}

// ---------- Persistence ----------

async function saveProjectNow(opts: { silent?: boolean } = {}) {
  const proj = {
    pads, bpm: seq.bpm, swing: seq.swing,
    steps: seq.steps.map((r) => [...r]),
    key: (document.getElementById("key-select") as HTMLSelectElement).value,
    scale: (document.getElementById("scale-select") as HTMLSelectElement).value,
    octave: parseInt((document.getElementById("octave") as HTMLInputElement).value || "0"),
    samples: [], // sample bytes are stored separately in the samples store
  };
  await DB.saveProject(proj as any);
  if (!opts.silent) toast("プロジェクトを保存しました");
}

async function loadSavedProject() {
  const proj = await DB.loadProject();
  if (!proj) return;
  // Hydrate non-builtin samples used by pads.
  const used = new Set(proj.pads.map((p) => p.sampleId).filter(Boolean) as string[]);
  for (const id of used) {
    if (sampleMap.has(id)) continue;
    if (id.startsWith("rec-") || id.startsWith("file-") || id.startsWith("edit-") ||
        id.startsWith("chop-") || id.startsWith("resamp-") || id.startsWith("sb-")) {
      const rec = await DB.getSampleRecord(id);
      if (rec) {
        const s = await DB.hydrateSample(engine.ctx, rec);
        sampleMap.set(s.id, s);
      }
    } else {
      // Builtin: render lazily.
      const def = getBuiltin(id);
      if (def) {
        const buf = await def.render();
        sampleMap.set(id, {
          id: def.id, name: def.name, source: "builtin",
          category: def.category, color: def.color, buffer: buf,
        });
      }
    }
  }
  // Restore recorded library entries from DB.
  const recs = await DB.getAllSampleRecords();
  for (const r of recs) {
    libView.addRecorded({ id: r.id, name: r.name, source: r.source as any, color: r.color, category: r.category });
  }
  pads = proj.pads.map((p, i) => ({ ...makeDefaultPads()[i], ...p }));
  seq.steps = proj.steps.map((r) => [...r]);
  seq.bpm = proj.bpm;
  seq.swing = proj.swing;
  (document.getElementById("bpm") as HTMLInputElement).value = String(proj.bpm);
  (document.getElementById("swing") as HTMLInputElement).value = String(Math.round(proj.swing * 100));
  (document.getElementById("key-select") as HTMLSelectElement).value = proj.key;
  (document.getElementById("scale-select") as HTMLSelectElement).value = proj.scale;
  (document.getElementById("octave") as HTMLInputElement).value = String(proj.octave);
  seq.setPads(pads);
  padGrid.setPads(pads);
  seqView.refresh();
  refreshEditor();
  toast("前回のプロジェクトを復元");
}

// Auto-save every 30s.
// Silent auto-save every 30s (no toast).
setInterval(() => { saveProjectNow({ silent: true }).catch(() => {}); }, 30000);

// ---------- Theme ----------

function toggleTheme() {
  const cur = document.documentElement.dataset.theme === "light" ? "light" : "dark";
  const next = cur === "light" ? "dark" : "light";
  if (next === "dark") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = "light";
  localStorage.setItem("sampler.theme", next);
}
if (localStorage.getItem("sampler.theme") === "light") {
  document.documentElement.dataset.theme = "light";
}

// ---------- Mobile sidebar toggle ----------

function bindMobileMenu() {
  const btn = document.getElementById("menu-btn")!;
  const sidebar = document.getElementById("sidebar")!;
  const backdrop = document.getElementById("sidebar-backdrop")!;
  const closeBtn = document.getElementById("sidebar-close")!;

  const open = () => {
    sidebar.classList.add("open");
    backdrop.classList.add("show");
    backdrop.hidden = false;
  };
  const close = () => {
    sidebar.classList.remove("open");
    backdrop.classList.remove("show");
    backdrop.hidden = true;
  };
  const toggle = () => {
    if (sidebar.classList.contains("open")) close();
    else open();
  };

  // iOS PWA standalone occasionally drops `click` events; use bindTap which
  // listens to both `click` and `pointerdown` with a debounce.
  bindTap(btn, () => toggle());
  bindTap(backdrop, () => close());
  bindTap(closeBtn, () => close());

  // Expose so other code (e.g. lib assignment) can auto-close on mobile.
  (window as any).__samplerCloseSidebar = () => {
    if (window.matchMedia("(max-width: 720px)").matches) close();
  };
}

// silence "unused" warnings for keys exposed for future binding
void PAD_KEYS;
