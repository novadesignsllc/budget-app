import { useLocalSearchParams } from 'expo-router';

import { GroupLook } from '@/screens/group-look';

export default function GroupLookRoute() {
  const { name } = useLocalSearchParams<{ name: string }>();
  return <GroupLook group={name ?? 'Daily'} />;
}
