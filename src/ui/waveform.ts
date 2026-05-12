// Waveform canvas: draws AudioBuffer + selection markers + chop markers.

export interface WaveSelection { start: number; end: number; }

export class WaveformView {
  canvas: HTMLCanvasElement;
  buffer: AudioBuffer | null = null;
  selection: WaveSelection | null = null;
  markers: number[] = [];
  onSelect: (sel: WaveSelection | null) => void = () => {};

  private dragging = false;
  private dragStart = 0;
  private trim: WaveSelection = { start: 0, end: 0 };
  private color: string = "#ffc83c";

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.addEventListener("pointerdown", (e) => this.onDown(e));
    canvas.addEventListener("pointermove", (e) => this.onMove(e));
    window.addEventListener("pointerup", () => this.onUp());
    window.addEventListener("resize", () => this.draw());
  }

  setBuffer(buf: AudioBuffer | null, trim?: WaveSelection, color = "#ffc83c") {
    this.buffer = buf;
    this.markers = [];
    this.selection = null;
    this.trim = trim ? { ...trim } : { start: 0, end: buf?.duration ?? 0 };
    this.color = color;
    this.draw();
  }

  setMarkers(times: number[]) {
    this.markers = [...times];
    this.draw();
  }

  setTrim(s: number, e: number) {
    this.trim = { start: s, end: e };
    this.draw();
  }

  draw() {
    const c = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const w = (c.clientWidth || c.parentElement?.clientWidth || 600);
    const h = c.clientHeight || 160;
    c.width = w * dpr;
    c.height = h * dpr;
    const ctx = c.getContext("2d")!;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // bg
    ctx.fillStyle = "#0e0e13";
    ctx.fillRect(0, 0, w, h);

    if (!this.buffer) {
      ctx.fillStyle = "#666";
      ctx.font = "12px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("音源を読み込むかパッドを選択してください", w / 2, h / 2);
      return;
    }

    const data = this.buffer.getChannelData(0);
    const step = data.length / w;
    ctx.fillStyle = this.color;
    ctx.globalAlpha = 0.85;
    for (let x = 0; x < w; x++) {
      let min = 1, max = -1;
      const s = Math.floor(x * step);
      const e = Math.min(data.length, Math.floor((x + 1) * step));
      for (let i = s; i < e; i++) {
        const v = data[i];
        if (v < min) min = v;
        if (v > max) max = v;
      }
      const y0 = ((1 - max) * h) / 2;
      const y1 = ((1 - min) * h) / 2;
      ctx.fillRect(x, y0, 1, Math.max(1, y1 - y0));
    }
    ctx.globalAlpha = 1;

    // Trim region overlay (outside trim is darkened)
    const dur = this.buffer.duration;
    const ts = (this.trim.start / dur) * w;
    const te = (this.trim.end / dur) * w;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, ts, h);
    ctx.fillRect(te, 0, w - te, h);
    ctx.strokeStyle = this.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(ts, 0, te - ts, h);

    // Selection
    if (this.selection) {
      const ss = (this.selection.start / dur) * w;
      const se = (this.selection.end / dur) * w;
      ctx.fillStyle = "rgba(255,200,60,0.2)";
      ctx.fillRect(ss, 0, se - ss, h);
    }

    // Chop markers
    ctx.strokeStyle = "#ff7eb6";
    ctx.lineWidth = 2;
    for (const t of this.markers) {
      const x = (t / dur) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
  }

  private xToTime(x: number): number {
    if (!this.buffer) return 0;
    const w = this.canvas.clientWidth;
    return (x / w) * this.buffer.duration;
  }

  private onDown(e: PointerEvent) {
    if (!this.buffer) return;
    this.canvas.setPointerCapture(e.pointerId);
    this.dragging = true;
    const r = this.canvas.getBoundingClientRect();
    this.dragStart = this.xToTime(e.clientX - r.left);
    this.selection = { start: this.dragStart, end: this.dragStart };
    this.draw();
  }
  private onMove(e: PointerEvent) {
    if (!this.dragging || !this.buffer) return;
    const r = this.canvas.getBoundingClientRect();
    const t = this.xToTime(e.clientX - r.left);
    this.selection = {
      start: Math.min(this.dragStart, t),
      end: Math.max(this.dragStart, t),
    };
    this.draw();
  }
  private onUp() {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.selection && this.selection.end - this.selection.start < 0.01) {
      this.selection = null;
    }
    this.onSelect(this.selection);
    this.draw();
  }
}
