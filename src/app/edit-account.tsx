import { useLocalSearchParams } from 'expo-router';

import { EditAccount } from '@/screens/edit-account';

export default function EditAccountRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EditAccount id={id} />;
}
