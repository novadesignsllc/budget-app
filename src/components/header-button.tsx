import { Pressable } from 'react-native';

import { spacing } from '@/theme';

import { Icon } from './icon';

export function HeaderButton({
  sf,
  md,
  label,
  onPress,
}: {
  sf: Parameters<typeof Icon>[0]['sf'];
  md: Parameters<typeof Icon>[0]['md'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => ({ padding: spacing.xs, opacity: pressed ? 0.5 : 1 })}
    >
      <Icon sf={sf} md={md} size={22} />
    </Pressable>
  );
}
