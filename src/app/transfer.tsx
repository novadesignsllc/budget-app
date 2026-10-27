import { useLocalSearchParams } from 'expo-router';

import { Transfer } from '@/screens/transfer';

export default function TransferRoute() {
  const { from, to, amount } = useLocalSearchParams<{ from?: string; to?: string; amount?: string }>();
  return <Transfer from={from} to={to} amount={amount} />;
}
