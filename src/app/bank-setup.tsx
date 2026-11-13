import { useLocalSearchParams } from 'expo-router';

import { BankSetup } from '@/screens/bank-setup';

export default function BankSetupRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <BankSetup id={id} />;
}
