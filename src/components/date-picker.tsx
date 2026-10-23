import { useState } from 'react';
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
import { dismissKeyboard } from '@/utils/keyboard';

import { Button } from './button';
import { FieldLabel } from './field';
import { Icon } from './icon';
import { FORM_ROW_HEIGHT } from './form';
import { Text } from './text';

const DAY = 34;
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

/** Open/close with a measured height animation; the calendar unmounts once closed. */
function useExpand() {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const height = useSharedValue(0);
  const duration = reduceMotion ? 0 : 220;
  const easing = Easing.out(Easing.cubic);

  const set = (next: boolean) => {
    if (next) dismissKeyboard();
    setOpen(next);
    if (next) setMounted(true);
    else
      height.value = withTiming(0, { duration, easing }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
  };
  const onContentLayout = (e: LayoutChangeEvent) => {
    if (open) height.value = withTiming(e.nativeEvent.layout.height, { duration, easing });
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
    <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.xs, paddingBottom: spacing.md, gap: 6 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 }}>
        <Text variant="body" weight="600" style={{ flex: 1 }} accessibilityRole="header">
          {monthTitle.format(new Date(month.y, month.m, 1))}
        </Text>
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
      <View style={{ gap: 2 }}>
        {weeks.map((week, wi) => (
          <View key={wi} style={{ flexDirection: 'row' }}>
            {week.map((d, di) => {
              if (!d) return <View key={di} style={{ flex: 1, height: DAY + 2 }} />;
              const selected = d === value;
              const isToday = d === now;
              const enabled = inRange(d);
              return (
                <View key={d} style={{ flex: 1, height: DAY + 2, alignItems: 'center', justifyContent: 'center' }}>
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
      <View
        style={{
          flexDirection: 'row',
          gap: 6,
          borderTopWidth: 1,
          borderTopColor: colors.hairline,
          paddingTop: spacing.sm,
          marginTop: 2,
        }}
      >
        <Button title="Today" variant="secondary" size="sm" disabled={!inRange(now)} onPress={() => onPick(now)} />
        <Button
          title="Yesterday"
          variant="secondary"
          size="sm"
          disabled={!inRange(yesterday)}
          onPress={() => onPick(yesterday)}
        />
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
function usePicker({ value, onChange }: PickerProps) {
  const expand = useExpand();
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
  const p = usePicker(props);
  return (
    <View style={{ borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.hairline }}>
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
  const p = usePicker(props);
  return (
    <View style={{ gap: 5 }}>
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
