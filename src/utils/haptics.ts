import * as Haptics from 'expo-haptics';

type Kind = 'light' | 'medium' | 'success' | 'warning' | 'selection';

/** Haptics are iOS-only here. Android's are inconsistent and web has none. */
export function haptic(kind: Kind) {
  if (process.env.EXPO_OS !== 'ios') return;
  switch (kind) {
    case 'light':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    case 'medium':
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    case 'success':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    case 'warning':
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    case 'selection':
      return Haptics.selectionAsync();
  }
}
