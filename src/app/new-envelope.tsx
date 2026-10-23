import { useLocalSearchParams } from 'expo-router';

import { NewEnvelope } from '@/screens/new-envelope';

export default function NewEnvelopeRoute() {
  const { month } = useLocalSearchParams<{ month?: string }>();
  return <NewEnvelope month={month} />;
}
