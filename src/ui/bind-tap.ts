// Bind a "tap" handler that fires on either `click` or `pointerdown`,
// with debouncing so a real touch (which fires both) only triggers once.
//
// iOS Safari in PWA standalone mode is known to occasionally drop `click`
// events on elements that should otherwise receive them. Pads work reliably
// on iOS because they listen on `pointerdown`; mirroring that pattern here
// makes every UI button equally robust.

const DEBOUNCE_MS = 300;

export function bindTap(
  el: HTMLElement,
  handler: (e: Event) => void,
  options: { preventDefault?: boolean } = {},
) {
  const preventDefault = options.preventDefault ?? false;
  let lastFire = 0;
  const fire = (e: Event) => {
    const now = performance.now();
    if (now - lastFire < DEBOUNCE_MS) return;
    lastFire = now;
    if (preventDefault) e.preventDefault();
    handler(e);
  };
  el.addEventListener("click", fire);
  el.addEventListener("pointerdown", fire);
}
