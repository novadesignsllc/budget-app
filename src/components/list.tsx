import { router, type Href } from 'expo-router';
import { Children, Fragment, isValidElement } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, useColors } from '@/theme';

import { Icon } from './icon';
import { Text } from './text';

/** Hairline inset for rows that start with a RowIcon, so lines meet the text. */
export const ICON_INSET = spacing.lg - 2 + 34 + spacing.md;

/**
 * A group of rows on one flat surface, split by hairlines. This is how content is
 * grouped everywhere: rows are never individual cards, and nothing here has a shadow.
 */
export function Section({
  title,
  detail,
  action,
  footer,
  inset = spacing.lg,
  children,
  style,
}: {
  title?: string;
  /** Short summary shown at the right of the title. */
  detail?: string;
  action?: React.ReactNode;
  footer?: string;
  /** Where hairlines start, so they line up with row text rather than icons. */
  inset?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[{ gap: spacing.sm }, style]}>
      {(title || action || detail) && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: spacing.md,
            paddingHorizontal: spacing.xs,
          }}
        >
          {title ? (
            <Text variant="headline" accessibilityRole="header">
              {title}
            </Text>
          ) : (
            <View />
          )}
          {action ??
            (detail ? (
              <Text variant="footnote" tone="textSecondary" numberOfLines={1} style={{ flexShrink: 1 }}>
                {detail}
              </Text>
            ) : null)}
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
              <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.separator, marginLeft: inset }} />
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
  subtitleTone,
  leading,
  trailing,
  below,
  href,
  onPress,
  chevron,
  titleTone,
  accessibilityLabel,
}: {
  title: string;
  subtitle?: string;
  subtitleTone?: 'textSecondary' | 'negative' | 'positive' | 'accent' | 'blue';
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  /** Full-width content under the row, like a progress bar. */
  below?: React.ReactNode;
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
        paddingHorizontal: spacing.lg - 2,
        paddingVertical: spacing.md - 1,
        gap: spacing.sm + 2,
        backgroundColor: pressed ? colors.fill : colors.surface,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 34 }}>
        {leading}
        <View style={{ flex: 1, gap: 1 }}>
          <Text variant="body" weight="500" tone={titleTone ?? 'text'} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text variant="footnote" tone={subtitleTone ?? 'textSecondary'} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {trailing}
        {chevron && (
          <Icon sf="chevron.right" md="chevron_right" size={12} color={colors.textTertiary} weight="semibold" />
        )}
      </View>
      {below}
    </Pressable>
  );
}

/** A rounded-square icon tile for the leading slot of a row. */
export function RowIcon({
  sf,
  md,
  fg,
  bg,
  round,
}: {
  sf: Parameters<typeof Icon>[0]['sf'];
  md: Parameters<typeof Icon>[0]['md'];
  fg: string;
  bg: string;
  round?: boolean;
}) {
  return (
    <View
      style={{
        width: 34,
        height: 34,
        borderRadius: round ? radius.full : 10,
        borderCurve: 'continuous',
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon sf={sf} md={md} size={16} color={fg} />
    </View>
  );
}
