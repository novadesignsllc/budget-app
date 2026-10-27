import { useLocalSearchParams } from 'expo-router';

import { useIsDesktop } from '@/components/dock';
import { DesktopAccount } from '@/desktop/account';
import { DebtDetail } from '@/screens/debt-detail';

export default function DebtDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return useIsDesktop() ? <DesktopAccount id={id} /> : <DebtDetail id={id} />;
}
