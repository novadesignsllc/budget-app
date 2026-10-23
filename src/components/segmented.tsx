import { Pressable, View } from 'react-native';

import { haptic } from '@/utils/haptics';
import { radius, spacing, useColors } from '@/theme';

import { Text } from './text';

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const colors = useColors();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: colors.fill,
        borderRadius: radius.full,
        padding: spacing.xxs + 1,
      }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) haptic('selection');
              onChange(o.value);
            }}
            style={{
              flex: 1,
              height: 34,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.full,
              backgroundColor: selected ? colors.surface : 'transparent',
              boxShadow: selected ? '0 1px 3px rgba(0, 0, 0, 0.10)' : undefined,
            }}
          >
            <Text variant="callout" weight={selected ? '600' : '500'} tone={selected ? 'text' : 'textSecondary'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
