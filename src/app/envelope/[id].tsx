import { useLocalSearchParams } from 'expo-router';

import { EnvelopeSheet } from '@/screens/envelope';

export default function EnvelopeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EnvelopeSheet id={id} />;
}
