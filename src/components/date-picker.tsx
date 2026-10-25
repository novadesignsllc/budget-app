import { useRef, useState } from 'react';
import { Pressable, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { addDays, fromISODate, toISODate, today } from '@/domain/dates';
import type { ISODate } from '@/domain/types';
import { radius, spacing, useColors } from '@/theme';
import { haptic } from '@/utils/haptics';

import { FieldLabel } from './field';
import { Icon } from './icon';
import { FORM_ROW_HEIGHT } from './form';
import { useSheetReveal } from './screen';
import { Text } from './text';

/** Compact, so the calendar fits above the keyboard with the date row still showing. */
const DAY = 30;
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MUTED = '#B8C0CE';
const monthTitle = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const shortDay = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const shortDayYear = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const fullDay = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

/** "Today", "Yesterday", "Thu, Oct 22" (with the year when it isn't this year). */
export function formatPickedDate(iso: ISODate, now: ISODate = today()): string {
  if (iso === now) return 'Today';
  if (iso === addDays(now, -1)) return 'Yesterday';
  if (iso === addDays(now, 1)) return 'Tomorrow';
  const d = fromISODate(iso);
  return (d.getFullYear() === fromISODate(now).getFullYear() ? shortDay : shortDayYear).format(d);
}

type Month = { y: number; m: number };
const monthOfISO = (iso: ISODate): Month => {
  const d = fromISODate(iso);
  return { y: d.getFullYear(), m: d.getMonth() };
};
const shift = ({ y, m }: Month, n: number): Month => {
  const d = new Date(y, m + n, 1);
  return { y: d.getFullYear(), m: d.getMonth() };
};
const firstOf = ({ y, m }: Month) => toISODate(new Date(y, m, 1));
const lastOf = ({ y, m }: Month) => toISODate(new Date(y, m + 1, 0));

/**
 * Open/close with a measured height animation; the calendar unmounts once closed. The
 * keyboard stays up, so once open the sheet scrolls the calendar up above it.
 */
function useExpand(container: React.RefObject<React.ComponentRef<typeof View> | null>) {
  const reduceMotion = useReducedMotion();
  const reveal = useSheetReveal();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const height = useSharedValue(0);
  /** Last measured calendar height, for reopening before the close animation has finished. */
  const measured = useRef(0);
  const duration = reduceMotion ? 0 : 220;
  const easing = Easing.out(Easing.cubic);

  const set = (next: boolean) => {
    if (next) {
      setOpen(true);
      setMounted(true);
      if (measured.current) height.value = withTiming(measured.current, { duration, easing });
      setTimeout(() => reveal(container.current), duration + 40);
      return;
    }
    setOpen(false);
    height.value = withTiming(0, { duration, easing }, (done) => {
      if (done) runOnJS(setMounted)(false);
    });
  };
  const onContentLayout = (e: LayoutChangeEvent) => {
    measured.current = e.nativeEvent.layout.height;
    if (open) height.value = withTiming(measured.current, { duration, easing });
  };
  const style = useAnimatedStyle(() => ({ height: height.value, overflow: 'hidden' }));
  return { open, mounted, set, onContentLayout, style };
}

function Calendar({
  value,
  onPick,
  min,
  max,
  month,
  setMonth,
}: {
  value: ISODate;
  onPick: (d: ISODate) => void;
  min?: ISODate;
  max?: ISODate;
  month: Month;
  setMonth: (m: Month) => void;
}) {
  const colors = useColors();
  const now = today();
  const inRange = (d: ISODate) => (!min || d >= min) && (!max || d <= max);
  const canPrev = !min || lastOf(shift(month, -1)) >= min;
  const canNext = !max || firstOf(shift(month, 1)) <= max;

  const lead = new Date(month.y, month.m, 1).getDay();
  const count = new Date(month.y, month.m + 1, 0).getDate();
  const cells: (ISODate | null)[] = [...Array(lead).fill(null)];
  for (let n = 1; n <= count; n++) cells.push(toISODate(new Date(month.y, month.m, n)));
  while (cells.length % 7) cells.push(null);
  const weeks: (ISODate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  const yesterday = addDays(now, -1);
  const shortcut = (label: string, day: ISODate) => (
    <Pressable
      accessibilityRole="button"
      disabled={!inRange(day)}
      hitSlop={6}
      onPress={() => onPick(day)}
      style={({ pressed }) => ({ opacity: !inRange(day) ? 0.4 : pressed ? 0.5 : 1 })}
    >
      <Text variant="callout" weight="600" tone={value === day ? 'text' : 'accent'}>
        {label}
      </Text>
    </Pressable>
  );
  const nav = (dir: -1 | 1, enabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={dir < 0 ? 'Previous month' : 'Next month'}
      accessibilityState={{ disabled: !enabled }}
      disabled={!enabled}
      hitSlop={6}
      onPress={() => {
        haptic('selection');
        setMonth(shift(month, dir));
      }}
      style={({ pressed }) => ({
        width: 30,
        height: 30,
        borderRadius: 15,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.accentSoft : 'transparent',
      })}
    >
      <Icon
        sf={dir < 0 ? 'chevron.left' : 'chevron.right'}
        md={dir < 0 ? 'chevron_left' : 'chevron_right'}
        size={13}
        color={enabled ? colors.accent : colors.scrim}
        weight="semibold"
      />
    </Pressable>
  );

  return (
    <View style={{ paddingHorizontal: spacing.md, paddingTop: 2, paddingBottom: spacing.sm, gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: 2 }}>
        <Text variant="body" weight="600" style={{ flex: 1 }} numberOfLines={1} accessibilityRole="header">
          {monthTitle.format(new Date(month.y, month.m, 1))}
        </Text>
        {shortcut('Today', now)}
        {shortcut('Yesterday', yesterday)}
        {nav(-1, canPrev)}
        {nav(1, canNext)}
      </View>
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} variant="label" tone="textTertiary" align="center" style={{ flex: 1 }} importantForAccessibility="no">
            {w}
          </Text>
        ))}
      </View>
      <View>
        {weeks.map((week, wi) => (
          <View key={wi} style={{ flexDirection: 'row' }}>
            {week.map((d, di) => {
              if (!d) return <View key={di} style={{ flex: 1, height: DAY + 1 }} />;
              const selected = d === value;
              const isToday = d === now;
              const enabled = inRange(d);
              return (
                <View key={d} style={{ flex: 1, height: DAY + 1, alignItems: 'center', justifyContent: 'center' }}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${fullDay.format(fromISODate(d))}${isToday ? ', today' : ''}`}
                    accessibilityState={{ selected, disabled: !enabled }}
                    disabled={!enabled}
                    onPress={() => onPick(d)}
                    style={({ pressed }) => ({
                      width: DAY,
                      height: DAY,
                      borderRadius: DAY / 2,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderWidth: isToday && !selected ? 1.5 : 0,
                      borderColor: colors.accent,
                      backgroundColor: selected ? colors.accent : pressed ? colors.accentSoft : 'transparent',
                    })}
                  >
                    <Text
                      variant="body"
                      weight={selected || isToday ? '600' : '400'}
                      color={selected ? colors.onInk : isToday ? colors.accent : enabled ? colors.text : MUTED}
                      style={{ fontVariant: ['tabular-nums'] }}
                    >
                      {fromISODate(d).getDate()}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

type PickerProps = {
  label: string;
  value: ISODate;
  onChange: (value: ISODate) => void;
  /** Latest pickable day. Transactions pass today. */
  max?: ISODate;
  min?: ISODate;
};

/** Shared state for the row and the field: open/close, the month on screen, picking. */
function usePicker({ value, onChange }: PickerProps, container: React.RefObject<React.ComponentRef<typeof View> | null>) {
  const expand = useExpand(container);
  const [month, setMonth] = useState<Month>(() => monthOfISO(value));
  const toggle = () => {
    haptic('selection');
    if (!expand.open) setMonth(monthOfISO(value));
    expand.set(!expand.open);
  };
  const pick = (d: ISODate) => {
    haptic('selection');
    onChange(d);
    expand.set(false);
  };
  return { ...expand, month, setMonth, toggle, pick };
}

function Chevron({ open, color }: { open: boolean; color: string }) {
  return (
    <Animated.View
      style={{
        transform: [{ rotate: open ? '180deg' : '0deg' }],
        transitionProperty: 'transform',
        transitionDuration: 200,
      }}
    >
      <Icon sf="chevron.down" md="expand_more" size={10} color={color} weight="semibold" />
    </Animated.View>
  );
}

/**
 * A date line inside a grouped card of rows (same look as a Dropdown `row`). Tapping it
 * opens a calendar right below it, inside the same card. Draws its own divider unless `last`.
 */
export function DateRow(props: PickerProps & { last?: boolean }) {
  const { label, value, min, max, last } = props;
  const colors = useColors();
  const container = useRef<React.ComponentRef<typeof View>>(null);
  const p = usePicker(props, container);
  return (
    <View ref={container} collapsable={false} style={{ borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.hairline }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${formatPickedDate(value)}`}
        accessibilityState={{ expanded: p.open }}
        onPress={p.toggle}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          height: FORM_ROW_HEIGHT,
          paddingHorizontal: spacing.md,
          gap: spacing.sm,
          backgroundColor: pressed ? colors.control : colors.surface,
        })}
      >
        <Text variant="body" tone="textSecondary" style={{ flex: 1 }} numberOfLines={1}>
          {label}
        </Text>
        <Text variant="body" weight={p.open ? '600' : '500'} color={p.open ? colors.accent : colors.text} numberOfLines={1}>
          {formatPickedDate(value)}
        </Text>
        <Chevron open={p.open} color={p.open ? colors.accent : colors.textSecondary} />
      </Pressable>
      {p.mounted && (
        <Animated.View style={p.style}>
          <View onLayout={p.onContentLayout} style={{ position: 'absolute', top: 0, left: 0, right: 0 }}>
            <Calendar value={value} onPick={p.pick} min={min} max={max} month={p.month} setMonth={p.setMonth} />
          </View>
        </Animated.View>
      )}
    </View>
  );
}

/** A labeled, field-styled date control for forms; the calendar opens inside the same box. */
export function DateField(props: PickerProps & { optional?: boolean; note?: string }) {
  const { label, value, min, max, optional, note } = props;
  const colors = useColors();
  const container = useRef<React.ComponentRef<typeof View>>(null);
  const p = usePicker(props, container);
  return (
    <View ref={container} collapsable={false} style={{ gap: 5 }}>
      <FieldLabel label={label} optional={optional} note={note} />
      <View
        style={{
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: p.open ? colors.accent : colors.borderStrong,
          borderRadius: radius.control,
          borderCurve: 'continuous',
          overflow: 'hidden',
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}, ${formatPickedDate(value)}`}
          accessibilityState={{ expanded: p.open }}
          onPress={p.toggle}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            height: 38,
            paddingHorizontal: spacing.md,
            gap: spacing.sm,
            backgroundColor: pressed ? colors.control : colors.surface,
          })}
        >
          <Text variant="body" weight="500" color={p.open ? colors.accent : colors.text} style={{ flex: 1 }} numberOfLines={1}>
            {formatPickedDate(value)}
          </Text>
          <Chevron open={p.open} color={p.open ? colors.accent : colors.textSecondary} />
        </Pressable>
        {p.mounted && (
          <Animated.View style={p.style}>
            <View
              onLayout={p.onContentLayout}
              style={{ position: 'absolute', top: 0, left: 0, right: 0, borderTopWidth: 1, borderTopColor: colors.hairline }}
            >
              <Calendar value={value} onPick={p.pick} min={min} max={max} month={p.month} setMonth={p.setMonth} />
            </View>
          </Animated.View>
        )}
      </View>
    </View>
  );
}
