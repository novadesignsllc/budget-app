import { ScrollView, useWindowDimensions, type ScrollViewProps } from 'react-native';

import { gutter, maxContentWidth, spacing } from '@/theme';

/** Bottom room for the floating quick-add bar on phone-width web. */
function useWebBottomRoom() {
  const { width } = useWindowDimensions();
  return process.env.EXPO_OS === 'web' && width < 900 ? 96 : 0;
}

/** The scroll container every tab screen uses: gutter, section rhythm, readable width. */
export function Screen({ children, contentContainerStyle, ...props }: ScrollViewProps) {
  const webRoom = useWebBottomRoom();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        {
          padding: gutter,
          paddingBottom: spacing.xxxl + webRoom,
          gap: spacing.xl,
          width: '100%',
          maxWidth: maxContentWidth,
          alignSelf: 'center',
        },
        contentContainerStyle,
      ]}
      {...props}
    >
      {children}
    </ScrollView>
  );
}

/** Content for a form sheet: tighter top, same gutter. */
export function SheetScreen({ children, contentContainerStyle, ...props }: ScrollViewProps) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        { padding: gutter, paddingTop: spacing.xl, gap: spacing.xl, paddingBottom: spacing.xxxl },
        contentContainerStyle,
      ]}
      {...props}
    >
      {children}
    </ScrollView>
  );
}
