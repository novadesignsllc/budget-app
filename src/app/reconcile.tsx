import { useLocalSearchParams } from 'expo-router';

import { Reconcile } from '@/screens/reconcile';

export default function ReconcileRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Reconcile id={id} />;
}
