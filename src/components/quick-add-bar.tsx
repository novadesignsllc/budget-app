import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { haptic } from '@/utils/haptics';
import { radius, spacing, useColors } from '@/theme';

import { Icon } from './icon';
import { Text } from './text';

/**
 * The entry point for adding a transaction, visible on every tab.
 * `compact` is the minimized form the iOS tab bar uses while scrolling.
 */
export function QuickAddBar({ compact, floating }: { compact?: boolean; floating?: boolean }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add a transaction"
      onPress={() => {
        haptic('light');
        router.push('/add');
      }}
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.lg,
        height: compact ? 40 : 48,
        borderRadius: radius.full,
        opacity: pressed ? 0.7 : 1,
        ...(floating && {
          backgroundColor: colors.surface,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
        }),
      })}
    >
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: radius.full,
          backgroundColor: colors.ink,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon sf="plus" md="add" size={14} color={colors.onInk} weight="bold" />
      </View>
      {!compact && (
        <Text variant="body" tone="textSecondary" style={{ flex: 1 }} numberOfLines={1}>
          McDonald’s 10.99
        </Text>
      )}
      {!compact && <Icon sf="mic" md="mic" size={18} color={colors.textTertiary} />}
    </Pressable>
  );
}
