/* eslint-disable react-hooks/refs -- the drag gestures are built in render and read refs only when they fire. */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { LinearTransition, runOnJS, useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, useColors } from '@/theme';
import { haptic } from '@/utils/haptics';

import { useDock } from './dock';
import { Icon } from './icon';
import { Text } from './text';

export type SortItem = { id: string; name: string };
export type SortGroup = {
  name: string;
  color: string;
  /** Envelopes in a locked group (Bills, Subscriptions, Debt payments) can be reordered but can't leave, and nothing else can join. */
  locked?: boolean;
  items: SortItem[];
};

/** Fixed sizes, so drop spots can be worked out without measuring every row. */
const HEADER = 40;
const ROW = 42;
const GAP = spacing.md;
const EDGE = 1;
const LONG_PRESS = 180;
const MOTION = LinearTransition.duration(160);

const blockHeight = (g: SortGroup) => EDGE * 2 + HEADER + Math.max(g.items.length, 1) * ROW;

function tops(groups: SortGroup[]) {
  let y = 0;
  return groups.map((g) => {
    const top = y;
    y += blockHeight(g) + GAP;
    return top;
  });
}

type Drag = { kind: 'item'; id: string } | { kind: 'group'; name: string };

/**
 * Sort mode for the budget: press and hold a group header to move the group, or an
 * envelope to move it within its group or into another one. The list scrolls on its own
 * when you drag near the top or bottom. Nothing is saved here; `onChange` gets each new
 * order and the screen decides when to keep it.
 */
export function SortList({
  groups,
  onChange,
  scroller,
  onDragChange,
}: {
  groups: SortGroup[];
  onChange: (groups: SortGroup[]) => void;
  /** The screen's scroll position and a way to nudge it, for scrolling while dragging. */
  scroller: { offset: () => number; scrollBy: (dy: number) => void };
  onDragChange: (dragging: boolean) => void;
}) {
  const colors = useColors();
  const { height: windowHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const dock = useDock();
  const [drag, setDrag] = useState<Drag | null>(null);
  const overlayY = useSharedValue(0);

  // Latest values for the gesture callbacks, which outlive a render.
  const latest = useRef({ groups, drag });
  useLayoutEffect(() => {
    latest.current = { groups, drag };
  });
  const start = useRef({ top: 0, offset: 0, ty: 0, absY: 0 });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  function begin(next: Drag, top: number, absY: number) {
    haptic('medium');
    start.current = { top, offset: scroller.offset(), ty: 0, absY };
    overlayY.value = top;
    setDrag(next);
    onDragChange(true);
    // Scroll while the finger rests near the top or bottom edge.
    timer.current = setInterval(() => {
      const { absY } = start.current;
      if (!absY) return;
      const topEdge = insets.top + 110;
      const bottomEdge = windowHeight - dock.height - 70;
      if (absY < topEdge) scroller.scrollBy(-Math.min(14, (topEdge - absY) / 4 + 4));
      else if (absY > bottomEdge) scroller.scrollBy(Math.min(14, (absY - bottomEdge) / 4 + 4));
      else return;
      move(start.current.ty, absY);
    }, 16);
  }

  function move(ty: number, absY: number) {
    start.current.ty = ty;
    start.current.absY = absY;
    const { groups: current, drag: active } = latest.current;
    if (!active) return;
    const y = start.current.top + ty + (scroller.offset() - start.current.offset);
    overlayY.value = y;
    const next =
      active.kind === 'item' ? placeItem(current, active.id, y + ROW / 2) : placeGroup(current, active.name, y);
    if (next) {
      haptic('selection');
      onChange(next);
    }
  }

  function end() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    start.current.absY = 0;
    setDrag(null);
    onDragChange(false);
  }

  // What's under the finger when the long press fires: a group header or an envelope.
  function pick(y: number, absY: number) {
    const { groups: current } = latest.current;
    const at = tops(current);
    for (let gi = 0; gi < current.length; gi++) {
      const g = current[gi];
      const top = at[gi];
      if (y < top || y > top + blockHeight(g)) continue;
      const rowsTop = top + EDGE + HEADER;
      if (y < rowsTop) return begin({ kind: 'group', name: g.name }, top, absY);
      const index = Math.floor((y - rowsTop) / ROW);
      const item = g.items[index];
      if (item) return begin({ kind: 'item', id: item.id }, rowsTop + index * ROW, absY);
    }
  }

  // One gesture for the whole list, so it survives rows moving between groups.
  const gesture = Gesture.Pan()
    .activateAfterLongPress(LONG_PRESS)
    .onStart((e) => runOnJS(pick)(e.y, e.absoluteY))
    .onUpdate((e) => runOnJS(move)(e.translationY, e.absoluteY))
    .onFinalize(() => runOnJS(end)());

  const overlay = useAnimatedStyle(() => ({ transform: [{ translateY: overlayY.value }] }));
  const dragged =
    drag?.kind === 'group'
      ? groups.find((g) => g.name === drag.name)
      : drag?.kind === 'item'
        ? groups.flatMap((g) => g.items).find((i) => i.id === drag.id)
        : undefined;

  return (
    <GestureDetector gesture={gesture}>
      <View style={{ gap: GAP }}>
        {groups.map((g, gi) => {
          const isDragged = drag?.kind === 'group' && drag.name === g.name;
          if (isDragged) {
            return (
              <Animated.View
                key={g.name}
                layout={MOTION}
                style={{
                  height: blockHeight(g),
                  borderRadius: radius.card,
                  borderCurve: 'continuous',
                  borderWidth: 1.5,
                  borderStyle: 'dashed',
                  borderColor: colors.accent,
                  backgroundColor: colors.accentSoft,
                }}
              />
            );
          }
          return (
            <Animated.View
              key={g.name}
              layout={MOTION}
              style={{
                borderRadius: radius.card,
                borderCurve: 'continuous',
                borderWidth: EDGE,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                overflow: 'hidden',
              }}
            >
              <GroupHeader group={g} />
              {g.items.length === 0 && (
                <View style={{ height: ROW, justifyContent: 'center', paddingHorizontal: spacing.md + 2 }}>
                  <Text variant="footnote" tone="textTertiary">
                    Drop envelopes here
                  </Text>
                </View>
              )}
              {g.items.map((item, ii) => {
                if (drag?.kind === 'item' && drag.id === item.id) {
                  return (
                    <Animated.View key={item.id} layout={MOTION} style={{ height: ROW, padding: 4 }}>
                      <View
                        style={{
                          flex: 1,
                          borderRadius: 10,
                          borderCurve: 'continuous',
                          borderWidth: 1.5,
                          borderStyle: 'dashed',
                          borderColor: colors.accent,
                          backgroundColor: colors.accentSoft,
                        }}
                      />
                    </Animated.View>
                  );
                }
                return (
                  <Animated.View key={item.id} layout={MOTION}>
                    <ItemRow name={item.name} first={ii === 0} />
                  </Animated.View>
                );
              })}
            </Animated.View>
          );
        })}

        {drag && dragged && (
          <Animated.View
            pointerEvents="none"
            style={[
              {
                position: 'absolute',
                left: -4,
                right: -4,
                top: 0,
                borderRadius: drag.kind === 'group' ? radius.card : 12,
                borderWidth: 1.5,
                borderColor: colors.accent,
                backgroundColor: colors.surface,
                overflow: 'hidden',
              },
              overlay,
            ]}
          >
            <View style={{ transform: [{ rotate: '-1deg' }] }}>
              {drag.kind === 'group' ? (
                <>
                  <GroupHeader group={dragged as SortGroup} lifted />
                  {(dragged as SortGroup).items.map((item, i) => (
                    <ItemRow key={item.id} name={item.name} first={i === 0} />
                  ))}
                </>
              ) : (
                <ItemRow name={(dragged as SortItem).name} first lifted />
              )}
            </View>
          </Animated.View>
        )}
      </View>
    </GestureDetector>
  );
}

