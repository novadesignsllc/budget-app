import { useLocalSearchParams } from 'expo-router';

import { EnvelopeSettings } from '@/screens/envelope-settings';

export default function EnvelopeSettingsRoute() {
  const { id, month } = useLocalSearchParams<{ id: string; month?: string }>();
  return <EnvelopeSettings id={id} month={month} />;
}
