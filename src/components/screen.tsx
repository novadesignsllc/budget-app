import { ScrollView, type ScrollViewProps } from 'react-native';

import { gutter, maxContentWidth, spacing } from '@/theme';

import { useDock } from './dock';

/** The scroll container for tab screens: gutter, card rhythm, room for the dock and actions. */
export function Screen({ children, contentContainerStyle, ...props }: ScrollViewProps) {
  const { height } = useDock();
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        {
          paddingHorizontal: gutter,
          paddingTop: spacing.xs,
          paddingBottom: height + 64,
          gap: spacing.md,
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

/** Content for a form sheet. */
export function SheetScreen({ children, contentContainerStyle, ...props }: ScrollViewProps) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[
        { padding: gutter, paddingTop: spacing.lg, gap: spacing.md + 2, paddingBottom: spacing.xxxl },
        contentContainerStyle,
      ]}
      {...props}
    >
      {children}
    </ScrollView>
  );
}
