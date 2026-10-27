import { Pressable, View } from 'react-native';

import { radius, useColors } from '@/theme';

import { Text } from './text';

/** A small set of filter pills, like 3 mo · 6 mo · 1 yr. */
export function RangePills<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const colors = useColors();
  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        alignSelf: 'flex-start',
        padding: 2,
        gap: 2,
        borderRadius: radius.button,
        backgroundColor: colors.control,
      }}
    >
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.value)}
            style={{
              height: 26,
              paddingHorizontal: 10,
              borderRadius: radius.button - 2,
              justifyContent: 'center',
              backgroundColor: on ? colors.surface : 'transparent',
            }}
          >
            <Text variant="footnote" weight={on ? '600' : '500'} tone={on ? 'text' : 'textSecondary'}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
