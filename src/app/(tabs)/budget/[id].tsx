import { useLocalSearchParams } from 'expo-router';

import { useIsDesktop } from '@/components/dock';
import { DesktopEnvelope } from '@/desktop/envelope';
import { EnvelopeDetail } from '@/screens/envelope-detail';

export default function EnvelopeRoute() {
  const { id, month } = useLocalSearchParams<{ id: string; month?: string }>();
  return useIsDesktop() ? <DesktopEnvelope id={id} month={month} /> : <EnvelopeDetail id={id} month={month} />;
}
