import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { inDemo } from '@/backend';
import { Button } from '@/components/button';
import { CardCarousel } from '@/components/card-carousel';
import { CardFace } from '@/components/card-face';
import { EmptyState } from '@/components/empty-state';
import { HeaderButton } from '@/components/header-button';
import { HeroCard } from '@/components/hero-card';
import { Icon } from '@/components/icon';
import { ICON_INSET, Row, RowIcon, Section } from '@/components/list';
import { Money } from '@/components/money';
import { Screen } from '@/components/screen';
import { Text } from '@/components/text';
import { useToast } from '@/components/toast';
import { TransactionRow } from '@/components/transaction-row';
import { daysBetween, formatDay, today } from '@/domain/dates';
import { budgetHealth } from '@/domain/health';
import { formatMoney } from '@/domain/money';
import { dueForApproval, upcoming } from '@/domain/recurring';
import { isCashAccount, type Recurring } from '@/domain/types';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAccounts, useDebtPlan, useLedger } from '@/hooks/use-ledger';
import { payoffLabel } from '@/screens/debt';
import { useStore } from '@/store';
import { loadSampleData } from '@/store/sample-data';
import { groupHue, gutter, radius, spacing, useColors } from '@/theme';
import { envelopeIcon } from '@/utils/envelope-icon';
import { haptic } from '@/utils/haptics';

