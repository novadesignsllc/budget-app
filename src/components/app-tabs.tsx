import { useSegments } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { Sidebar } from '@/desktop/sidebar';
import { useProfiles } from '@/sync/profiles';
import { spacing, useColors } from '@/theme';

import { useDock, useIsDesktop } from './dock';
import { Icon } from './icon';
import { ProfileBar } from './profile-bar';
import { QuickAddBar } from './quick-add-bar';
import { Text } from './text';

const TABS = [
  { name: 'home', href: '/', label: 'Home', sf: 'house', sfOn: 'house.fill', md: 'home' },
  {
    name: 'transactions',
    href: '/transactions',
    label: 'Transactions',
    sf: 'list.bullet.rectangle',
    sfOn: 'list.bullet.rectangle.fill',
    md: 'receipt_long',
  },
  { name: 'budget', href: '/budget', label: 'Budget', sf: 'envelope', sfOn: 'envelope.fill', md: 'mail' },
  { name: 'debt', href: '/debt', label: 'Debt', sf: 'creditcard', sfOn: 'creditcard.fill', md: 'credit_card' },
  {
    name: 'recurring',
    href: '/recurring',
    label: 'Recurring',
    sf: 'arrow.triangle.2.circlepath',
    sfOn: 'arrow.triangle.2.circlepath',
    md: 'autorenew',
  },
] as const;

/** The phone tab bar puts Home in the middle. (The hidden TabList keeps Home first, so the app opens on it.) */
const BAR_ORDER = ['recurring', 'transactions', 'home', 'budget', 'debt'] as const;
const BAR = BAR_ORDER.map((name) => TABS.find((t) => t.name === name)!);

type Tab = (typeof TABS)[number];
type TabProps = Omit<TabTriggerSlotProps, 'ref'> & { ref?: React.Ref<React.ComponentRef<typeof View>> };

/** One item in the bottom tab bar: icon over a small label, purple when selected. */
function BarTab({ tab, isFocused, ref, ...props }: TabProps & { tab: Tab }) {
  const colors = useColors();
  const color = isFocused ? colors.accent : colors.textTertiary;
  return (
    <Pressable
      ref={ref}
      {...props}
      accessibilityRole="tab"
      accessibilityLabel={tab.label}
      accessibilityState={{ selected: !!isFocused }}
      style={{ flex: 1, alignItems: 'center', gap: 3, paddingTop: 7 }}
    >
      <Icon
        sf={isFocused ? tab.sfOn : tab.sf}
        md={tab.md}
        size={21}
        color={color}
        weight={isFocused ? 'semibold' : 'regular'}
      />
      <Text variant="caption" weight={isFocused ? '600' : '500'} color={color} numberOfLines={1}>
        {tab.label}
      </Text>
    </Pressable>
  );
}

/** Quick-add above a classic tab bar with every tab, Settings included. Solid, no glass. */
function Dock() {
  const colors = useColors();
  const { paddingBottom } = useDock();
  return (
    <View>
      <View
        style={{
          backgroundColor: colors.background,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.separator,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
        }}
      >
        <QuickAddBar />
      </View>
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: colors.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
          paddingHorizontal: spacing.xs,
          paddingBottom: 4,
        }}
      >
        {BAR.map((t) => (
          <TabTrigger key={t.name} name={t.name} href={t.href} resetOnFocus asChild>
            <BarTab tab={t} />
          </TabTrigger>
        ))}
      </View>
      {/* Profiles sit under the tabs, like sheet tabs; they take the home indicator's space. */}
      <ProfileBar paddingBottom={paddingBottom} />
    </View>
  );
}

/** A short fade when you switch tabs. Opacity only, nothing moves. */
function useTabFade() {
  const tab = useSegments()[1];
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    progress.value = 0;
    progress.value = withTiming(1, { duration: 220, easing: Easing.inOut(Easing.quad) });
  }, [tab, reduceMotion, progress]);
  return useAnimatedStyle(() => ({
    opacity: 0.35 + progress.value * 0.65,
  }));
}

/** While another profile's data loads, a quiet cover so the old one never shows under the new name. */
function SwitchingCover() {
  const colors = useColors();
  const name = useProfiles((s) => s.list.find((p) => p.id === s.activeId)?.name ?? '');
  return (
    <View
      style={{
        position: 'absolute',
        inset: 0,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        backgroundColor: colors.background,
      }}
    >
      <ActivityIndicator color={colors.accent} />
      <Text variant="callout" tone="textSecondary">
        Opening {name}…
      </Text>
    </View>
  );
}

export function AppTabs() {
  const colors = useColors();
  const desktop = useIsDesktop();
  const switching = useProfiles((s) => s.switching);
  const fade = useTabFade();
  return (
    <Tabs style={{ flex: 1, flexDirection: desktop ? 'row' : 'column', backgroundColor: colors.background }}>
      {desktop ? <Sidebar tabs={TABS} /> : null}
      <View style={{ flex: 1 }}>
        <Animated.View style={[{ flex: 1 }, fade]}>
          <TabSlot style={{ flex: 1 }} />
        </Animated.View>
        {switching && <SwitchingCover />}
        {desktop ? <ProfileBar /> : null}
      </View>
      {/* Registers every tab; the visible controls are the dock or sidebar. */}
      <TabList style={{ display: 'none' }}>
        {TABS.map((t) => (
          <TabTrigger key={t.name} name={t.name} href={t.href} />
        ))}
      </TabList>
      {desktop ? null : <Dock />}
    </Tabs>
  );
}
