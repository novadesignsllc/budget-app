import { useLocalSearchParams } from 'expo-router';

import { Statement } from '@/screens/statement';

export default function StatementRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Statement id={id} />;
}
