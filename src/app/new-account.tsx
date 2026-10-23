import { useLocalSearchParams } from 'expo-router';

import { NewAccount } from '@/screens/new-account';

export default function NewAccountRoute() {
  const { debt } = useLocalSearchParams<{ debt?: string }>();
  return <NewAccount debt={debt === '1'} />;
}
