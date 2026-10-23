import { useLocalSearchParams } from 'expo-router';

import { EnvelopeSettings } from '@/screens/envelope-settings';

export default function EnvelopeSettingsRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EnvelopeSettings id={id} />;
}
