import { useLocalSearchParams } from 'expo-router';

import { Transfer } from '@/screens/transfer';

export default function TransferRoute() {
  const { from, to } = useLocalSearchParams<{ from?: string; to?: string }>();
  return <Transfer from={from} to={to} />;
}
