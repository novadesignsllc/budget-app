/**
 * The website draws everything a little smaller on a computer (see theme/web-reset.web.ts).
 * Positions measured on screen are zoomed too, so menus divide by this before placing
 * themselves; otherwise they'd open off to the side of their button.
 */
export function pageZoom(): number {
  if (typeof document === 'undefined') return 1;
  const z = parseFloat(getComputedStyle(document.documentElement).zoom || '1');
  return Number.isFinite(z) && z > 0 ? z : 1;
}
