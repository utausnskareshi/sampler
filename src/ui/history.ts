// Lightweight undo/redo stack capturing project snapshots.

export class History<T> {
  private past: T[] = [];
  private future: T[] = [];
  private snapshot: () => T;
  private apply: (state: T) => void;
  private max: number;
  constructor(snapshot: () => T, apply: (s: T) => void, max = 30) {
    this.snapshot = snapshot;
    this.apply = apply;
    this.max = max;
  }
  push() {
    this.past.push(this.snapshot());
    if (this.past.length > this.max) this.past.shift();
    this.future.length = 0;
  }
  undo() {
    if (this.past.length === 0) return;
    const cur = this.snapshot();
    const prev = this.past.pop()!;
    this.future.push(cur);
    this.apply(prev);
  }
  redo() {
    if (this.future.length === 0) return;
    const cur = this.snapshot();
    const next = this.future.pop()!;
    this.past.push(cur);
    this.apply(next);
  }
  clear() { this.past.length = 0; this.future.length = 0; }
}
