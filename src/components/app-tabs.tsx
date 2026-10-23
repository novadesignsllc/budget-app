import { Link, router, usePathname } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { formatMoney } from '@/domain/money';
import { useAccounts, useLedger } from '@/hooks/use-ledger';
import { spacing, useColors } from '@/theme';

import { useDock, useIsDesktop } from './dock';
import { Icon } from './icon';
import { QuickAddBar } from './quick-add-bar';
import { Text } from './text';

const TABS = [
  { name: 'home', href: '/', label: 'Home', sf: 'house', md: 'home' },
  { name: 'transactions', href: '/transactions', label: 'Transactions', sf: 'list.bullet', md: 'receipt_long' },
  { name: 'budget', href: '/budget', label: 'Budget', sf: 'tray.2', md: 'inbox' },
  { name: 'debt', href: '/debt', label: 'Debt', sf: 'chart.line.downtrend.xyaxis', md: 'trending_down' },
  { name: 'recurring', href: '/recurring', label: 'Recurring', sf: 'arrow.triangle.2.circlepath', md: 'autorenew' },
] as const;
const SETTINGS = { name: 'settings', href: '/settings', label: 'Settings', sf: 'gearshape', md: 'settings' } as const;

type TabProps = Omit<TabTriggerSlotProps, 'ref'> & { label: string; ref?: React.Ref<React.ComponentRef<typeof View>> };

/** A text tab in the strip. The selected one gets a white outlined pill (Copilot style). */
function StripTab({ label, isFocused, ref, ...props }: TabProps) {
  const colors = useColors();
  return (
    <Pressable
      ref={ref}
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
      style={{
        height: 30,
        paddingHorizontal: isFocused ? 12 : 10,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: isFocused ? colors.borderStrong : 'transparent',
        backgroundColor: isFocused ? colors.surface : 'transparent',
        justifyContent: 'center',
      }}
    >
      <Text variant="body" weight="600" tone={isFocused ? 'accent' : 'textSecondary'}>
        {label}
      </Text>
    </Pressable>
  );
}

function GearTab({ isFocused, ref, ...props }: Omit<TabProps, 'label'>) {
  const colors = useColors();
  return (
    <Pressable
      ref={ref}
      {...props}
      accessibilityRole="tab"
      accessibilityLabel="Settings"
      accessibilityState={{ selected: !!isFocused }}
      style={{
        width: 30,
        height: 30,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: isFocused ? colors.borderStrong : 'transparent',
        backgroundColor: isFocused ? colors.surface : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon sf="gearshape" md="settings" size={16} color={isFocused ? colors.accent : colors.textSecondary} />
    </Pressable>
  );
}

/** Quick-add above a scrolling text tab strip, with Settings pinned at the far right. Solid, no glass. */
function Dock() {
  const colors = useColors();
  const { paddingBottom } = useDock();
  const pathname = usePathname();
  const strip = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const offsets = useRef<Record<string, number>>({});

  const active = TABS.find((t) => (t.href === '/' ? pathname === '/' : pathname.startsWith(t.href)));

  // Keep the selected tab in view when it's off the edge of the strip. Runs again once
  // the tab is measured, for when the app opens straight onto a later tab.
  const reveal = (animated: boolean) => {
    const x = active ? offsets.current[active.name] : undefined;
    if (x !== undefined) strip.current?.scrollTo({ x: Math.max(0, x - 40), animated });
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => reveal(true), [active?.name]);

  return (
    <View
      style={{
        backgroundColor: colors.background,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.separator,
        paddingTop: spacing.sm,
        paddingHorizontal: spacing.md,
        paddingBottom,
        gap: 6,
      }}
    >
      <QuickAddBar />
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <ScrollView
          ref={strip}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: 2 }}
        >
          {TABS.map((t) => (
            <View
              key={t.name}
              onLayout={(e) => {
                offsets.current[t.name] = e.nativeEvent.layout.x;
                if (t.name === active?.name) reveal(false);
              }}
            >
              <TabTrigger name={t.name} href={t.href} asChild>
                <StripTab label={t.label} />
              </TabTrigger>
            </View>
          ))}
        </ScrollView>
        <View style={{ width: StyleSheet.hairlineWidth, height: 18, backgroundColor: colors.borderStrong, marginHorizontal: 6 }} />
        <TabTrigger name={SETTINGS.name} href={SETTINGS.href} asChild>
          <GearTab />
        </TabTrigger>
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
    <View style={{ width: 260, borderRightWidth: 1, borderRightColor: colors.border, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.xl }}>
        <Text variant="title" style={{ paddingHorizontal: spacing.sm, paddingTop: spacing.sm }}>
          Zero Budget
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
          {[...TABS, SETTINGS].map((t) => (
            <TabTrigger key={t.name} name={t.name} href={t.href} asChild>
              <SideItem label={t.label} />
            </TabTrigger>
          ))}
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

function SideItem({ label, isFocused, ref, ...props }: TabProps) {
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

export function AppTabs() {
  const colors = useColors();
  const desktop = useIsDesktop();
  return (
    <Tabs style={{ flex: 1, flexDirection: desktop ? 'row' : 'column', backgroundColor: colors.background }}>
      {desktop ? <Sidebar /> : null}
      <View style={{ flex: 1 }}>
        <TabSlot style={{ flex: 1 }} />
      </View>
      {/* Registers every tab; the visible controls are the dock or sidebar. */}
      <TabList style={{ display: 'none' }}>
        {[...TABS, SETTINGS].map((t) => (
          <TabTrigger key={t.name} name={t.name} href={t.href} />
        ))}
      </TabList>
      {desktop ? null : <Dock />}
    </Tabs>
  );
}
