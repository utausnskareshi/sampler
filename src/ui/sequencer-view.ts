// 16-step sequencer grid UI.

import type { Sequencer } from "../audio/sequencer";

export class SequencerView {
  el: HTMLElement;
  seq: Sequencer;
  nameOf: (i: number) => string;
  colorOf: (i: number) => string;
  onToggle?: (padIndex: number, step: number, on: boolean) => void;
  private cells: HTMLElement[][] = [];
  private labels: HTMLElement[] = [];

  constructor(
    el: HTMLElement,
    seq: Sequencer,
    nameOf: (i: number) => string,
    colorOf: (i: number) => string,
    onToggle?: (padIndex: number, step: number, on: boolean) => void,
  ) {
    this.el = el;
    this.seq = seq;
    this.nameOf = nameOf;
    this.colorOf = colorOf;
    this.onToggle = onToggle;
    this.render();
  }

  setStep(step: number) {
    for (let p = 0; p < this.cells.length; p++) {
      for (let s = 0; s < this.cells[p].length; s++) {
        this.cells[p][s].classList.toggle("playing", s === step);
      }
    }
  }

  clearStep() {
    for (let p = 0; p < this.cells.length; p++) {
      for (let s = 0; s < this.cells[p].length; s++) {
        this.cells[p][s].classList.remove("playing");
      }
    }
  }

  refresh() {
    for (let p = 0; p < this.cells.length; p++) {
      this.labels[p].textContent = this.nameOf(p) || `Pad ${p + 1}`;
      this.labels[p].style.borderLeftColor = this.colorOf(p);
      for (let s = 0; s < this.cells[p].length; s++) {
        const on = this.seq.steps[p][s];
        this.cells[p][s].classList.toggle("on", on);
        this.cells[p][s].style.setProperty("--c-pad", this.colorOf(p));
      }
    }
  }

  private render() {
    this.el.innerHTML = "";
    for (let p = 0; p < 16; p++) {
      const row = document.createElement("div");
      row.className = "seq-row";

      const label = document.createElement("div");
      label.className = "seq-label";
      label.textContent = this.nameOf(p) || `Pad ${p + 1}`;
      label.style.borderLeftColor = this.colorOf(p);
      this.labels.push(label);

      const cellRow: HTMLElement[] = [];
      const cells: HTMLElement[] = [];
      cells.push(label);
      for (let s = 0; s < 16; s++) {
        const cell = document.createElement("div");
        cell.className = "seq-cell" + (s % 4 === 0 ? " beat" : "");
        cell.style.setProperty("--c-pad", this.colorOf(p));
        cell.addEventListener("pointerdown", () => {
          this.seq.toggle(p, s);
          const on = this.seq.steps[p][s];
          cell.classList.toggle("on", on);
          this.onToggle?.(p, s, on);
        });
        cellRow.push(cell);
        cells.push(cell);
      }
      this.cells.push(cellRow);
      // append to grid
      for (const c of cells) this.el.appendChild(c);
    }
    this.refresh();
  }
}
