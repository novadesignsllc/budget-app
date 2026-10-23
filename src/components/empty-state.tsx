import { View } from 'react-native';

import { radius, spacing, useColors } from '@/theme';

import { Text } from './text';

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  const colors = useColors();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        padding: spacing.xl,
        gap: spacing.sm,
        alignItems: 'flex-start',
      }}
    >
      <Text variant="headline">{title}</Text>
      {body && (
        <Text variant="callout" tone="textSecondary">
          {body}
        </Text>
      )}
      {action && <View style={{ marginTop: spacing.sm }}>{action}</View>}
    </View>
  );
}