function GroupHeader({ group, lifted }: { group: SortGroup; lifted?: boolean }) {
  const colors = useColors();
  return (
    <View
      accessibilityRole="button"
      accessibilityLabel={`${group.name}. Press and hold, then drag to move the group`}
      style={{
        height: HEADER,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md + 2,
        backgroundColor: colors.tableHeader,
      }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: group.color }} />
      <Text variant="headline" style={{ flex: 1 }} numberOfLines={1}>
        {group.name}
      </Text>
      <Icon sf="line.3.horizontal" md="drag_handle" size={16} color={lifted ? colors.accent : colors.textTertiary} />
    </View>
  );
}

function ItemRow({ name, first, lifted }: { name: string; first: boolean; lifted?: boolean }) {
  const colors = useColors();
  return (
    <View
      accessibilityRole="button"
      accessibilityLabel={`${name}. Press and hold, then drag to move`}
      style={{
        height: ROW,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: spacing.md + 2,
        borderTopWidth: 1,
        borderTopColor: first ? colors.separator : colors.hairline,
        backgroundColor: colors.surface,
      }}
    >
      <Text variant="body" weight={lifted ? '600' : '400'} numberOfLines={1} style={{ flex: 1 }}>
        {name}
      </Text>
      <Icon sf="line.3.horizontal" md="drag_handle" size={16} color={lifted ? colors.accent : colors.disabled} />
    </View>
  );
}

/** Where the dragged envelope belongs with its middle at `center`; null if unchanged. */
function placeItem(groups: SortGroup[], id: string, center: number): SortGroup[] | null {
  const from = groups.findIndex((g) => g.items.some((i) => i.id === id));
  if (from < 0) return null;
  const item = groups[from].items.find((i) => i.id === id)!;
  const fromLocked = !!groups[from].locked;
  const without = groups.map((g) => ({ ...g, items: g.items.filter((i) => i.id !== id) }));
  const at = tops(without);

  // Nearest group it's allowed into.
  let best = -1;
  let bestDistance = Infinity;
  without.forEach((g, gi) => {
    if (!!g.locked !== fromLocked || (fromLocked && gi !== from)) return;
    const top = at[gi];
    const bottom = top + blockHeight(g);
    const distance = center < top ? top - center : center > bottom ? center - bottom : 0;
    if (distance < bestDistance) {
      bestDistance = distance;
      best = gi;
    }
  });
  if (best < 0) return null;

  const rowsTop = at[best] + EDGE + HEADER;
  const index = Math.max(0, Math.min(without[best].items.length, Math.round((center - rowsTop) / ROW)));
  const currentIndex = groups[from].items.findIndex((i) => i.id === id);
  if (best === from && index === currentIndex) return null;
  return without.map((g, gi) =>
    gi === best ? { ...g, items: [...g.items.slice(0, index), item, ...g.items.slice(index)] } : g,
  );
}

/** Where the dragged group belongs with its top at `y`; null if unchanged. */
function placeGroup(groups: SortGroup[], name: string, y: number): SortGroup[] | null {
  const from = groups.findIndex((g) => g.name === name);
  if (from < 0) return null;
  const at = tops(groups);
  const center = y + blockHeight(groups[from]) / 2;
  const others = groups.filter((g) => g.name !== name);
  const index = groups.filter((g, gi) => g.name !== name && at[gi] + blockHeight(g) / 2 < center).length;
  if (index === from) return null;
  return [...others.slice(0, index), groups[from], ...others.slice(index)];
}
