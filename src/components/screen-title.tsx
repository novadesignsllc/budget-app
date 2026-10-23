import { Stack } from 'expo-router';
import { View } from 'react-native';

import { Text } from './text';

function TitleBlock({ title, context }: { title: string; context?: string }) {
  return (
    <View style={{ alignItems: 'center' }}>
      {context ? (
        <Text variant="footnote" tone="textSecondary" numberOfLines={1}>
          {context}
        </Text>
      ) : null}
      <Text variant="title" numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
    </View>
  );
}

/** Centered screen title with one line of context above it (principle 2). */
export function ScreenTitle({ title, context }: { title: string; context?: string }) {
  return <Stack.Screen options={{ title, headerTitle: () => <TitleBlock title={title} context={context} /> }} />;
}
