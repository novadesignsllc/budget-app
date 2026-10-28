import { Pressable, Switch, View } from 'react-native';

import { saveTabBar, useTabBar, type BarTab } from '@/sync/tab-bar';
import { spacing, useColors } from '@/theme';
import { haptic } from '@/utils/haptics';

import { TABS } from './app-tabs';
import { Card, CardHeader } from './card';
import { Icon } from './icon';
import { Text } from './text';

/**
 * Settings › Tab bar: which tabs the phone's bar shows and in what order, for the whole
 * account. Settings is always there, always last.
 */
export function TabBarCard() {
  const colors = useColors();
  const order = useTabBar((s) => s.order);
  const hidden = useTabBar((s) => s.hidden);
  const movable: BarTab[] = order.filter((t) => t !== 'settings');

  const move = (tab: BarTab, by: -1 | 1) => {
    const i = movable.indexOf(tab);
    const j = i + by;
    if (j < 0 || j >= movable.length) return;
    const next = [...movable];
    [next[i], next[j]] = [next[j], next[i]];
    haptic('selection');
    saveTabBar({ order: next, hidden });
  };
  const toggle = (tab: BarTab, on: boolean) => {
    haptic('selection');
    saveTabBar({ order: movable, hidden: on ? hidden.filter((t) => t !== tab) : [...hidden, tab] });
  };

  const arrow = (tab: BarTab, by: -1 | 1, disabled: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Move ${label(tab)} ${by < 0 ? 'up' : 'down'}`}
      disabled={disabled}
      hitSlop={4}
      onPress={() => move(tab, by)}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? colors.fill : colors.control,
        opacity: disabled ? 0.35 : 1,
      })}
    >
      <Icon
        sf={by < 0 ? 'chevron.up' : 'chevron.down'}
        md={by < 0 ? 'keyboard_arrow_up' : 'keyboard_arrow_down'}
        size={13}
        color={colors.text}
        weight="semibold"
      />
    </Pressable>
  );

  return (
    <Card>
      <CardHeader title="Tab bar" />
      {movable.map((tab, i) => {
        const t = TABS.find((x) => x.name === tab)!;
        const on = !hidden.includes(tab);
        return (
          <View key={tab} style={[row(colors.hairline), { opacity: on ? 1 : 0.6 }]}>
            <Icon sf={t.sf} md={t.md} size={18} color={on ? colors.text : colors.textTertiary} />
            <Text variant="body" weight="500" style={{ flex: 1 }} numberOfLines={1}>
              {t.label}
            </Text>
            {arrow(tab, -1, i === 0)}
            {arrow(tab, 1, i === movable.length - 1)}
            <Switch
              accessibilityLabel={`Show ${t.label} on the tab bar`}
              value={on}
              onValueChange={(v) => toggle(tab, v)}
              trackColor={{ true: colors.accent, false: colors.fill }}
              thumbColor="#FFFFFF"
              {...({ activeThumbColor: '#FFFFFF' } as object)}
            />
          </View>
        );
      })}
      <View style={row(colors.hairline)}>
        <Icon sf="gearshape" md="settings" size={18} color={colors.text} />
        <Text variant="body" weight="500" style={{ flex: 1 }}>
          Settings
        </Text>
        <Text variant="footnote" tone="textSecondary">
          Always last
        </Text>
      </View>
    </Card>
  );
}

const label = (tab: BarTab) => TABS.find((t) => t.name === tab)?.label ?? tab;

const row = (line: string) =>
  ({
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md + 2,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: line,
  }) as const;
