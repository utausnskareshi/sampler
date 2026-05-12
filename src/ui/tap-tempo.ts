/** Tap tempo helper — keeps recent taps and computes BPM. */
export class TapTempo {
  private taps: number[] = [];
  tap(): number | null {
    const now = performance.now();
    // Reset if pause too long.
    if (this.taps.length && now - this.taps[this.taps.length - 1] > 2000) {
      this.taps = [];
    }
    this.taps.push(now);
    if (this.taps.length > 8) this.taps.shift();
    if (this.taps.length < 2) return null;
    let sum = 0;
    for (let i = 1; i < this.taps.length; i++) sum += this.taps[i] - this.taps[i - 1];
    const avg = sum / (this.taps.length - 1);
    const bpm = Math.round(60000 / avg);
    return Math.max(40, Math.min(240, bpm));
  }
}
