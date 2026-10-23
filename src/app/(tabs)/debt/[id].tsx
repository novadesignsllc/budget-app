import { useLocalSearchParams } from 'expo-router';

import { DebtDetail } from '@/screens/debt-detail';

export default function DebtDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DebtDetail id={id} />;
}
