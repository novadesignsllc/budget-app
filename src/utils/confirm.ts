import { Alert } from 'react-native';

/** Asks before something that can't be undone. Resolves true for yes. */
export function confirmAction(title: string, message: string, yes: string): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: yes, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}
