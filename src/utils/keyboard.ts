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

// Keyboard height, kept from its own events so it's right even when `Keyboard.metrics()` lags.
let keyboardHeight = 0;
for (const name of ['keyboardWillShow', 'keyboardDidShow'] as const) {
  Keyboard.addListener(name, (e) => (keyboardHeight = e.endCoordinates.height));
}
for (const name of ['keyboardWillHide', 'keyboardDidHide'] as const) {
  Keyboard.addListener(name, () => (keyboardHeight = 0));
}

// The app's own number pad, which covers the bottom of the screen just like the keyboard.
let keypadHeight = 0;
export function setKeypadHeight(height: number) {
  keypadHeight = height;
}

/** How tall the keyboard (or the app's number pad) is right now; 0 when neither is up. */
export function currentKeyboardHeight(): number {
  if (keypadHeight > 0) return keypadHeight;
  if (keyboardHeight > 0) return keyboardHeight;
  if (!Keyboard.isVisible()) return 0;
  const metrics = typeof Keyboard.metrics === 'function' ? Keyboard.metrics() : undefined;
  return metrics?.height ?? 0;
}

/**
 * Where the keyboard starts inside a container of height `containerHeight` that reaches
 * the bottom of the screen (a sheet, or the whole window). Uses only heights, because
 * window positions inside a sheet can be off by the sheet's own offset.
 */
export function keyboardTopIn(containerHeight: number): number {
  return containerHeight - currentKeyboardHeight();
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
