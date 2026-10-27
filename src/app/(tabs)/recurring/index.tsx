import { useIsDesktop } from '@/components/dock';
import { DesktopRecurring } from '@/desktop/recurring';
import { Recurring } from '@/screens/recurring';

export default function RecurringRoute() {
  return useIsDesktop() ? <DesktopRecurring /> : <Recurring />;
}
