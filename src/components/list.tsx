import { router, type Href } from 'expo-router';
import { Children, isValidElement } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { spacing, useColors } from '@/theme';

import { Card, CardHeader } from './card';
import { Icon } from './icon';
import { Text } from './text';

/** Hairline inset for rows that start with an icon or mini card. */
export const ICON_INSET = 0;

/**
 * Rows inside one card, with the title as the card's header row (Tripsy style).
 * Separators belong to the rows themselves.
 */
export function Section({
  title,
  detail,
  action,
  footer,
  dot,
  children,
  style,
}: {
  title?: string;
  detail?: string;
  action?: React.ReactNode;
  footer?: string;
  dot?: string;
  inset?: number;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[{ gap: spacing.xs + 2 }, style]}>
      <Card>
        {title ? (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <CardHeader title={title} detail={action ? undefined : detail} dot={dot} />
            </View>
            {action ? <View style={{ position: 'absolute', right: spacing.md + 2 }}>{action}</View> : null}
          </View>
        ) : null}
        {rows.map((row, i) => (
          <View key={row.key ?? i} style={i < rows.length - 1 ? { borderBottomWidth: 1, borderBottomColor: 'rgba(20,40,80,0.06)' } : null}>
            {row}
          </View>
        ))}
      </Card>
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
  subtitleTone?: 'textSecondary' | 'negative' | 'positive' | 'accent' | 'blue' | 'orange';
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
        paddingHorizontal: spacing.md + 2,
        paddingVertical: 9,
        gap: 6,
        backgroundColor: pressed ? colors.control : colors.surface,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md - 2 }}>
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
        {chevron && <Icon sf="chevron.right" md="chevron_right" size={11} color={colors.textTertiary} weight="semibold" />}
      </View>
      {below}
    </Pressable>
  );
}

/** A round tinted icon for the leading slot of a row. */
export function RowIcon({
  sf,
  md,
  fg,
  bg,
}: {
  sf: Parameters<typeof Icon>[0]['sf'];
  md: Parameters<typeof Icon>[0]['md'];
  fg: string;
  bg: string;
  round?: boolean;
}) {
  return (
    <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon sf={sf} md={md} size={13} color={fg} />
    </View>
  );
}
