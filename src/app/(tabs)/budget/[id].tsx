import { useLocalSearchParams } from 'expo-router';

import { EnvelopeDetail } from '@/screens/envelope-detail';

export default function EnvelopeRoute() {
  const { id, month } = useLocalSearchParams<{ id: string; month?: string }>();
  return <EnvelopeDetail id={id} month={month} />;
}
