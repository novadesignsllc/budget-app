import { useIsDesktop } from '@/components/dock';
import { DesktopBudget } from '@/desktop/budget';
import { Budget } from '@/screens/budget';

export default function BudgetRoute() {
  return useIsDesktop() ? <DesktopBudget /> : <Budget />;
}