const RECONCILE_EVERY_DAYS = 7;

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function Home() {
  const colors = useColors();
  const scheme = useColorScheme();
  const ledger = useLedger();
  const { cash, debts, all } = useAccounts();
  const { comparison } = useDebtPlan();
  const envelopes = useStore((s) => s.envelopes);
  const transactions = useStore((s) => s.transactions);
  const recurring = useStore((s) => s.recurring);
  const approve = useStore((s) => s.approveRecurring);
  const showToast = useToast((s) => s.show);

  const day = today();
  const due = dueForApproval(recurring, day);
  const soon = [...due, ...upcoming(recurring, day, 7)];
  const recent = useMemo(
    () =>
      [...transactions]
        .filter((t) => !(t.kind === 'transfer' && t.amount > 0))
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
        .slice(0, 5),
    [transactions],
  );
  const overspent = envelopes.filter((e) => (ledger.available.get(e.id) ?? 0) < 0 && !e.debtAccountId);
  const accountById = new Map(all.map((a) => [a.id, a]));
  const envelopeById = new Map(envelopes.map((e) => [e.id, e]));

  const header = (
    <Stack.Screen
      options={{
        title: greeting(),
        headerRight: () => (
          <HeaderButton sf="gearshape" md="settings" label="Settings" onPress={() => router.push('/settings')} />
        ),
      }}
    />
  );

  if (all.length === 0) {
    return (
      <Screen>
        {header}
        <EmptyState
          title="Start with your checking account"
          body="Add the account your debit card uses and type in today’s balance from your bank app. Every dollar in it becomes money you can give a job."
          action={<Button title="Add account" onPress={() => router.push('/new-account')} />}
        />
        {__DEV__ && !inDemo && <Button title="Load sample data" variant="ghost" onPress={loadSampleData} />}
      </Screen>
    );
  }

  const rta = ledger.readyToAssign;
  const health = budgetHealth(ledger);

  function approveItem(r: Recurring) {
    approve(r.id);
    haptic('success');
    showToast({ message: `Added ${r.name} · ${formatMoney(r.amount)}` });
  }

  return (
    <Screen>
      {header}
      {health.short > 0 && (
        <Section inset={spacing.lg - 2}>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.navigate('/budget')}
            style={{ flexDirection: 'row', gap: spacing.md, padding: spacing.lg - 2, alignItems: 'flex-start' }}
          >
            <RowIcon sf="exclamationmark.triangle.fill" md="warning" fg={colors.negative} bg={colors.negativeSoft} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="body" weight="600" tone="negative">
                Your envelopes hold more than your accounts
              </Text>
              <Text variant="callout" tone="negative">
                Your accounts have {formatMoney(health.short)} less than your envelopes. Take money back from envelopes
                until they match.
              </Text>
            </View>
          </Pressable>
        </Section>
      )}

      <HeroCard>
        <View style={{ gap: 2 }}>
          <Text variant="footnote" weight="500" tone="textSecondary">
            Ready to assign
          </Text>
          <Money cents={rta} variant="display" tone={rta < 0 ? 'negative' : 'text'} />
          <Text variant="callout" tone={rta < 0 ? 'negative' : 'textSecondary'}>
            {rta > 0
              ? 'Give it a job before you spend it.'
              : rta === 0
                ? `All ${formatMoney(ledger.cashTotal)} has a job.`
                : `${formatMoney(-rta)} more is assigned than you have.`}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {due.length > 0 && (
            <View
              style={{
                height: 32,
                paddingHorizontal: spacing.md,
                borderRadius: radius.full,
                borderWidth: 1,
                borderColor: colors.separator,
                justifyContent: 'center',
              }}
            >
              <Text variant="callout" weight="500">
                {due.length} {due.length === 1 ? 'bill' : 'bills'} to approve
              </Text>
            </View>
          )}
          {rta !== 0 && (
            <Button
              title={rta > 0 ? 'Assign money' : 'Fix in Budget'}
              size="sm"
              onPress={() => router.navigate('/budget')}
            />
          )}
        </View>
      </HeroCard>

      {soon.length > 0 && (
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title="Due soon" action="See all" onAction={() => router.navigate('/recurring')} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ marginHorizontal: -gutter }}
            contentContainerStyle={{ paddingHorizontal: gutter, gap: spacing.sm + 2 }}
          >
            {soon.map((r) => {
              const envelope = r.envelopeId ? envelopeById.get(r.envelopeId) : undefined;
              const account = accountById.get(r.accountId);
              const onCard = !!account && !isCashAccount(account);
              const hue = envelope ? groupHue(envelope.group, scheme) : { fg: colors.textSecondary, soft: colors.fill };
              const icon = envelopeIcon(envelope?.name ?? r.name);
              const isDue = r.nextDue <= day;
              return (
                <View
                  key={r.id}
                  style={{
                    width: 224,
                    borderRadius: radius.lg,
                    borderCurve: 'continuous',
                    backgroundColor: colors.surface,
                    flexDirection: 'row',
                    alignItems: 'center',
                    overflow: 'hidden',
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${r.name}, ${formatMoney(r.amount)}, ${formatDay(r.nextDue)}`}
                    onPress={() => router.push({ pathname: '/edit-recurring', params: { id: r.id } })}
                    style={({ pressed }) => ({
                      flex: 1,
                      padding: spacing.md,
                      paddingRight: isDue ? spacing.xs : spacing.md,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      backgroundColor: pressed ? colors.fill : 'transparent',
                    })}
                  >
                    <RowIcon
                      sf={icon.sf}
                      md={icon.md}
                      fg={onCard ? colors.negative : hue.fg}
                      bg={onCard ? colors.negativeSoft : hue.soft}
                    />
                    <View style={{ flex: 1, gap: 1 }}>
                      <Text variant="body" weight="600" numberOfLines={1} tone={onCard ? 'negative' : 'text'}>
                        {r.name}
                      </Text>
                      <Text variant="footnote" tone="textSecondary" numberOfLines={1}>
                        {formatDay(r.nextDue)} · {formatMoney(r.amount)}
                      </Text>
                    </View>
                  </Pressable>
                  {isDue && (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Approve ${r.name}`}
                      hitSlop={6}
                      onPress={() => approveItem(r)}
                      style={({ pressed }) => ({
                        width: 32,
                        height: 32,
                        marginRight: spacing.md,
                        borderRadius: radius.full,
                        borderWidth: 1.5,
                        borderColor: colors.separator,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: pressed ? colors.positiveSoft : 'transparent',
                      })}
                    >
                      <Icon sf="checkmark" md="check" size={13} weight="bold" />
                    </Pressable>
                  )}
                </View>
              );
            })}
          </ScrollView>
        </View>
      )}

      {overspent.length > 0 && (
        <Section title="Overspent" inset={spacing.lg - 2}>
          {overspent.map((e) => (
            <Row
              key={e.id}
              onPress={() => router.navigate({ pathname: '/budget/[id]', params: { id: e.id } })}
              title={e.name}
              subtitle="Cover it from another envelope"
              subtitleTone="negative"
              titleTone="negative"
              trailing={<Money cents={ledger.available.get(e.id) ?? 0} tone="negative" weight="600" />}
              chevron
            />
          ))}
        </Section>
      )}

      <View style={{ gap: spacing.sm }}>
        <SectionHeader
          title="Accounts"
          detail={`${formatMoney(ledger.cashTotal)} cash`}
          action="Add"
          onAction={() => router.push('/new-account')}
        />
        <CardCarousel
          items={cash}
          keyOf={(a) => a.id}
          renderCard={(a, width) => {
            const since = a.lastReconciledOn ? daysBetween(a.lastReconciledOn, day) : null;
            const stale = since === null || since >= RECONCILE_EVERY_DAYS;
            return (
              <CardFace
                face={a.order}
                width={width}
                title={a.name}
                caption={a.order === 0 ? 'Quick-add default' : undefined}
                amount={formatMoney(ledger.balance.get(a.id) ?? 0)}
                footnote={
                  stale
                    ? 'Time to check against the bank'
                    : since === 0
                      ? 'Checked against the bank today'
                      : `Checked ${since} ${since === 1 ? 'day' : 'days'} ago`
                }
                footnoteTone={stale ? 'bad' : 'good'}
                onPress={() => router.push(`/account/${a.id}`)}
                accessibilityLabel={`${a.name}, ${formatMoney(ledger.balance.get(a.id) ?? 0)}`}
              />
            );
          }}
        />
        {debts.length > 0 && (
          <Section inset={spacing.lg - 2}>
            <Row
              onPress={() => router.navigate('/debt')}
              leading={<RowIcon sf="chart.line.downtrend.xyaxis" md="trending_down" fg={colors.accent} bg={colors.accentSoft} />}
              title="Debt"
              subtitle={
                comparison?.plan.months != null
                  ? `Debt-free by ${payoffLabel(comparison.plan.months)}`
                  : `${debts.length} ${debts.length === 1 ? 'account' : 'accounts'}`
              }
              trailing={<Money cents={ledger.debtTotal} weight="600" />}
              chevron
            />
          </Section>
        )}
      </View>

      {recent.length > 0 && (
        <Section
          title="Recent"
          inset={ICON_INSET}
          action={<HeaderLink label="See all" onPress={() => router.navigate('/transactions')} />}
        >
          {recent.map((t) => (
            <TransactionRow
              key={t.id}
              t={t}
              account={accountById.get(t.accountId)}
              envelope={t.envelopeId ? envelopeById.get(t.envelopeId) : undefined}
            />
          ))}
        </Section>
      )}
    </Screen>
  );
}

function SectionHeader({
  title,
  detail,
  action,
  onAction,
}: {
  title: string;
  detail?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
        <Text variant="headline" accessibilityRole="header">
          {title}
        </Text>
        {detail && (
          <Text variant="footnote" tone="textSecondary">
            {detail}
          </Text>
        )}
      </View>
      {action && onAction && <HeaderLink label={action} onPress={onAction} />}
    </View>
  );
}

function HeaderLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" hitSlop={8} onPress={onPress}>
      <Text variant="callout" weight="500" tone="accent">
        {label}
      </Text>
    </Pressable>
  );
}
