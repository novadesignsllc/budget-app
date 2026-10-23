import { Link, router } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { formatMoney } from '@/domain/money';
import { useAccounts, useLedger } from '@/hooks/use-ledger';
import { radius, spacing, useColors } from '@/theme';

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

const WIDE = 900;

/**
 * Web layout. Phone-width browsers get the same bottom tabs as the app. Desktop gets a
 * left sidebar with the sections and every account.
 */
export function AppTabs() {
  const { width } = useWindowDimensions();
  const wide = width >= WIDE;
  const colors = useColors();

  return (
    <Tabs style={{ flex: 1, flexDirection: wide ? 'row' : 'column', backgroundColor: colors.background }}>
      {wide ? <Sidebar /> : null}
      <View style={{ flex: 1 }}>
        <TabSlot style={{ height: '100%' }} />
      </View>
      <TabList
        style={
          wide
            ? { display: 'none' }
            : {
                backgroundColor: colors.surface,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.separator,
                paddingBottom: spacing.sm,
              }
        }
      >
        {TABS.map((t) => (
          <TabTrigger key={t.name} name={t.name} href={t.href} asChild>
            <BottomTab label={t.label} sf={t.sf} md={t.md} />
          </TabTrigger>
        ))}
      </TabList>
      {!wide && (
        <View
          pointerEvents="box-none"
          style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: 76 }}
        >
          <QuickAddBar floating />
        </View>
      )}
    </Tabs>
  );
}

type TabProps = Omit<TabTriggerSlotProps, 'ref'> & {
  label: string;
  sf: (typeof TABS)[number]['sf'];
  md: (typeof TABS)[number]['md'];
};

function BottomTab({ label, sf, md, isFocused, ref, ...props }: TabProps & { ref?: React.Ref<React.ComponentRef<typeof View>> }) {
  const colors = useColors();
  return (
    <Pressable
      ref={ref}
      {...props}
      style={{ flex: 1, alignItems: 'center', gap: spacing.xxs, paddingTop: spacing.sm }}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
    >
      <Icon sf={sf} md={md} size={22} color={isFocused ? colors.ink : colors.textTertiary} />
      <Text variant="caption" tone={isFocused ? 'text' : 'textTertiary'}>
        {label}
      </Text>
    </Pressable>
  );
}

function Sidebar() {
  const colors = useColors();
  const ledger = useLedger();
  const { cash, debts } = useAccounts();

  return (
    <View
      style={{
        width: 280,
        borderRightWidth: StyleSheet.hairlineWidth,
        borderRightColor: colors.separator,
        backgroundColor: colors.surface,
      }}
    >
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
            height: 44,
            paddingHorizontal: spacing.lg,
            borderRadius: radius.full,
            backgroundColor: colors.ink,
            opacity: pressed ? 0.8 : 1,
          })}
        >
          <Icon sf="plus" md="add" size={16} color={colors.onInk} />
          <Text variant="headline" tone="onInk">
            Add transaction
          </Text>
        </Pressable>

        <View style={{ gap: spacing.xxs }}>
          {TABS.map((t) => (
            <TabTrigger key={t.name} name={t.name} href={t.href} asChild>
              <SideItem label={t.label} sf={t.sf} md={t.md} />
            </TabTrigger>
          ))}
        </View>

        <SideAccounts
          title="Accounts"
          rows={cash.map((a) => ({ id: a.id, name: a.name, amount: ledger.balance.get(a.id) ?? 0 }))}
        />
        {debts.length > 0 && (
          <SideAccounts
            title="Debts"
            rows={debts.map((a) => ({ id: a.id, name: a.name, amount: ledger.balance.get(a.id) ?? 0 }))}
            debt
          />
        )}
        <Link href="/new-account" asChild>
          <Pressable accessibilityRole="button" style={{ paddingHorizontal: spacing.sm }}>
            <Text variant="callout" tone="accent" weight="500">
              Add account
            </Text>
          </Pressable>
        </Link>
      </ScrollView>
    </View>
  );
}

function SideItem({ label, sf, md, isFocused, ref, ...props }: TabProps & { ref?: React.Ref<React.ComponentRef<typeof View>> }) {
  const colors = useColors();
  return (
    <Pressable
      ref={ref}
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        height: 40,
        paddingHorizontal: spacing.md,
        borderRadius: radius.sm,
        backgroundColor: isFocused ? colors.fill : pressed ? colors.fill : 'transparent',
      })}
    >
      <Icon sf={sf} md={md} size={18} color={isFocused ? colors.text : colors.textSecondary} />
      <Text variant="body" weight={isFocused ? '600' : '400'} tone={isFocused ? 'text' : 'textSecondary'}>
        {label}
      </Text>
    </Pressable>
  );
}

function SideAccounts({
  title,
  rows,
  debt,
}: {
  title: string;
  rows: { id: string; name: string; amount: number }[];
  debt?: boolean;
}) {
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="footnote" weight="600" tone="textSecondary" style={{ paddingHorizontal: spacing.sm }}>
        {title}
      </Text>
      {rows.length === 0 && (
        <Text variant="callout" tone="textTertiary" style={{ paddingHorizontal: spacing.sm }}>
          None yet
        </Text>
      )}
      {rows.map((r) => (
        <Link key={r.id} href={debt ? `/debt/${r.id}` : `/account/${r.id}`} asChild>
          <Pressable
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              gap: spacing.sm,
              paddingHorizontal: spacing.sm,
              paddingVertical: spacing.xs,
            }}
          >
            <Text variant="callout" numberOfLines={1} style={{ flex: 1 }}>
              {r.name}
            </Text>
            <Text variant="callout" tone={r.amount < 0 && !debt ? 'negative' : 'textSecondary'}>
              {formatMoney(debt ? -r.amount : r.amount)}
            </Text>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}
