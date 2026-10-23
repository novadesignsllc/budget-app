import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';

import { fontFamily, radius, spacing, useColors } from '@/theme';

import { Text } from './text';

export type ChartSeries = {
  id: string;
  label: string;
  color: string;
  /** One value per x position. `null` means no line there (a paid-off debt). */
  values: (number | null)[];
};

const PAD_TOP = 8;
const PAD_BOTTOM = 2;

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / exp;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * exp;
}

/**
 * Lines on one shared axis (never two y-scales). 2px strokes, a white-ringed dot where
 * each line ends, a faint grid, direct labels at the start of each line, and a crosshair
 * with a tooltip while you drag (or hover, on desktop).
 */
export function LineChart({
  series,
  height = 150,
  xTicks,
  pointLabel,
  formatValue,
  formatAxis,
  accessibilityLabel,
  directLabels = true,
}: {
  series: ChartSeries[];
  height?: number;
  /** Labels spread evenly under the chart. */
  xTicks: string[];
  /** Tooltip title for a point index ("June", "Mar 2028"). */
  pointLabel: (index: number) => string;
  formatValue: (v: number) => string;
  formatAxis: (v: number) => string;
  accessibilityLabel: string;
  directLabels?: boolean;
}) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  const count = Math.max(...series.map((s) => s.values.length), 2);
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values.map((v) => v ?? 0))));
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const x = (i: number) => (width * i) / (count - 1);
  const y = (v: number) => PAD_TOP + plotH - (v / max) * plotH;

  const paths = useMemo(
    () =>
      series.map((s) => {
        let d = '';
        let pen = false;
        let last: { i: number; v: number } | null = null;
        s.values.forEach((v, i) => {
          if (v === null) {
            pen = false;
            return;
          }
          d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
          pen = true;
          last = { i, v };
        });
        return { ...s, d, last: last as { i: number; v: number } | null };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, width, max, height],
  );

  // Labels go at the start of each line, nudged apart so they never overlap. A line that
  // starts near the bottom and ends early (a small debt) is labeled just past its end dot
  // instead, where it has room.
  const labels = useMemo(() => {
    if (!directLabels) return [];
    type Label = { id: string; label: string; x: number; y: number; anchor: 'start' | 'end' };
    const start: Label[] = [];
    const end: Label[] = [];
    series.forEach((s) => {
      const first = s.values.findIndex((v) => v !== null);
      if (first < 0) return;
      let last = first;
      s.values.forEach((v, i) => {
        if (v !== null) last = i;
      });
      const startY = y(s.values[first]!);
      if (last < count - 1 && startY > PAD_TOP + plotH * 0.7) {
        const ex = x(last);
        const room = ex + 7 + s.label.length * 5 < width;
        end.push({ id: s.id, label: s.label, x: room ? ex + 7 : ex - 7, y: y(s.values[last]!) - 7, anchor: room ? 'start' : 'end' });
      } else {
        start.push({ id: s.id, label: s.label, x: 4, y: startY - 5, anchor: 'start' });
      }
    });
    start.sort((a, b) => a.y - b.y);
    for (let i = 1; i < start.length; i++) {
      if (start[i].y - start[i - 1].y < 11) start[i].y = start[i - 1].y + 11;
    }
    return [...start, ...end].map((l) => ({ ...l, y: Math.max(9, Math.min(height - 4, l.y)) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, width, max, height, directLabels]);

  const indexAt = (px: number) => Math.max(0, Math.min(count - 1, Math.round((px / Math.max(width, 1)) * (count - 1))));
  const pan = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => runOnJS(setActive)(indexAt(e.x)))
    .onUpdate((e) => runOnJS(setActive)(indexAt(e.x)))
    .onFinalize(() => runOnJS(setActive)(null));
  const hover = Gesture.Hover()
    .onUpdate((e) => runOnJS(setActive)(indexAt(e.x)))
    .onEnd(() => runOnJS(setActive)(null));
  const gesture = Gesture.Simultaneous(pan, hover);

  const tipLeft = active !== null && width ? Math.min(Math.max(x(active) - 70, 0), width - 140) : 0;

  return (
    <View style={{ gap: 4 }}>
      <GestureDetector gesture={gesture}>
        <View
          accessibilityRole="image"
          accessibilityLabel={accessibilityLabel}
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          style={{ height }}
        >
          {width > 0 && (
            <Svg width={width} height={height}>
              {[0, 0.5, 1].map((f) => (
                <Line
                  key={f}
                  x1={0}
                  x2={width}
                  y1={PAD_TOP + plotH * (1 - f) + 0.5}
                  y2={PAD_TOP + plotH * (1 - f) + 0.5}
                  stroke={f === 0 ? 'rgba(20,40,80,0.14)' : 'rgba(20,40,80,0.06)'}
                  strokeWidth={1}
                />
              ))}
              <SvgText x={width} y={PAD_TOP + plotH / 2 - 4} fill={colors.textTertiary} fontSize={9} fontFamily={fontFamily} textAnchor="end">
                {formatAxis(max / 2)}
              </SvgText>
              <SvgText x={width} y={PAD_TOP + 9} fill={colors.textTertiary} fontSize={9} fontFamily={fontFamily} textAnchor="end">
                {formatAxis(max)}
              </SvgText>
              {active !== null && (
                <Line x1={x(active)} x2={x(active)} y1={0} y2={height} stroke="rgba(20,40,80,0.25)" strokeDasharray="3 3" />
              )}
              {paths.map((p) => (
                <Path key={p.id} d={p.d} fill="none" stroke={p.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              ))}
              {paths.map((p) =>
                p.last ? (
                  <Circle key={`${p.id}-end`} cx={x(p.last.i)} cy={y(p.last.v)} r={4} fill={p.color} stroke="#FFFFFF" strokeWidth={2} />
                ) : null,
              )}
              {active !== null &&
                series.map((s) =>
                  s.values[active] !== null && s.values[active] !== undefined ? (
                    <Circle key={`${s.id}-a`} cx={x(active)} cy={y(s.values[active]!)} r={4} fill={s.color} stroke="#FFFFFF" strokeWidth={2} />
                  ) : null,
                )}
              {labels.map((l) => (
                <SvgText key={l.id} x={l.x} y={l.y} fill={colors.textSecondary} fontSize={9} fontFamily={fontFamily} textAnchor={l.anchor}>
                  {l.label}
                </SvgText>
              ))}
            </Svg>
          )}
          {active !== null && width > 0 && (
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                left: tipLeft,
                top: 6,
                minWidth: 120,
                backgroundColor: colors.ink,
                borderRadius: radius.button,
                paddingHorizontal: 9,
                paddingVertical: 6,
                gap: 2,
              }}
            >
              <Text variant="caption" weight="600" color="rgba(255,255,255,0.7)">
                {pointLabel(active)}
              </Text>
              {series.map((s) =>
                s.values[active] !== null && s.values[active] !== undefined ? (
                  <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: s.color }} />
                    <Text variant="footnote" color="#FFFFFF" style={{ fontVariant: ['tabular-nums'] }}>
                      {s.label} {formatValue(s.values[active]!)}
                    </Text>
                  </View>
                ) : null,
              )}
            </View>
          )}
        </View>
      </GestureDetector>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {xTicks.map((t, i) => (
          <Text key={`${t}-${i}`} variant="caption" tone="textTertiary">
            {t}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Legend: a short line in the series color, the name, and an optional value. */
export function ChartLegend({ items }: { items: { label: string; color: string; value?: string }[] }) {
  return (
    <View style={{ gap: 4, alignItems: 'flex-end' }}>
      {items.map((i) => (
        <View key={i.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 12, height: 2, backgroundColor: i.color }} />
          <Text variant="footnote" tone="textSecondary">
            {i.label}
            {i.value ? (
              <Text variant="footnote" weight="600" style={{ fontVariant: ['tabular-nums'] }}>
                {` ${i.value}`}
              </Text>
            ) : null}
          </Text>
        </View>
      ))}
    </View>
  );
}

export const CHART_GAP = spacing.sm;
