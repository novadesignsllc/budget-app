import { useIsDesktop } from '@/components/dock';
import { DesktopHome } from '@/desktop/home';
import { Home } from '@/screens/home';

export default function HomeRoute() {
  return useIsDesktop() ? <DesktopHome /> : <Home />;
}
