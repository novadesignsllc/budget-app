import { router } from 'expo-router';

/** Sheets can be opened by deep link (a Siri shortcut, a widget), so there may be nothing to go back to. */
export function closeSheet() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
