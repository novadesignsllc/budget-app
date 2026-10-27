import { useIsDesktop } from '@/components/dock';
import { DesktopIncome } from '@/desktop/income';
import { Income } from '@/screens/income';

export default function IncomeRoute() {
  return useIsDesktop() ? <DesktopIncome /> : <Income />;
}
