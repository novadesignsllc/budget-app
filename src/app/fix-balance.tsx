import { useLocalSearchParams } from 'expo-router';

import { FixBalance } from '@/screens/fix-balance';

export default function FixBalanceRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <FixBalance id={id} />;
}
