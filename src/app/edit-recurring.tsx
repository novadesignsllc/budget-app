import { useLocalSearchParams } from 'expo-router';

import { EditRecurring } from '@/screens/edit-recurring';

export default function EditRecurringRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <EditRecurring id={id} />;
}
