// 4x4 pad UI with velocity sensing (touch.force / Y-position) and keyboard mapping.

import type { Pad } from "../types";

export const PAD_KEYS = [
  "1","2","3","4",
  "q","w","e","r",
  "a","s","d","f",
  "z","x","c","v",
];

export const PAD_COLORS = [
  "#ff565f", "#ffc83c", "#50dcb4", "#7882ff",
  "#ff7eb6", "#6dd3ff", "#b48cff", "#ffa852",
  "#ff565f", "#ffc83c", "#50dcb4", "#7882ff",
  "#ff7eb6", "#6dd3ff", "#b48cff", "#ffa852",
];

export interface PadEvents {
  onTrigger(index: number, velocity: number): void;
  onSelect(index: number): void;
}

export class PadGrid {
  el: HTMLElement;
  pads: Pad[];
  private nameOf: (idx: number) => string;
  private buttons: HTMLButtonElement[] = [];
  private selectedIndex = 0;
  private evs: PadEvents;
  private chromaticMode = false;
  private rootKey = 0;

  constructor(el: HTMLElement, pads: Pad[], nameOf: (i: number) => string, ev: PadEvents) {
    this.el = el;
    this.pads = pads;
    this.nameOf = nameOf;
    this.evs = ev;
    this.render();
    this.bindKeyboard();
  }

  setPads(pads: Pad[]) {
    this.pads = pads;
    this.refresh();
  }

  setChromaticMode(on: boolean) { this.chromaticMode = on; this.refresh(); }
  setRootKey(semis: number) { this.rootKey = semis; this.refresh(); }

  refresh() {
    this.buttons.forEach((btn, i) => {
      const pad = this.pads[i];
      const name = btn.querySelector(".pad-name") as HTMLElement;
      const colorBar = btn.querySelector(".pad-color-bar") as HTMLElement;
      name.textContent = this.nameOf(i) || "—";
      btn.classList.toggle("has-sound", !!pad?.sampleId);
      btn.classList.toggle("selected", i === this.selectedIndex);
      btn.style.setProperty("--c-pad", pad.color);
      colorBar.style.background = pad.color;
    });
  }

  flash(index: number) {
    const btn = this.buttons[index];
    if (!btn) return;
    btn.classList.add("active");
    setTimeout(() => btn.classList.remove("active"), 110);
  }

  selectIndex(i: number) {
    this.selectedIndex = i;
    this.refresh();
    this.evs.onSelect(i);
  }
  get selected() { return this.selectedIndex; }

  private render() {
    this.el.innerHTML = "";
    for (let i = 0; i < 16; i++) {
      const btn = document.createElement("button");
      btn.className = "pad";
      btn.dataset.index = String(i);
      btn.style.setProperty("--c-pad", PAD_COLORS[i]);
      btn.innerHTML = `
        <div class="pad-name">—</div>
        <div class="pad-key">${PAD_KEYS[i].toUpperCase()}</div>
        <div class="pad-color-bar"></div>
      `;
      // Pointer events drive velocity. iOS exposes Touch.force; otherwise we
      // approximate from the vertical position within the pad rectangle.
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        const vel = velocityFromPointer(btn, e);
        this.evs.onTrigger(i, vel);
        this.flash(i);
        this.selectIndex(i);
      });
      btn.addEventListener("contextmenu", (e) => e.preventDefault());
      this.buttons.push(btn);
      this.el.appendChild(btn);
    }
  }

  private bindKeyboard() {
    const down = new Set<string>();
    window.addEventListener("keydown", (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
      const k = e.key.toLowerCase();
      const idx = PAD_KEYS.indexOf(k);
      if (idx >= 0) {
        if (down.has(k)) return;
        down.add(k);
        e.preventDefault();
        this.evs.onTrigger(idx, 0.85);
        this.flash(idx);
        this.selectIndex(idx);
      }
    });
    window.addEventListener("keyup", (e) => {
      down.delete(e.key.toLowerCase());
    });
  }
}

function velocityFromPointer(btn: HTMLElement, e: PointerEvent): number {
  // iOS exposes pressure via PointerEvent.pressure for stylus / 3D Touch.
  if (e.pressure && e.pressure > 0 && e.pressure < 1) {
    return Math.max(0.1, Math.min(1, e.pressure * 1.4));
  }
  const r = btn.getBoundingClientRect();
  const y = (e.clientY - r.top) / r.height;
  // Bottom of pad = louder.
  return Math.max(0.2, Math.min(1, y * 1.1 + 0.15));
}
