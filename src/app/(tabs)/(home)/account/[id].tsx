import { useLocalSearchParams } from 'expo-router';

import { AccountDetail } from '@/screens/account';

export default function AccountRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AccountDetail id={id} />;
}
