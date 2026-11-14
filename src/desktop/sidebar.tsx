import { Link, router, usePathname } from 'expo-router';
import { TabTrigger, type TabTriggerSlotProps } from 'expo-router/ui';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { useSidebarWidth } from '@/components/dock';
import { keypadIsOpen } from '@/components/keypad';
import { desktopSheetOpen } from '@/components/screen';
import { Icon } from '@/components/icon';
import { Text } from '@/components/text';
import { formatMoney } from '@/domain/money';
import type { Account } from '@/domain/types';
import { useAccounts, useLedger } from '@/hooks/use-ledger';
import { useStore } from '@/store';
import { useSyncStatus } from '@/sync/status';
import { radius, softOf, spacing, useColors } from '@/theme';
import { pageZoom } from '@/utils/zoom';

import { focusSearch, Kbd, SlipMark, usePageKeys } from './ui';

export type SidebarTab = { name: string; href: string; label: string };
type ItemProps = Omit<TabTriggerSlotProps, 'ref'> & { ref?: React.Ref<React.ComponentRef<typeof View>> };

/**
 * The desktop's left column: the mark, Add transaction, the sections (1–7 on the
 * keyboard), every account with its balance, and whether the phone is in sync.
 */
export function Sidebar({ tabs }: { tabs: readonly SidebarTab[] }) {
  const width = useSidebarWidth((st) => st.width);
  const colors = useColors();
  const ledger = useLedger();
  const { cash, debts } = useAccounts();

  // N adds a transaction, 1–7 switch sections, / jumps to the page's search.
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
    <View style={{ width, borderRightWidth: 1, borderRightColor: colors.border, backgroundColor: colors.surface }}>
      <ResizeHandle />
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 12, paddingVertical: 18, gap: 18 }}>
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
            borderRadius: radius.button,
            borderCurve: 'continuous',
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

        <View style={{ gap: 1 }}>
          {tabs.map((t, i) =>
            t.name === 'settings' ? null : (
              <TabTrigger key={t.name} name={t.name} href={t.href as never} resetOnFocus asChild>
                <SideItem label={t.label} shortcut={String(i + 1)} />
              </TabTrigger>
            ),
          )}
        </View>

        {[
          { title: 'Accounts', rows: cash, debt: false },
          { title: 'Debts', rows: debts, debt: true },
        ].map((g) =>
          g.rows.length ? (
            <View key={g.title} style={{ gap: 2 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 10, paddingBottom: 4 }}>
                <Text variant="label" caps tone="textTertiary">
                  {g.title}
                </Text>
                {/* What they add up to: cash on hand, or everything owed. */}
                <Text variant="label" tone="textTertiary" style={{ fontVariant: ['tabular-nums'] }}>
                  {formatMoney(g.rows.reduce((sum, a) => sum + (g.debt ? -1 : 1) * (ledger.balance.get(a.id) ?? 0), 0))}
                </Text>
              </View>
              <AccountRows rows={g.rows} debt={g.debt} />
            </View>
          ) : null,
        )}

        {/* Settings sits at the bottom, out of the way of the sections you use every day. */}
        <View style={{ flex: 1 }} />
        {tabs.map((t, i) =>
          t.name === 'settings' ? (
            <TabTrigger key={t.name} name={t.name} href={t.href as never} resetOnFocus asChild>
              <SideItem label={t.label} shortcut={String(i + 1)} />
            </TabTrigger>
          ) : null,
        )}
        <SyncLine />
      </ScrollView>
    </View>
  );
}

