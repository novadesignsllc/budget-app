import { Keyboard, TextInput } from 'react-native';

/**
 * Closes the keyboard and takes focus off the field you were typing in. Called when a
 * dropdown, the calendar, or a switch is used, so working down a form never leaves the
 * keyboard covering it.
 */
export function dismissKeyboard() {
  Keyboard.dismiss();
  const focused = TextInput.State?.currentlyFocusedInput?.();
  if (focused && 'blur' in focused && typeof focused.blur === 'function') focused.blur();
  if (process.env.EXPO_OS === 'web' && typeof document !== 'undefined') {
    const active = document.activeElement as HTMLElement | null;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) active.blur();
  }
}

/**
 * Closes the keyboard, then runs `fn` once the keyboard is gone and the sheet has settled.
 * Menus and the calendar measure where they sit, so measuring while the sheet is still
 * sliding down opens them in the wrong spot. Runs right away when no keyboard is up.
 */
export function afterKeyboard(fn: () => void) {
  if (!Keyboard.isVisible()) {
    dismissKeyboard();
    fn();
    return;
  }
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    sub.remove();
    clearTimeout(fallback);
    // One more frame for the sheet's own layout to catch up with the keyboard.
    requestAnimationFrame(() => setTimeout(fn, 30));
  };
  const sub = Keyboard.addListener('keyboardDidHide', run);
  const fallback = setTimeout(run, 450);
  dismissKeyboard();
}
