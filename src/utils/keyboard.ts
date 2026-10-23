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
