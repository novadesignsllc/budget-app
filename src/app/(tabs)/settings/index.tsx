import { useIsDesktop } from '@/components/dock';
import { DesktopSettings } from '@/desktop/settings';
import { Settings } from '@/screens/settings';

export default function SettingsRoute() {
  return useIsDesktop() ? <DesktopSettings /> : <Settings />;
}
