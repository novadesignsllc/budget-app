import { useLocalSearchParams } from 'expo-router';

import { Reconcile } from '@/screens/reconcile';

export default function ReconcileRoute() {
  const { id, ids } = useLocalSearchParams<{ id: string; ids?: string }>();
  return <Reconcile id={id} ids={ids ? ids.split(',').filter(Boolean) : []} />;
}
