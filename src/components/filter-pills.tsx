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
  floating,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  center?: boolean;
  /** In the bottom action bar, over the list: button-height pills with a fill so they stay readable. */
  floating?: boolean;
}) {
  const colors = useColors();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{
        gap: floating ? 6 : spacing.xs,
        flexGrow: 1,
        justifyContent: center ? 'center' : 'flex-start',
        alignItems: 'center',
      }}
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
              height: floating ? 34 : 26,
              paddingHorizontal: floating ? 13 : 11,
              borderRadius: floating ? 17 : 13,
              borderWidth: 1,
              borderColor: selected ? 'rgba(20,40,80,0.16)' : floating ? colors.hairline : 'transparent',
              backgroundColor: selected ? colors.surface : floating ? '#E9EDF3' : 'transparent',
              justifyContent: 'center',
            }}
          >
            <Text
              variant={floating ? 'callout' : 'footnote'}
              weight={selected ? '600' : '500'}
              tone={selected ? 'text' : 'textSecondary'}
            >
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
