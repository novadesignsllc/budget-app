import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { View } from 'react-native';

import { fromISODate, toISODate } from '@/domain/dates';
import type { ISODate } from '@/domain/types';
import { spacing } from '@/theme';

import { Text } from './text';

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: ISODate;
  onChange: (value: ISODate) => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
      <Text variant="body">{label}</Text>
      <DateTimePicker
        value={fromISODate(value)}
        mode="date"
        display="compact"
        onValueChange={(_e, date) => onChange(toISODate(date))}
      />
    </View>
  );
}
