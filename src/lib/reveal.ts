// Quiet "first real appearance" reveal (presentation only).
//
// The menu is mounted underneath the splash / entry screens, so a plain CSS mount animation would finish before
// anyone sees it. This helper holds the first screenful of a few tiles at their `from` frame, waits until each one
// is actually on screen and uncovered (not just mounted), then lets motion.css fade + rise it once with a 40ms stagger.
//
// Safety: nothing is hidden until this script runs (the hold style is scoped to html[data-m-js]); anything still held
// while on screen for MAX_HOLD_MS is released regardless; tiles below the fold wait for scroll; reduced-motion users get no hold.
const SELECTORS = ['.dna-cat-cell'];
const MAX_HOLD_MS = 6000;
const POLL_MS = 160;
const MAX_STAGGER = 7;

export function installReveal(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (typeof MutationObserver === 'undefined') return;
  try {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  } catch {
    return;
  }

  const selector = SELECTORS.join(',');
  const pending = new Map<Element, number>();
  let timer: number | undefined;

  const uncovered = (el: Element): boolean => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const x = Math.min(Math.max(r.left + r.width / 2, 1), window.innerWidth - 1);
    const y = Math.min(Math.max(r.top + r.height / 2, 1), window.innerHeight - 1);
    const top = document.elementFromPoint(x, y);
    return !!top && el.contains(top);
  };

  const release = (el: Element, index: number) => {
    (el as HTMLElement).style.setProperty('--m-i', String(Math.min(index, MAX_STAGGER)));
    el.removeAttribute('data-m-hold');
    el.setAttribute('data-m-in', '');
    pending.delete(el);
  };

  const sweep = () => {
    const now = Date.now();
    let index = 0;
    pending.forEach((firstSeen, el) => {
      if (!el.isConnected) {
        pending.delete(el);
        return;
      }
      const r = el.getBoundingClientRect();
      const onScreen = r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
      if (!onScreen) return; // below the fold: wait for the scroll
      if (firstSeen === 0) pending.set(el, now);
      else if (now - firstSeen > MAX_HOLD_MS) release(el, index++);
      if (pending.has(el) && uncovered(el)) release(el, index++);
    });
    if (pending.size === 0 && timer !== undefined) {
      window.clearInterval(timer);
      timer = undefined;
    }
  };

  const arm = () => {
    if (pending.size === 0) return;
    sweep();
    if (pending.size > 0 && timer === undefined) timer = window.setInterval(sweep, POLL_MS);
  };

  const hold = (el: Element) => {
    if (pending.has(el) || el.hasAttribute('data-m-in')) return;
    // Only the first screenful is held; anything already below the fold or off to the side simply stays visible.
    const r = el.getBoundingClientRect();
    if (r.top >= window.innerHeight || r.left >= window.innerWidth || r.right <= 0) return;
    el.setAttribute('data-m-hold', '');
    pending.set(el, 0);
  };

  const scan = (root: ParentNode) => {
    if (root instanceof Element && root.matches(selector)) hold(root);
    root.querySelectorAll?.(selector).forEach(hold);
  };

  document.documentElement.setAttribute('data-m-js', '1');
  new MutationObserver((records) => {
    for (const record of records) {
      record.addedNodes.forEach((node) => {
        if (node instanceof Element) scan(node);
      });
    }
    arm();
  }).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('scroll', () => pending.size > 0 && sweep(), { passive: true, capture: true });
  scan(document.body);
  arm();
}
