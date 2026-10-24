import { Keyboard, TextInput } from 'react-native';

/** Closes the keyboard and takes focus off the field you were typing in. */
export function dismissKeyboard() {
  Keyboard.dismiss();
  const focused = TextInput.State?.currentlyFocusedInput?.();
  if (focused && 'blur' in focused && typeof focused.blur === 'function') focused.blur();
  if (process.env.EXPO_OS === 'web' && typeof document !== 'undefined') {
    const active = document.activeElement as HTMLElement | null;
    if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) active.blur();
  }
}

/** Where the top of the keyboard is on screen, or the bottom of the window when it's down. */
export function keyboardTop(windowHeight: number): number {
  if (!Keyboard.isVisible()) return windowHeight;
  const metrics = typeof Keyboard.metrics === 'function' ? Keyboard.metrics() : undefined;
  return metrics?.screenY ?? windowHeight;
}

/**
 * Notes which field has the cursor so it can get it back after a menu closes. Menus and
 * the calendar open over the keyboard instead of closing it, so you can keep typing.
 */
export function rememberFocus(): () => void {
  const focused = TextInput.State?.currentlyFocusedInput?.();
  return () => {
    if (!focused || TextInput.State?.currentlyFocusedInput?.() === focused) return;
    if ('focus' in focused && typeof focused.focus === 'function') focused.focus();
  };
}
