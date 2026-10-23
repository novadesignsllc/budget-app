import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, useColors } from '@/theme';

import { Icon } from './icon';
import { Text } from './text';

type IconSpec = { sf: Parameters<typeof Icon>[0]['sf']; md: Parameters<typeof Icon>[0]['md']; color: string; bg: string };

/** The one card: white, 1px border, radius 16, no shadow. Everything groups into these. */
export function Card({
  children,
  padded,
  tone = 'default',
  style,
}: {
  children: React.ReactNode;
  /** Inner padding for free-form content (charts, summaries). Lists leave it off. */
  padded?: boolean;
  tone?: 'default' | 'urgent' | 'due' | 'slip';
  style?: StyleProp<ViewStyle>;
}) {
  const colors = useColors();
  const border =
    tone === 'urgent'
      ? 'rgba(217,45,32,0.35)'
      : tone === 'slip'
        ? 'rgba(217,45,32,0.35)'
        : tone === 'due'
          ? 'rgba(194,86,15,0.35)'
          : colors.border;
  return (
    <View
      style={[
        {
          backgroundColor: tone === 'slip' ? colors.negativeTint : colors.surface,
          borderWidth: 1,
          borderColor: border,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          overflow: 'hidden',
        },
        padded && { paddingHorizontal: spacing.lg, paddingVertical: spacing.md + 2, gap: spacing.md },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** A card's header row: optional icon tile, title, and a detail or link on the right. */
export function CardHeader({
  title,
  detail,
  icon,
  dot,
  action,
}: {
  title: string;
  detail?: string;
  icon?: IconSpec;
  /** A small colored dot before the title (envelope groups). */
  dot?: string;
  action?: { label: string; onPress: () => void };
}) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm + 1,
        paddingHorizontal: spacing.md + 2,
        paddingVertical: spacing.md - 1,
        borderBottomWidth: 1,
        borderBottomColor: colors.separator,
      }}
    >
      {icon && (
        <View
          style={{
            width: 24,
            height: 24,
            borderRadius: 7,
            backgroundColor: icon.bg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon sf={icon.sf} md={icon.md} size={12} color={icon.color} />
        </View>
      )}
      {dot && <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot }} />}
      <Text variant="section" style={{ flex: 1 }} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      {action ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={action.onPress}>
          <Text variant="footnote" weight="600" tone="accent">
            {action.label}
          </Text>
        </Pressable>
      ) : detail ? (
        <Text variant="footnote" tone="textSecondary" numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

/** A full-width link along the bottom of a card ("Show all 47 ›"). */
export function CardFooterLink({
  label,
  onPress,
  tone = 'accent',
}: {
  label: string;
  onPress: () => void;
  tone?: 'accent' | 'negative';
}) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        paddingHorizontal: spacing.md + 2,
        paddingVertical: spacing.md - 2,
        borderTopWidth: 1,
        borderTopColor: colors.separator,
        backgroundColor: pressed ? colors.control : 'transparent',
      })}
    >
      <Text variant="callout" weight="600" tone={tone}>
        {label}
      </Text>
    </Pressable>
  );
}

export type Column = { label: string; width?: number; align?: 'left' | 'right' };

/** The faint strip of uppercase column labels at the top of a table card. */
export function TableHeader({ columns, leading = 0 }: { columns: Column[]; leading?: number }) {
  const colors = useColors();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingVertical: 7,
        backgroundColor: colors.tableHeader,
        borderBottomWidth: 1,
        borderBottomColor: colors.separator,
      }}
    >
      {leading > 0 && <View style={{ width: leading }} />}
      {columns.map((c) => (
        <Text
          key={c.label}
          variant="label"
          tone="textTertiary"
          caps
          numberOfLines={1}
          style={[c.width ? { width: c.width } : { flex: 1 }, { textAlign: c.align ?? 'left', fontSize: 9 }]}
        >
          {c.label}
        </Text>
      ))}
    </View>
  );
}

/** A small rounded tile with an icon, for a card header or a grid tile. */
export function IconTile({ sf, md, color, bg, size = 28 }: IconSpec & { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon sf={sf} md={md} size={Math.round(size * 0.46)} color={color} />
    </View>
  );
}
