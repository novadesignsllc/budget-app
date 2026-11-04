import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useMemo } from 'react';

import { Sidebar } from '@/desktop/sidebar';
import { useProfiles } from '@/sync/profiles';
import { shownTabs, useTabBar } from '@/sync/tab-bar';
import { spacing, useColors } from '@/theme';

import { useDock, useIsDesktop } from './dock';
import { Icon } from './icon';
import { ProfileBar } from './profile-bar';
import { QuickAddBar } from './quick-add-bar';
import { Text } from './text';

export const TABS = [
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
  { name: 'income', href: '/income', label: 'Income', sf: 'banknote', sfOn: 'banknote.fill', md: 'payments' },
  { name: 'settings', href: '/settings', label: 'Settings', sf: 'gearshape', sfOn: 'gearshape.fill', md: 'settings' },
] as const;


type Tab = (typeof TABS)[number];
type TabProps = Omit<TabTriggerSlotProps, 'ref'> & { ref?: React.Ref<React.ComponentRef<typeof View>> };

/** One item in the bottom tab bar: just the icon, purple when selected. Its name is for screen readers. */
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
      // Equal tabs, so the icons sit evenly across the bar.
      style={{ flex: 1, minWidth: 0, height: 44, alignItems: 'center', justifyContent: 'center' }}
    >
      <Icon
        sf={isFocused ? tab.sfOn : tab.sf}
        md={tab.md}
        size={22}
        color={color}
        weight={isFocused ? 'semibold' : 'regular'}
      />
    </Pressable>
  );
}

/** Quick-add above a classic tab bar with every tab, Settings included. Solid, no glass. */
function Dock() {
  const colors = useColors();
  const { paddingBottom } = useDock();
  const profileTabs = useProfiles((s) => s.list.length > 1);
  // The account's own order and picks, set in Settings; Settings itself is always last.
  const order = useTabBar((s) => s.order);
  const hidden = useTabBar((s) => s.hidden);
  const bar = useMemo(
    () => shownTabs({ order, hidden }).map((name) => TABS.find((t) => t.name === name)!).filter(Boolean),
    [order, hidden],
  );
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
          // With profile tabs below, they take the home indicator's space instead.
          paddingBottom: profileTabs ? 4 : paddingBottom + 4,
        }}
      >
        {bar.map((t) => (
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
  return (
    <Tabs style={{ flex: 1, flexDirection: desktop ? 'row' : 'column', backgroundColor: colors.background }}>
      {desktop ? <Sidebar tabs={TABS} /> : null}
      <View style={{ flex: 1 }}>
        {/* Switching tabs is instant, like the system's own tab bars. */}
        <TabSlot style={{ flex: 1 }} />
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
