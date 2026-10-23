import 'expo-sqlite/localStorage/install';

import { reloadApp } from '@/utils/reload-app';

const KEY = 'zb-demo-mode';

/** Whether this device is running the demo account instead of a real one. */
export function isDemoMode(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

/** Switches between the demo and the real app. The app restarts so it picks the right backend. */
export async function setDemoMode(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {}
  await reloadApp();
}
