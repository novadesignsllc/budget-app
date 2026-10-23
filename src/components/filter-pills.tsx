import { Pressable, ScrollView } from 'react-native';

import { haptic } from '@/utils/haptics';
import { spacing, useColors } from '@/theme';

import { Text } from './text';

/** Sorts and filters: the only pill-shaped controls in the app (principle 3). */
export function FilterPills<T extends string>({
  value,
  options,
  onChange,
  center,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  center?: boolean;
}) {
  const colors = useColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.xs, flexGrow: 1, justifyContent: center ? 'center' : 'flex-start' }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) haptic('selection');
              onChange(o.value);
            }}
            style={{
              height: 26,
              paddingHorizontal: 11,
              borderRadius: 13,
              borderWidth: 1,
              borderColor: selected ? 'rgba(20,40,80,0.16)' : 'transparent',
              backgroundColor: selected ? colors.surface : 'transparent',
              justifyContent: 'center',
            }}
          >
            <Text variant="footnote" weight={selected ? '600' : '500'} tone={selected ? 'text' : 'textSecondary'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
