import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, View } from 'react-native';

import { cardFaces, radius, spacing } from '@/theme';

import { Text } from './text';

/**
 * An account or debt drawn as a card. Faces come from `cardFaces` by index, so each
 * account keeps its color.
 */
export function CardFace({
  face,
  width,
  title,
  caption,
  amount,
  footnote,
  footnoteTone,
  onPress,
  accessibilityLabel,
}: {
  face: number;
  width: number;
  title: string;
  caption?: string;
  amount: string;
  footnote?: string;
  footnoteTone?: 'muted' | 'good' | 'bad';
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const f = cardFaces[face % cardFaces.length];
  const muted = f.ink === '#FFFFFF' ? 'rgba(255,255,255,0.72)' : 'rgba(11,11,15,0.6)';
  const footColor =
    footnoteTone === 'good'
      ? f.ink === '#FFFFFF'
        ? '#9BF0BE'
        : '#13803F'
      : footnoteTone === 'bad'
        ? f.ink === '#FFFFFF'
          ? '#FFB4AD'
          : '#B42318'
        : muted;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => ({ width, transform: [{ scale: pressed ? 0.98 : 1 }] })}
    >
      <LinearGradient
        colors={[f.from, f.to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          height: Math.round(width * 0.6),
          borderRadius: radius.xl,
          borderCurve: 'continuous',
          padding: spacing.lg + 2,
          justifyContent: 'space-between',
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
          <Text variant="callout" weight="600" color={f.ink} numberOfLines={1} style={{ flex: 1 }}>
            {title}
          </Text>
          {caption ? (
            <Text variant="footnote" color={muted} numberOfLines={1}>
              {caption}
            </Text>
          ) : null}
        </View>
        <View style={{ gap: 2 }}>
          <Text variant="title" weight="700" color={f.ink} style={{ fontSize: 26, lineHeight: 31, letterSpacing: -0.6, fontVariant: ['tabular-nums'] }}>
            {amount}
          </Text>
          {footnote ? (
            <Text variant="footnote" color={footColor} numberOfLines={1}>
              {footnote}
            </Text>
          ) : null}
        </View>
      </LinearGradient>
    </Pressable>
  );
}
