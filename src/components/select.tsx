import { Host, Picker } from '@expo/ui';
import { View } from 'react-native';

import { radius, spacing, useColors } from '@/theme';

import { FieldLabel } from './field';
import { Text } from './text';

export type SelectOption<T extends string> = { value: T; label: string };

/** A labeled dropdown. On iPhone it's the native menu picker. */
export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
}) {
  const colors = useColors();
  const current = options.find((o) => o.value === value)?.label ?? '';
  return (
    <View style={{ gap: spacing.xs + 2 }}>
      <FieldLabel label={label} />
      <View
        style={{
          height: 44,
          borderRadius: radius.md,
          borderCurve: 'continuous',
          backgroundColor: colors.fill,
          paddingLeft: spacing.lg - 2,
          paddingRight: spacing.xs,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>
          {current}
        </Text>
        <Host matchContents>
          <Picker selectedValue={value} onValueChange={(v) => onChange(v as T)} appearance="menu">
            {options.map((o) => (
              <Picker.Item key={o.value} label={o.label} value={o.value} />
            ))}
          </Picker>
        </Host>
      </View>
    </View>
  );
}
