import { useLocalSearchParams } from 'expo-router';

import { useIsDesktop } from '@/components/dock';
import { DesktopAccount } from '@/desktop/account';
import { AccountDetail } from '@/screens/account';

export default function AccountRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return useIsDesktop() ? <DesktopAccount id={id} /> : <AccountDetail id={id} />;
}
