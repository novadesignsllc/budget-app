import { useIsDesktop } from '@/components/dock';
import { DesktopDebt } from '@/desktop/debt';
import { Debt } from '@/screens/debt';

export default function DebtRoute() {
  return useIsDesktop() ? <DesktopDebt /> : <Debt />;
}
