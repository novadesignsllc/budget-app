import { Pressable, View } from 'react-native';

import { useColors } from '@/theme';
import { closeSheet } from '@/utils/close-sheet';

import { Icon } from './icon';
import { Text } from './text';

/**
 * A sheet's centered title with a round close button on the right. Sheets hide the
 * native header, so this is their title bar.
 */
export function SheetHeader({ title, onClose = closeSheet }: { title: string; onClose?: () => void }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <View style={{ width: 30 }} />
      <Text variant="section" align="center" style={{ flex: 1, fontSize: 15, fontWeight: '700' }} accessibilityRole="header">
        {title}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close"
        hitSlop={8}
        onPress={onClose}
        style={({ pressed }) => ({
          width: 30,
          height: 30,
          borderRadius: 15,
          borderWidth: 1,
          borderColor: colors.borderStrong,
          backgroundColor: pressed ? colors.control : colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        })}
      >
        <Icon sf="xmark" md="close" size={11} color={colors.textSecondary} weight="bold" />
      </Pressable>
    </View>
  );
}
