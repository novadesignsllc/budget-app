import { useLocalSearchParams } from 'expo-router';

import { EditProfile } from '@/screens/edit-profile';

export default function EditProfileRoute() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <EditProfile id={id} />;
}
