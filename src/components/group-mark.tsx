import { Text as RNText, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { tablerIcon } from '@/data/tabler-icons';
import type { GroupMark, MarkColor } from '@/domain/types';
import { useStore } from '@/store';
import { markHues, useColors } from '@/theme';

/** A group's chosen mark, or undefined when it has none. */
export function useGroupMark(group: string): GroupMark | undefined {
  return useStore((s) => s.settings.groupMarks?.[group]);
}

/** Every group's mark, for lists that show several groups. */
export function useGroupMarks(): Record<string, GroupMark> {
  return useStore((s) => s.settings.groupMarks) ?? NONE;
}
const NONE: Record<string, GroupMark> = {};

/** The color a picker starts on for a group, matching its old fixed dot. */
export function startingColor(group: string): MarkColor {
  if (group === 'Bills') return 'blue';
  if (group === 'Savings') return 'green';
  if (group === 'Subscriptions') return 'teal';
  if (group === 'Debt payments') return 'grey';
  return 'purple';
}

/** A Tabler outline icon, drawn with its 2px round stroke on the 24×24 grid. */
export function TablerGlyph({ name, size, color }: { name: string; size: number; color: string }) {
  const icon = tablerIcon(name);
  if (!icon) return <View style={{ width: size, height: size }} />;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {icon.paths.map((d, i) => (
        <Path key={i} d={d} />
      ))}
    </Svg>
  );
}

/**
 * What sits before a group's name: a dot, an icon or an emoji, in a `size` box so names
 * line up. Nothing at all when the group has no mark. `muted` greys it for past months.
 */
export function GroupMarkView({ mark, size = 16, muted }: { mark?: GroupMark | null; size?: number; muted?: boolean }) {
  const colors = useColors();
  if (!mark) return null;
  const color = muted ? colors.textTertiary : mark.kind === 'emoji' ? '' : markHues[mark.color] ?? markHues.purple;
  if (mark.kind === 'dot') {
    const dot = Math.max(6, Math.round(size * 0.45));
    return <View style={{ width: dot, height: dot, borderRadius: dot / 2, backgroundColor: color }} />;
  }
  if (mark.kind === 'icon') return <TablerGlyph name={mark.icon} size={size} color={color} />;
  return (
    <RNText
      style={{ fontSize: Math.round(size * 0.9), lineHeight: Math.round(size * 1.2), opacity: muted ? 0.5 : 1 }}
      accessible={false}
    >
      {mark.emoji}
    </RNText>
  );
}
