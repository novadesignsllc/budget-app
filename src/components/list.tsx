import { router, type Href } from 'expo-router';
import { Children, Fragment, isValidElement } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, useColors } from '@/theme';

import { Icon } from './icon';
import { Text } from './text';

/**
 * A grouped block of rows on one surface, separated by hairlines. This is the main
 * way content is grouped; rows are never individual cards.
 */
export function Section({
  title,
  action,
  footer,
  children,
  style,
}: {
  title?: string;
  action?: React.ReactNode;
  footer?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[{ gap: spacing.sm }, style]}>
      {(title || action) && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            paddingHorizontal: spacing.xs,
          }}
        >
          {title ? (
            <Text variant="callout" weight="600" tone="textSecondary" accessibilityRole="header">
              {title}
            </Text>
          ) : (
            <View />
          )}
          {action}
        </View>
      )}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderCurve: 'continuous',
          overflow: 'hidden',
        }}
      >
        {rows.map((row, i) => (
          <Fragment key={row.key ?? i}>
            {i > 0 && (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: colors.separator,
                  marginLeft: spacing.lg,
                }}
              />
            )}
            {row}
          </Fragment>
        ))}
      </View>
      {footer && (
        <Text variant="footnote" tone="textSecondary" style={{ paddingHorizontal: spacing.xs }}>
          {footer}
        </Text>
      )}
    </View>
  );
}

export function Row({
  title,
  subtitle,
  leading,
  trailing,
  href,
  onPress,
  chevron,
  titleTone,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: Href;
  onPress?: () => void;
  chevron?: boolean;
  titleTone?: 'text' | 'negative' | 'accent';
  accessibilityLabel?: string;
}) {
  const colors = useColors();
  const interactive = !!(href || onPress);
  return (
    <Pressable
      accessibilityRole={interactive ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      disabled={!interactive}
      onPress={href ? () => router.push(href) : onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
        minHeight: 56,
        backgroundColor: pressed ? colors.fill : 'transparent',
      })}
    >
      {leading}
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text variant="body" tone={titleTone ?? 'text'} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" tone="textSecondary" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {chevron && <Icon sf="chevron.right" md="chevron_right" size={13} color={colors.textTertiary} weight="semibold" />}
    </Pressable>
  );
}

/** A round tinted badge for the leading slot of a row. */
export function RowIcon({
  sf,
  md,
  tone = 'default',
}: {
  sf: Parameters<typeof Icon>[0]['sf'];
  md: Parameters<typeof Icon>[0]['md'];
  tone?: 'default' | 'accent' | 'negative' | 'positive';
}) {
  const colors = useColors();
  const map = {
    default: [colors.fill, colors.text],
    accent: [colors.accentSoft, colors.accent],
    negative: [colors.negativeSoft, colors.negative],
    positive: [colors.positiveSoft, colors.positive],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View
      style={{
        width: 36,
        height: 36,
        borderRadius: radius.full,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon sf={sf} md={md} size={17} color={fg} />
    </View>
  );
}
