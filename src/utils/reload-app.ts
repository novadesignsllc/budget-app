import * as Updates from 'expo-updates';
import { DevSettings } from 'react-native';

/** Restarts the JS app. Release builds use expo-updates; dev builds fall back to a dev reload. */
export async function reloadApp() {
  try {
    await Updates.reloadAsync();
  } catch {
    DevSettings.reload();
  }
}
