import { Stack } from 'expo-router';

import { Text } from './text';

function TitleBlock({ title }: { title: string }) {
  return (
    <Text variant="title" numberOfLines={1} accessibilityRole="header">
      {title}
    </Text>
  );
}

/** Centered screen title. Nothing sits above it; the screen says the rest. */
export function ScreenTitle({ title }: { title: string }) {
  return <Stack.Screen options={{ title, headerTitle: () => <TitleBlock title={title} /> }} />;
}
