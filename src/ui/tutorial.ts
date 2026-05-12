// Interactive, non-blocking tutorial banner.
// Steps auto-advance when the user actually performs the requested action.

import { bindTap } from "./bind-tap";

export type TutorialEvent = "pad-trigger" | "lib-assign" | "seq-toggle" | "play";

interface Step {
  title: string;
  body: string;
  /** CSS selector of the UI element to highlight & scroll into view. */
  target?: string;
  /** What user action advances this step automatically. */
  expects?: TutorialEvent | "different-pads";
  required?: number;
  onEnter?: () => void;
  /** Manual step (no auto-advance, user must press 次へ). */
  manual?: boolean;
  /** Final step (next button shows 閉じる). */
  final?: boolean;
}

const STEPS: Step[] = [
  {
    title: "Sampler へようこそ 🎉",
    body:
      "ブラウザだけで動くオフライン対応のサンプラーです。<br />" +
      "<strong>1分</strong>で基本操作を覚えましょう。「次へ」を押して進めてください。",
    manual: true,
  },
  {
    title: "ステップ 1 — パッドを叩く",
    body:
      "右側の 16 個のパッドのうち、お好きな色を <strong>1 つタップ</strong> して音を鳴らしてみましょう。最初の 8 つはドラム音源です。",
    target: "#pads",
    expects: "pad-trigger",
    required: 1,
  },
  {
    title: "ステップ 2 — もっと叩こう",
    body:
      "他のパッドも試してみましょう。<strong>3 つ違うパッド</strong> を叩くと次に進みます。",
    target: "#pads",
    expects: "different-pads",
    required: 3,
  },
  {
    title: "ステップ 3 — ライブラリから音を選ぶ",
    body:
      "左の <strong>ライブラリ</strong> には動物の鳴き声・雨や波の音など豊富な内蔵音源があります。<br />好きな音を <strong>タップ</strong> すると、選択中のパッドにアサインされます。一度試してみましょう。",
    target: "#lib-list",
    onEnter: () => {
      // Mobile: open the slide-out sidebar so the library is visible.
      document.getElementById("sidebar")?.classList.add("open");
    },
    expects: "lib-assign",
    required: 1,
  },
  {
    title: "ステップ 4 — シーケンサー",
    body:
      "下の <strong>16 ステップ・グリッド</strong> をタップしてリズムを打ち込みます。<br /><strong>3 マス以上</strong> 点灯させてみましょう。",
    target: ".sequencer",
    onEnter: () => {
      document.getElementById("sidebar")?.classList.remove("open");
    },
    expects: "seq-toggle",
    required: 3,
  },
  {
    title: "ステップ 5 — 再生する",
    body:
      "上部の <strong>▶ ボタン</strong> を押して、打ち込んだビートを聴いてみましょう！",
    target: "#play-btn",
    expects: "play",
    required: 1,
  },
  {
    title: "完成 🎊",
    body:
      "おめでとうございます！基本操作はマスターです。<br />🎙 録音 / 📁 取り込み / ⏪ スキップバック / 🪓 チョップ なども試してみてください。<br />困ったらいつでもこの画面下部で操作できます。",
    manual: true,
    final: true,
  },
];

export class Tutorial {
  private idx = 0;
  private root: HTMLElement;
  private titleEl: HTMLElement;
  private bodyEl: HTMLElement;
  private stepNumEl: HTMLElement;
  private stepTotalEl: HTMLElement;
  private nextBtn: HTMLButtonElement;
  private backBtn: HTMLButtonElement;
  private skipBtn: HTMLButtonElement;
  private progressFill: HTMLElement;
  private currentTarget: HTMLElement | null = null;
  private uniquePads = new Set<number>();
  private uniqueCells = new Set<string>();
  private completedCount = 0;
  private onClose: () => void;

