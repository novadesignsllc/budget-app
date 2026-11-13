import { useLocalSearchParams } from 'expo-router';

import { BankMatch } from '@/screens/bank-match';

export default function BankMatchRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BankMatch id={id} />;
}
