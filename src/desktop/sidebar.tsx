import { Link, router, usePathname } from 'expo-router';
import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, ScrollView, View } from 'react-native';

import { SIDEBAR_WIDTH } from '@/components/dock';
import { keypadIsOpen } from '@/components/keypad';
import { desktopSheetOpen } from '@/components/screen';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { formatMoney } from '@/domain/money';
import { useAccounts, useLedger } from '@/hooks/use-ledger';
import { useSyncStatus } from '@/sync/status';
import { softOf, spacing, useColors } from '@/theme';

import { focusSearch, Kbd, SlipMark, usePageKeys } from './ui';

export type SidebarTab = { name: string; href: string; label: string };
type ItemProps = Omit<TabTriggerSlotProps, 'ref'> & { ref?: React.Ref<React.ComponentRef<typeof View>> };

/**
 * The desktop's left column: the mark, Add transaction, the sections (1–5 on the
 * keyboard), every account with its balance, and whether the phone is in sync.
 */
export function Sidebar({ tabs }: { tabs: readonly SidebarTab[] }) {
  const colors = useColors();
  const ledger = useLedger();
  const { cash, debts } = useAccounts();
  const pathname = usePathname();

  // N adds a transaction, 1–5 switch sections, / jumps to the page's search.
  usePageKeys((e) => {
    if (keypadIsOpen() || desktopSheetOpen()) return;
    const n = Number(e.key);
    if (e.key === 'n' || e.key === 'N') router.push('/add');
    else if (n >= 1 && n <= tabs.length) router.navigate(tabs[n - 1].href as never);
    else if (e.key === '/') {
      if (!focusSearch()) return;
    } else return;
    e.preventDefault();
  });

  return (
    <View style={{ width: SIDEBAR_WIDTH, borderRightWidth: 1, borderRightColor: colors.border, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 14, paddingVertical: 20, gap: 22 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 6 }}>
          <SlipMark />
          <Text style={{ fontSize: 18, lineHeight: 22, fontWeight: '700', letterSpacing: -0.3 }}>Slip</Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add transaction"
          onPress={() => router.push('/add')}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 38,
            paddingHorizontal: 12,
            borderRadius: 9,
            backgroundColor: colors.accent,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Icon sf="plus" md="add" size={14} color={colors.onInk} weight="bold" />
            <Text variant="body" weight="600" tone="onInk">
              Add transaction
            </Text>
          </View>
          <Kbd onAccent>N</Kbd>
        </Pressable>

        <View style={{ gap: 2 }}>
          {tabs.map((t, i) => (
            <TabTrigger key={t.name} name={t.name} href={t.href as never} resetOnFocus asChild>
              <SideItem label={t.label} shortcut={String(i + 1)} />
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
            <View key={g.title} style={{ gap: 2 }}>
              <Text variant="label" caps color="#6B778C" style={{ paddingHorizontal: 10, paddingBottom: 4 }}>
                {g.title}
              </Text>
              {g.rows.map((a) => {
                const b = ledger.balance.get(a.id) ?? 0;
                return (
                  <Link key={a.id} href={g.debt ? `/debt/${a.id}` : `/account/${a.id}`} asChild>
                    <Pressable
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        gap: spacing.sm,
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 8,
                        backgroundColor: pathname === `/${g.debt ? 'debt' : 'account'}/${a.id}` ? colors.accentSoft : 'transparent',
                      }}
                    >
                      <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>
                        {a.name}
                      </Text>
                      <Text
                        variant="body"
                        tone={!g.debt && b < 0 ? 'negative' : 'textSecondary'}
                        style={{ fontVariant: ['tabular-nums'] }}
                      >
                        {formatMoney(g.debt ? -b : b)}
                      </Text>
                    </Pressable>
                  </Link>
                );
              })}
            </View>
          ) : null,
        )}

        <SyncLine />
      </ScrollView>
    </View>
  );
}

function SideItem({ label, shortcut, isFocused: tabFocused, ref, ...props }: ItemProps & { label: string; shortcut?: string }) {
  const colors = useColors();
  // Settings lives inside Home's stack, so it gets the highlight there instead of Home.
  const pathname = usePathname();
  const onSettings = pathname === '/settings';
  // An account's page highlights the account in the list below instead.
  const onAccount = pathname.startsWith('/account/');
  const isFocused = label === 'Settings' ? onSettings : tabFocused && !onSettings && !onAccount;
  return (
    <Pressable
      ref={ref}
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
        height: 36,
        paddingHorizontal: 10,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: isFocused ? colors.accentSoft : pressed || hovered ? colors.control : 'transparent',
      })}
    >
      <Text variant="body" weight={isFocused ? '600' : '400'} tone={isFocused ? 'accent' : 'textSecondary'}>
        {label}
      </Text>
      {shortcut ? (
        <Text variant="caption" color={isFocused ? softOf(colors.accent, 0.65) : colors.textTertiary}>
          {shortcut}
        </Text>
      ) : null}
    </Pressable>
  );
}

const SYNC = {
  idle: { label: 'Synced with your phone', dot: 'positive' },
  synced: { label: 'Synced with your phone', dot: 'positive' },
  syncing: { label: 'Syncing…', dot: 'cautionDot' },
  waiting: { label: 'Offline. Saved here until you’re back', dot: 'orange' },
  error: { label: 'Didn’t sync. Retrying', dot: 'negativeStrong' },
} as const;

/** The sync status, at the bottom of the sidebar instead of the phone's floating pill. */
function SyncLine() {
  const colors = useColors();
  const phase = useSyncStatus((s) => s.phase);
  const look = SYNC[phase];
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{ marginTop: 'auto', flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: 10, paddingVertical: 6 }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors[look.dot] }} />
      <Text variant="footnote" tone="textSecondary" style={{ flex: 1 }}>
        {look.label}
      </Text>
    </View>
  );
}
