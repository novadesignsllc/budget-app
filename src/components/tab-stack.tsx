import { Stack, type NativeStackHeaderProps } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, useColors } from '@/theme';

import { Icon } from './icon';
import { Text } from './text';

/**
 * Our own header instead of the native bar, so iOS never wraps the back button in
 * liquid glass. A plain purple "‹ Budget" on the left, the centered title block, and
 * nothing on the right (actions live at the bottom right).
 */
function AppHeader({ options, back, navigation }: NativeStackHeaderProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const title = typeof options.headerTitle === 'function' ? options.headerTitle({ children: options.title ?? '' }) : (
    <Text variant="title" numberOfLines={1} accessibilityRole="header">
      {options.title}
    </Text>
  );
  return (
    <View
      style={{
        paddingTop: insets.top + 4,
        paddingBottom: spacing.sm,
        paddingHorizontal: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.background,
      }}
    >
      <View style={{ width: 88, alignItems: 'flex-start' }}>
        {back ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Back to ${back.title ?? 'previous screen'}`}
            hitSlop={10}
            onPress={() => navigation.goBack()}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 2, opacity: pressed ? 0.5 : 1 })}
          >
            <Icon sf="chevron.left" md="chevron_left" size={15} color={colors.accent} weight="semibold" />
            <Text variant="body" tone="accent" numberOfLines={1} style={{ maxWidth: 70 }}>
              {back.title ?? 'Back'}
            </Text>
          </Pressable>
        ) : null}
      </View>
      <View style={{ flex: 1, alignItems: 'center' }}>{title}</View>
      <View style={{ width: 88 }} />
    </View>
  );
}

/** The stack inside each tab: our flat header with a centered title. */
export function TabStack({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Stack
      screenOptions={{
        header: (props) => <AppHeader {...props} />,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title }} />
    </Stack>
  );
}
