let timer: number | null = null;
export function toast(msg: string, ms = 1800) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.hidden = false;
  if (timer != null) clearTimeout(timer);
  timer = window.setTimeout(() => {
    el.hidden = true;
    timer = null;
  }, ms);
}