function SideItem({ label, shortcut, isFocused: tabFocused, ref, ...props }: ItemProps & { label: string; shortcut?: string }) {
  const colors = useColors();
  // An account's page highlights the account in the list below instead.
  const pathname = usePathname();
  const isFocused = tabFocused && !pathname.startsWith('/account/');
  return (
    <Pressable
      ref={ref}
      {...props}
      accessibilityRole="tab"
      accessibilityState={{ selected: !!isFocused }}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => ({
        height: 32,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderCurve: 'continuous',
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

/**
 * Before each account: a chain when it's linked to a bank (green when the bank is
 * sending, red when it wants you to sign in again), or a plain wallet when it isn't, so
 * the names always line up.
 */
function BankMark({ accountId }: { accountId: string }) {
  const colors = useColors();
  const link = useStore((s) => s.bankLinks.find((l) => l.accounts.some((a) => a.accountId === accountId)));
  if (link) {
    const broken = !!link.needsLogin;
    return (
      <View accessible accessibilityLabel={broken ? `${link.institution} needs you to sign in again` : `Linked to ${link.institution}`}>
        <Svg width={14} height={14} viewBox="0 0 12 12">
          <Path
            d="M5 7l2-2M4.2 5.3 3.1 6.4a1.9 1.9 0 0 0 2.7 2.7l1.1-1.1M7.8 6.7l1.1-1.1a1.9 1.9 0 0 0-2.7-2.7L5.1 4"
            fill="none"
            stroke={broken ? colors.negativeStrong : colors.positive}
            strokeWidth={1.4}
            strokeLinecap="round"
          />
        </Svg>
      </View>
    );
  }
  return (
    <View accessible accessibilityLabel="Not linked to a bank">
      <Svg width={14} height={14} viewBox="0 0 14 14">
        <Rect x={1.75} y={3.25} width={10.5} height={7.5} rx={1.6} fill="none" stroke={colors.disabled} strokeWidth={1.3} />
        <Path d="M1.75 6h10.5" stroke={colors.disabled} strokeWidth={1.3} />
      </Svg>
    </View>
  );
}

/** The sidebar's right edge: drag it to make the sidebar wider or narrower. */
function ResizeHandle() {
  const colors = useColors();
  const setWidth = useSidebarWidth((s) => s.set);
  const ref = useRef<React.ComponentRef<typeof View>>(null);
  const [active, setActive] = useState(false);
  useEffect(() => {
    const node = ref.current as unknown as HTMLElement | null;
    if (!node || typeof window === 'undefined') return;
    const down = (e: PointerEvent) => {
      e.preventDefault();
      setActive(true);
      const move = (ev: PointerEvent) => setWidth(ev.clientX / pageZoom());
      const up = () => {
        setActive(false);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    };
    node.addEventListener('pointerdown', down);
    return () => node.removeEventListener('pointerdown', down);
  }, [setWidth]);
  return (
    <View
      ref={ref}
      accessibilityLabel="Drag to resize the sidebar"
      style={
        {
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: -4,
          width: 8,
          zIndex: 10,
          cursor: 'col-resize',
          backgroundColor: active ? colors.accentSoft : 'transparent',
        } as object
      }
    />
  );
}

/**
 * One group of accounts in the sidebar. Drag a row up or down to reorder; a click without
 * moving opens the account.
 */
function AccountRows({ rows, debt }: { rows: Account[]; debt: boolean }) {
  const colors = useColors();
  const ledger = useLedger();
  const pathname = usePathname();
  const reorder = useStore((s) => s.reorderAccounts);
  const [dragOrder, setDragOrder] = useState<string[] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const swallowClick = useRef(false);
  const wired = useRef(new WeakSet<HTMLElement>());
  const ids = dragOrder ?? rows.map((a) => a.id);
  const byId = new Map(rows.map((a) => [a.id, a]));

  // Listeners are added once per row, so they call whatever `start` is current.
  const startRef = useRef<(id: string, e: PointerEvent) => void>(() => {});
  startRef.current = (id: string, e: PointerEvent) => start(id, e);
  const start = (id: string, e: PointerEvent) => {
    if (e.button !== 0) return;
    const startY = e.clientY;
    let order = rows.map((a) => a.id);
    let moved = false;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.abs(ev.clientY - startY) < 5) return;
      if (!moved) {
        moved = true;
        setDraggingId(id);
        document.body.style.userSelect = 'none';
      }
      // The row goes before the first row whose middle is below the pointer.
      const others = order.filter((x) => x !== id);
      let at = others.length;
      for (let i = 0; i < others.length; i++) {
        const r = nodes.current.get(others[i])?.getBoundingClientRect();
        if (r && ev.clientY < r.top + r.height / 2) {
          at = i;
          break;
        }
      }
      const next = [...others.slice(0, at), id, ...others.slice(at)];
      if (next.join() !== order.join()) {
        order = next;
        setDragOrder(next);
      }
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.userSelect = '';
      if (moved) {
        swallowClick.current = true;
        if (order.join() !== rows.map((a) => a.id).join()) reorder(order);
      }
      setDragOrder(null);
      setDraggingId(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  return ids.map((id) => {
    const a = byId.get(id);
    if (!a) return null;
    const b = ledger.balance.get(a.id) ?? 0;
    const here = pathname === `/${debt ? 'debt' : 'account'}/${a.id}`;
    return (
      <View
        key={a.id}
        ref={(n) => {
          const el = n as unknown as HTMLElement | null;
          if (!el) return;
          nodes.current.set(a.id, el);
          // Each row's element gets its listeners once, however often it redraws.
          if (wired.current.has(el)) return;
          wired.current.add(el);
          // Rows are links, and the browser would start dragging the link itself.
          el.addEventListener('dragstart', (e) => e.preventDefault());
          el.addEventListener('pointerdown', (e) => startRef.current(a.id, e), true);
          // A drag ends with a click; it shouldn't open the account.
          el.addEventListener(
            'click',
            (e) => {
              if (!swallowClick.current) return;
              swallowClick.current = false;
              e.preventDefault();
              e.stopPropagation();
            },
            true,
          );
        }}
        style={{ opacity: draggingId === a.id ? 0.85 : 1 }}
      >
        <Link href={debt ? `/debt/${a.id}` : `/account/${a.id}`} asChild>
          <Pressable
            accessibilityHint="Drag to reorder"
            // A plain style object: a link row ignores a style function.
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: spacing.sm,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 8,
              borderCurve: 'continuous',
              backgroundColor: draggingId === a.id ? colors.accentFaint : here ? colors.accentSoft : 'transparent',
              ...(draggingId === a.id ? { borderWidth: 1, borderColor: colors.accent, paddingHorizontal: 9, paddingVertical: 5 } : {}),
            }}
          >
            <BankMark accountId={a.id} />
            <Text variant="body" numberOfLines={1} style={{ flex: 1 }}>
              {a.name}
            </Text>
            <Text variant="body" tone={!debt && b < 0 ? 'negative' : 'textSecondary'} style={{ fontVariant: ['tabular-nums'] }}>
              {formatMoney(debt ? -b : b)}
            </Text>
          </Pressable>
        </Link>
      </View>
    );
  });
}
