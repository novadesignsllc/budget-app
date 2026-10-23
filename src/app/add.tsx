import { useLocalSearchParams } from 'expo-router';

import { QuickAdd } from '@/screens/quick-add';

export default function AddRoute() {
  const { voice } = useLocalSearchParams<{ voice?: string }>();
  return <QuickAdd voice={voice === '1'} />;
}
