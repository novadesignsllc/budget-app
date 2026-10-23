import { View, useWindowDimensions } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { gutter, maxContentWidth, radius, spacing, useColors } from '@/theme';

const GAP = spacing.md;

function Slide({
  index,
  step,
  scrollX,
  reduceMotion,
  children,
}: {
  index: number;
  step: number;
  scrollX: SharedValue<number>;
  reduceMotion: boolean;
  children: React.ReactNode;
}) {
  // Cards next to the one in view sit slightly smaller and dimmer, and grow as they arrive.
  const style = useAnimatedStyle(() => {
    if (reduceMotion) return {};
    const d = Math.abs(scrollX.value / step - index);
    return {
      opacity: interpolate(d, [0, 1], [1, 0.7], 'clamp'),
      transform: [{ scale: interpolate(d, [0, 1], [1, 0.95], 'clamp') }],
    };
  });
  return <Animated.View style={style}>{children}</Animated.View>;
}

function Dot({ index, step, scrollX }: { index: number; step: number; scrollX: SharedValue<number> }) {
  const colors = useColors();
  const style = useAnimatedStyle(() => {
    const d = Math.abs(scrollX.value / step - index);
    return { width: interpolate(d, [0, 1], [16, 6], 'clamp'), opacity: interpolate(d, [0, 1], [1, 0.35], 'clamp') };
  });
  return <Animated.View style={[{ height: 6, borderRadius: radius.full, backgroundColor: colors.text }, style]} />;
}

/**
 * Cards in a row you swipe through, snapping one at a time, with the next card peeking.
 * `renderCard` gets the card width so faces keep their proportions on any screen.
 */
export function CardCarousel<T>({
  items,
  keyOf,
  renderCard,
  peek = 56,
  dots,
}: {
  items: T[];
  keyOf: (item: T) => string;
  renderCard: (item: T, width: number) => React.ReactNode;
  peek?: number;
  dots?: boolean;
}) {
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth, maxContentWidth);
  const cardWidth = Math.min(340, width - gutter * 2 - (items.length > 1 ? peek : 0));
  const step = cardWidth + GAP;
  const scrollX = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });

  return (
    <View style={{ gap: spacing.md, marginHorizontal: -gutter }}>
      <Animated.ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={step}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingHorizontal: gutter, gap: GAP }}
      >
        {items.map((item, i) => (
          <Slide key={keyOf(item)} index={i} step={step} scrollX={scrollX} reduceMotion={reduceMotion}>
            {renderCard(item, cardWidth)}
          </Slide>
        ))}
      </Animated.ScrollView>
      {dots && items.length > 1 && (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: spacing.xs + 2 }}>
          {items.map((item, i) => (
            <Dot key={keyOf(item)} index={i} step={step} scrollX={scrollX} />
          ))}
        </View>
      )}
    </View>
  );
}
