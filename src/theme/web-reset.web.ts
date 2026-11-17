/**
 * Inputs draw their own border, so the browser's blue focus ring would sit on top of it.
 * Buttons keep the ring for keyboard users.
 */
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  // On a computer the whole site is drawn a bit smaller, the way people expect a web app to look.
  style.textContent = 'input:focus, textarea:focus { outline: none; } @media (min-width: 900px) { html { zoom: 0.95; } }';
  document.head.appendChild(style);
  // On a computer every page scrolls inside itself, so the browser window never should. Focusing a
  // field or picking a row could nudge it, sliding the header and sidebar up off the top.
  window.addEventListener('scroll', () => {
    if (window.innerWidth >= 900 && (window.scrollX || window.scrollY)) window.scrollTo(0, 0);
  });
}
export {};
