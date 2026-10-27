import { Link, router, useSegments } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useEffect } from 'react';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { formatMoney } from '@/domain/money';
import { useAccounts, useLedger } from '@/hooks/use-ledger';
import { spacing, useColors } from '@/theme';

import { SIDEBAR_WIDTH, useDock, useIsDesktop } from './dock';
import { Icon } from './icon';
import { QuickAddBar } from './quick-add-bar';
import { Text } from './text';

const TABS = [
  { name: 'home', href: '/', label: 'Home', sf: 'house', sfOn: 'house.fill', md: 'home' },
  { name: 'transactions', href: '/transactions', label: 'Transactions', sf: 'list.bullet.rectangle', sfOn: 'list.bullet.rectangle.fill', md: 'receipt_long' },
  { name: 'budget', href: '/budget', label: 'Budget', sf: 'envelope', sfOn: 'envelope.fill', md: 'mail' },
  { name: 'debt', href: '/debt', label: 'Debt', sf: 'creditcard', sfOn: 'creditcard.fill', md: 'credit_card' },
  { name: 'recurring', href: '/recurring', label: 'Recurring', sf: 'arrow.triangle.2.circlepath', sfOn: 'arrow.triangle.2.circlepath', md: 'autorenew' },
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
      <Icon sf={isFocused ? tab.sfOn : tab.sf} md={tab.md} size={21} color={color} weight={isFocused ? 'semibold' : 'regular'} />
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
          paddingBottom: paddingBottom + 4,
        }}
      >
        {BAR.map((t) => (
          <TabTrigger key={t.name} name={t.name} href={t.href} resetOnFocus asChild>
            <BarTab tab={t} />
          </TabTrigger>
        ))}
      </View>
    </View>
  );
}

/** Desktop: sections and accounts in a left sidebar. */
function Sidebar() {
  const colors = useColors();
  const ledger = useLedger();
  const { cash, debts } = useAccounts();
  return (
    <View style={{ width: SIDEBAR_WIDTH, borderRightWidth: 1, borderRightColor: colors.border, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
        <Text variant="title" style={{ paddingHorizontal: spacing.sm, paddingTop: spacing.sm }}>
          Slip
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/add')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            height: 38,
            paddingHorizontal: spacing.md,
            borderRadius: 8,
            backgroundColor: colors.accent,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Icon sf="plus" md="add" size={14} color={colors.onInk} />
          <Text variant="body" weight="600" tone="onInk">
            Add transaction
          </Text>
        </Pressable>
        <View style={{ gap: 2 }}>
          {TABS.map((t) => (
            <TabTrigger key={t.name} name={t.name} href={t.href} resetOnFocus asChild>
              <SideItem label={t.label} />
            </TabTrigger>
          ))}
          <Link href="/settings" asChild>
            <SideItem label="Settings" />
          </Link>
        </View>
        {[
          { title: 'Accounts', rows: cash, debt: false },
          { title: 'Debts', rows: debts, debt: true },
        ].map((g) =>
          g.rows.length ? (
            <View key={g.title} style={{ gap: spacing.xs }}>
              <Text variant="label" tone="textTertiary" caps style={{ paddingHorizontal: spacing.sm }}>
                {g.title}
              </Text>
              {g.rows.map((a) => {
                const b = ledger.balance.get(a.id) ?? 0;
                return (
                  <Link key={a.id} href={g.debt ? `/debt/${a.id}` : `/account/${a.id}`} asChild>
                    <Pressable
                      style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingVertical: 5 }}
                    >
                      <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>
                        {a.name}
                      </Text>
                      <Text variant="body" tone={!g.debt && b < 0 ? 'negative' : 'textSecondary'}>
                        {formatMoney(g.debt ? -b : b)}
                      </Text>
                    </Pressable>
                  </Link>
                );
              })}
            </View>
          ) : null,
        )}
      </ScrollView>
    </View>
  );
}

function SideItem({ label, isFocused, ref, ...props }: TabProps & { label: string }) {
  const colors = useColors();
  return (
    <Pressable
      ref={ref}
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
      style={({ pressed }) => ({
        height: 36,
        paddingHorizontal: spacing.md,
        borderRadius: 8,
        justifyContent: 'center',
        backgroundColor: isFocused || pressed ? colors.control : 'transparent',
      })}
    >
      <Text variant="body" weight={isFocused ? '600' : '400'} tone={isFocused ? 'accent' : 'textSecondary'}>
        {label}
      </Text>
    </Pressable>
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

export function AppTabs() {
  const colors = useColors();
  const desktop = useIsDesktop();
  const fade = useTabFade();
  return (
    <Tabs style={{ flex: 1, flexDirection: desktop ? 'row' : 'column', backgroundColor: colors.background }}>
      {desktop ? <Sidebar /> : null}
      <Animated.View style={[{ flex: 1 }, fade]}>
        <TabSlot style={{ flex: 1 }} />
      </Animated.View>
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