  constructor(onClose: () => void) {
    this.onClose = onClose;
    this.root = document.getElementById("tutorial")!;
    this.titleEl = document.getElementById("tut-title")!;
    this.bodyEl = document.getElementById("tut-body")!;
    this.stepNumEl = document.getElementById("tut-step-num")!;
    this.stepTotalEl = document.getElementById("tut-step-total")!;
    this.nextBtn = document.getElementById("tut-next") as HTMLButtonElement;
    this.backBtn = document.getElementById("tut-back") as HTMLButtonElement;
    this.skipBtn = document.getElementById("tut-skip") as HTMLButtonElement;
    this.progressFill = document.getElementById("tut-progress-fill")!;
    bindTap(this.nextBtn, () => this.next());
    bindTap(this.backBtn, () => this.prev());
    bindTap(this.skipBtn, () => this.close());
    window.addEventListener("resize", () => this.repositionBanner());
  }

  start() {
    this.idx = 0;
    this.root.hidden = false;
    document.body.classList.add("tut-active");
    this.show();
  }

  /** Called by main.ts whenever a tracked user action happens. */
  notify(event: TutorialEvent, payload?: number | string) {
    if (this.root.hidden) return;
    const step = STEPS[this.idx];
    if (!step.expects) return;

    let progressed = false;
    if (step.expects === "different-pads" && event === "pad-trigger") {
      const idx = payload as number;
      this.uniquePads.add(idx);
      this.completedCount = this.uniquePads.size;
      progressed = true;
    } else if (step.expects === event) {
      if (event === "seq-toggle") {
        this.uniqueCells.add(String(payload));
        this.completedCount = this.uniqueCells.size;
      } else {
        this.completedCount++;
      }
      progressed = true;
    }
    if (!progressed) return;

    const need = step.required ?? 1;
    this.updateProgress(this.completedCount, need);
    if (this.completedCount >= need) {
      // Small delay so the user notices their action took effect.
      setTimeout(() => this.next(), 350);
    }
  }

  private updateProgress(done: number, total: number) {
    const ratio = Math.min(1, done / total);
    this.progressFill.style.width = `${ratio * 100}%`;
  }

  private show() {
    // Reset progress trackers
    this.completedCount = 0;
    this.uniquePads.clear();
    this.uniqueCells.clear();
    if (this.currentTarget) this.currentTarget.classList.remove("highlight-target");
    this.currentTarget = null;

    const step = STEPS[this.idx];
    this.titleEl.textContent = step.title;
    this.bodyEl.innerHTML = step.body;
    this.stepNumEl.textContent = String(this.idx + 1);
    this.stepTotalEl.textContent = String(STEPS.length);
    this.backBtn.disabled = this.idx === 0;
    this.nextBtn.textContent = step.final ? "閉じる" : "次へ →";
    this.nextBtn.classList.toggle("dim", !step.manual && !step.final);
    this.progressFill.style.width = step.manual || step.final ? "100%" : "0%";

    if (step.target) {
      const el = document.querySelector<HTMLElement>(step.target);
      if (el) {
        el.classList.add("highlight-target");
        this.currentTarget = el;
        // Ensure the target is visible by scrolling its workspace into view.
        try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch {}
      }
    }
    this.repositionBanner();

    step.onEnter?.();
  }

  /** Place banner top vs bottom so it doesn't cover the highlighted target. */
  private repositionBanner() {
    if (!this.currentTarget) {
      this.root.classList.remove("top");
      return;
    }
    const r = this.currentTarget.getBoundingClientRect();
    const targetCenter = r.top + r.height / 2;
    if (targetCenter > window.innerHeight * 0.55) {
      // Target is in lower half → banner at top.
      this.root.classList.add("top");
    } else {
      this.root.classList.remove("top");
    }
  }

  private next() {
    if (this.idx >= STEPS.length - 1) return this.close();
    this.idx++;
    this.show();
  }

  private prev() {
    if (this.idx === 0) return;
    this.idx--;
    this.show();
  }

  private close() {
    if (this.currentTarget) this.currentTarget.classList.remove("highlight-target");
    this.currentTarget = null;
    this.root.hidden = true;
    document.body.classList.remove("tut-active");
    localStorage.setItem("sampler.tutorial.done", "1");
    this.onClose();
  }

  static shouldShow(): boolean {
    return localStorage.getItem("sampler.tutorial.done") !== "1";
  }
}
