/**
 * Inputs draw their own border, so the browser's blue focus ring would sit on top of it.
 * Buttons keep the ring for keyboard users.
 */
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = 'input:focus, textarea:focus { outline: none; }';
  document.head.appendChild(style);
}
export {};
