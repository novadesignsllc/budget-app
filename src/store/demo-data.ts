import { addDays, addMonths, fromISODate, today as todayISO } from '@/domain/dates';
import { computeMonth, addMonthKey, monthEnd, monthOf, monthStart, type MonthKey } from '@/domain/months';
import { normalizePayee } from '@/domain/quick-add';
import { targetFor } from '@/domain/targets';
import type {
  Account,
  AccountKind,
  Allocation,
  Cents,
  Envelope,
  Frequency,
  ISODate,
  Payee,
  Recurring,
  RecurringKind,
  Transaction,
  TransactionKind,
} from '@/domain/types';

import { DEBT_GROUP, type State } from './index';

/**
 * Six months of believable history for the demo account, always ending today.
 * Seeded, so the same day always produces the same data.
 */

const MONTHS = 6;
const PAYCHECK: Cents = 193542;
const MONTHLY_DEBT_PAYMENT: Cents = 125000;

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type DebtDef = { name: string; kind: AccountKind; owed: Cents; apr: number; min: Cents; due: number; statement: number };

const DEBTS: DebtDef[] = [
  { name: 'Chase Freedom', kind: 'credit_card', owed: 486000, apr: 2499, min: 14600, due: 14, statement: 25 },
  { name: 'Capital One', kind: 'credit_card', owed: 296000, apr: 2999, min: 6500, due: 3, statement: 12 },
  { name: 'Car Loan', kind: 'auto_loan', owed: 1590000, apr: 690, min: 38900, due: 20, statement: 20 },
  { name: 'Student Loan', kind: 'student_loan', owed: 2340000, apr: 550, min: 26000, due: 1, statement: 1 },
];

const ENVELOPES: { name: string; group: string; target: Cents }[] = [
  { name: 'Rent', group: 'Bills', target: 115000 },
  { name: 'Utilities', group: 'Bills', target: 18000 },
  { name: 'Phone', group: 'Bills', target: 6500 },
  { name: 'Internet', group: 'Bills', target: 7000 },
  { name: 'Insurance', group: 'Bills', target: 14000 },
  { name: 'Subscriptions', group: 'Bills', target: 4000 },
  { name: 'Groceries', group: 'Daily', target: 52000 },
  { name: 'Eating Out', group: 'Daily', target: 14000 },
  { name: 'Gas', group: 'Daily', target: 17000 },
  { name: 'Household', group: 'Daily', target: 8000 },
  { name: 'Fun Money', group: 'Daily', target: 9000 },
  { name: 'Emergency Fund', group: 'Savings', target: 15000 },
  { name: 'Car Repairs', group: 'Savings', target: 5000 },
  { name: 'Gifts', group: 'Savings', target: 4000 },
];

/** Daily spending: trips per month, merchants, and the cents range of each trip. */
const SPENDING: { envelope: string; trips: number; merchants: string[]; min: Cents; max: Cents; chime?: number }[] = [
  { envelope: 'Groceries', trips: 7, merchants: ['Kroger', 'Aldi', "Trader Joe's", 'Kroger', 'Costco'], min: 3800, max: 11800 },
  {
    envelope: 'Eating Out',
    trips: 7,
    merchants: ['Chipotle', "McDonald's", 'Chick-fil-A', 'Starbucks', 'Panera Bread', 'Taco Bell'],
    min: 600,
    max: 2400,
    chime: 0.3,
  },
  { envelope: 'Gas', trips: 4, merchants: ['Sheetz', 'Shell', 'Wawa'], min: 3400, max: 5200 },
  { envelope: 'Household', trips: 2, merchants: ['Target', 'Amazon'], min: 1400, max: 4200 },
  { envelope: 'Fun Money', trips: 2, merchants: ['AMC Theatres', 'Steam', 'Barnes & Noble'], min: 1200, max: 3400 },
];

type RecurringDef = {
  name: string;
  kind: RecurringKind;
  envelope: string;
  account: string;
  day: number;
  amount: Cents;
  /** Bills vary month to month by up to this many cents. */
  vary?: Cents;
  /** Left unposted this month, so it waits on Home for approval. */
  pending?: boolean;
};

/** A few transactions carry notes, so the notes column has something in it. */
const NOTES: Record<string, string> = {
  Costco: 'Paper towels and the big coffee',
  'Best Buy': 'New headphones, went over',
  'Jiffy Lube': 'Oil change and wiper blades',
  Etsy: 'Mom’s birthday print',
  'Barnes & Noble': 'Two paperbacks',
};

const pad = (n: number) => String(n).padStart(2, '0');

function dateIn(month: MonthKey, day: number): ISODate {
  const last = Number(monthEnd(month).slice(8));
  return `${month}-${pad(Math.min(Math.max(day, 1), last))}`;
}

export function generateDemo(asOf: ISODate = todayISO()): State {
  const rand = rng(20261023);
  const between = (min: number, max: number) => Math.round(min + rand() * (max - min));
  const pick = <T,>(list: T[]) => list[Math.floor(rand() * list.length)];

  const thisMonth = monthOf(asOf);
  const firstMonth = addMonthKey(thisMonth, -(MONTHS - 1));
  const start = monthStart(firstMonth);
  const todayDay = Number(asOf.slice(8));
  let counter = 0;
  const id = (prefix: string) => `demo-${prefix}${(counter++).toString(36)}`;

  // Accounts.
  const cash = (name: string, kind: AccountKind, balance: Cents, order: number, reconciledDaysAgo: number): Account => ({
    id: id('a'),
    name,
    kind,
    openingBalance: balance,
    openedOn: start,
    order,
    lastReconciledOn: addDays(asOf, -reconciledDaysAgo),
  });
  const checking = cash('Main Checking', 'checking', 185000, 0, 6);
  const savings = cash('Ally Savings', 'savings', 240000, 1, 3);
  const chime = cash('Chime', 'checking', 12000, 2, 11);
  const debts = DEBTS.map(
    (d, i): Account => ({
      id: id('a'),
      name: d.name,
      kind: d.kind,
      openingBalance: -d.owed,
      openedOn: start,
      order: 3 + i,
      apr: d.apr,
      minPayment: d.min,
      dueDay: d.due,
    }),
  );
  const accounts = [checking, savings, chime, ...debts];
  const accountByName = new Map(accounts.map((a) => [a.name, a]));

  // Envelopes, plus one payment envelope per debt.
  const envelopes: Envelope[] = ENVELOPES.map((e, i) => ({
    id: id('e'),
    name: e.name,
    group: e.group,
    order: i,
    monthlyTarget: e.target,
    // Groceries went up this month; earlier months keep the old target.
    ...(e.name === 'Groceries' ? { targets: { [thisMonth]: 56000 } } : {}),
  }));
  debts.forEach((d, i) =>
    envelopes.push({ id: id('e'), name: d.name, group: DEBT_GROUP, order: i, debtAccountId: d.id }),
  );
  const env = (name: string) => envelopes.find((e) => e.name === name && !e.debtAccountId)!;
  const payEnvelope = (debtId: string) => envelopes.find((e) => e.debtAccountId === debtId)!;

  const transactions: Transaction[] = [];
  const allocations: Allocation[] = [];
  const merchantMemory: Record<string, string> = {};
  const payeeNames = new Map<string, string>();
  const clearedBefore = addDays(asOf, -7);
  // Older transactions have been checked against the bank and locked.
  const reconciledBefore = addDays(asOf, -21);

  const notedPayees = new Set<string>();

  function post(t: {
    date: ISODate;
    account: Account;
    amount: Cents;
    kind: TransactionKind;
    payee: string;
    envelopeId?: string;
    transferAccountId?: string;
    transferPairId?: string;
    recurringId?: string;
  }) {
    if (t.date > asOf || t.date < start) return;
    transactions.push({
      id: id('t'),
      date: t.date,
      accountId: t.account.id,
      amount: t.amount,
      kind: t.kind,
      payee: t.payee,
      envelopeId: t.envelopeId,
      transferAccountId: t.transferAccountId,
      transferPairId: t.transferPairId,
      recurringId: t.recurringId,
      memo: NOTES[t.payee] && !notedPayees.has(t.payee) ? (notedPayees.add(t.payee), NOTES[t.payee]) : undefined,
      cleared: t.date < clearedBefore,
      reconciled: t.date < reconciledBefore,
      createdAt: fromISODate(t.date).getTime() + counter,
    });
    if ((t.kind === 'spend' || t.kind === 'slip') && t.envelopeId) {
      merchantMemory[normalizePayee(t.payee)] = t.envelopeId;
      payeeNames.set(normalizePayee(t.payee), t.payee);
    }
  }

  function transfer(date: ISODate, from: Account, to: Account, amount: Cents, envelopeId?: string) {
    if (date > asOf || date < start) return;
    const pair = id('p');
    post({ date, account: from, amount: -amount, kind: 'transfer', payee: `To ${to.name}`, envelopeId, transferAccountId: to.id, transferPairId: pair });
    post({ date, account: to, amount, kind: 'transfer', payee: `From ${from.name}`, transferAccountId: from.id, transferPairId: pair });
  }

  function assign(envelopeId: string, amount: Cents, date: ISODate) {
    if (amount <= 0 || date > asOf) return;
    allocations.push({ id: id('l'), date, envelopeId, amount, createdAt: fromISODate(date).getTime() + counter });
  }

  // Recurring bills and subscriptions. Days near today make some due or overdue now.
  const recurringDefs: RecurringDef[] = [
    { name: 'Rent', kind: 'bill', envelope: 'Rent', account: 'Main Checking', day: 1, amount: 115000 },
    { name: 'Duke Energy', kind: 'bill', envelope: 'Utilities', account: 'Main Checking', day: 16, amount: 12400, vary: 2800 },
    { name: 'City Water', kind: 'bill', envelope: 'Utilities', account: 'Main Checking', day: 22, amount: 4200, vary: 400 },
    { name: 'Verizon', kind: 'bill', envelope: 'Phone', account: 'Main Checking', day: Math.min(todayDay, 28), amount: 6500, pending: true },
    { name: 'Spectrum', kind: 'bill', envelope: 'Internet', account: 'Main Checking', day: 9, amount: 7000 },
    { name: 'Progressive', kind: 'bill', envelope: 'Insurance', account: 'Main Checking', day: 12, amount: 14000 },
    { name: 'Netflix', kind: 'subscription', envelope: 'Subscriptions', account: 'Main Checking', day: Math.max(todayDay - 1, 1), amount: 1549, pending: todayDay > 1 },
    { name: 'Spotify', kind: 'subscription', envelope: 'Subscriptions', account: 'Chime', day: 18, amount: 1199 },
    { name: 'iCloud+', kind: 'subscription', envelope: 'Subscriptions', account: 'Chase Freedom', day: 5, amount: 299 },
  ];
  const recurring: Recurring[] = recurringDefs.map((r) => {
    const here = dateIn(thisMonth, r.day);
    const nextDue = r.pending ? here : here > asOf ? here : addMonths(here, 1, r.day);
    return {
      id: id('r'),
      name: r.name,
      kind: r.kind,
      amount: r.amount,
      accountId: accountByName.get(r.account)!.id,
      envelopeId: env(r.envelope).id,
      frequency: 'monthly' as Frequency,
      nextDue,
      active: true,
    };
  });

  // Biweekly paychecks on Fridays.
  let payday = start;
  while (fromISODate(payday).getDay() !== 5) payday = addDays(payday, 1);
  for (; payday <= asOf; payday = addDays(payday, 14)) {
    post({ date: payday, account: checking, amount: PAYCHECK, kind: 'income', payee: 'Paycheck' });
  }

  const owed = new Map(debts.map((d, i) => [d.id, DEBTS[i].owed]));

  for (let m = 0; m < MONTHS; m++) {
    const month = addMonthKey(firstMonth, m);
    const first = monthStart(month);
    const isCurrent = month === thisMonth;

    // Cover last month's overspending first, like a careful budgeter would.
    if (m > 0) {
      const last = computeMonth({ accounts, envelopes, transactions, allocations }, addMonthKey(month, -1));
      for (const e of envelopes) {
        const available = last.envelopes.get(e.id)?.available ?? 0;
        if (available < 0 && !e.debtAccountId) assign(e.id, -available, first);
      }
    }

    // Fill every target. The first month also gives the opening savings a job.
    for (const e of envelopes) {
      const target = targetFor(e, month);
      if (target) assign(e.id, target, first);
    }
    if (m === 0) {
      assign(env('Emergency Fund').id, 210000, first);
      assign(env('Car Repairs').id, 25000, first);
      assign(env('Gifts').id, 6000, first);
    }

    // Snowball: minimums everywhere, everything extra to the smallest balance.
    const open = debts.filter((d) => (owed.get(d.id) ?? 0) > 0);
    const mins = open.reduce((a, d) => a + Math.min(d.minPayment!, owed.get(d.id)!), 0);
    let extra = Math.max(0, MONTHLY_DEBT_PAYMENT - mins);
    const plan = new Map<string, Cents>();
    for (const d of [...open].sort((a, b) => owed.get(a.id)! - owed.get(b.id)!)) {
      const base = Math.min(d.minPayment!, owed.get(d.id)!);
      const add = Math.min(extra, owed.get(d.id)! - base);
      extra -= add;
      plan.set(d.id, base + add);
      assign(payEnvelope(d.id).id, base + add, first);
    }

    // Keep Chime topped up and move a little to savings.
    transfer(dateIn(month, 2), checking, savings, 15000);
    transfer(dateIn(month, 3), checking, chime, 6000);

    // Recurring charges.
    recurringDefs.forEach((r, i) => {
      if (isCurrent && r.pending) return;
      const account = accountByName.get(r.account)!;
      const onCard = !['checking', 'savings', 'cash'].includes(account.kind);
      const amount = r.vary ? r.amount + between(-r.vary, r.vary) : r.amount;
      post({
        date: dateIn(month, r.day),
        account,
        amount: -amount,
        kind: onCard ? 'slip' : 'spend',
        payee: r.name,
        envelopeId: env(r.envelope).id,
        recurringId: recurring[i].id,
      });
      if (onCard && dateIn(month, r.day) <= asOf) owed.set(account.id, owed.get(account.id)! + amount);
    });

    // Daily spending, spread through the month.
    const lastDay = Number(monthEnd(month).slice(8));
    for (const s of SPENDING) {
      let trips = s.trips;
      if (s.envelope === 'Eating Out' && m === 1) trips += 4; // one month runs over
      for (let k = 0; k < trips; k++) {
        const date = dateIn(month, between(1, lastDay));
        const account = s.chime && rand() < s.chime ? chime : checking;
        post({ date, account, amount: -between(s.min, s.max), kind: 'spend', payee: pick(s.merchants), envelopeId: env(s.envelope).id });
      }
    }
    if (m === 2) post({ date: dateIn(month, 19), account: checking, amount: -3800, kind: 'spend', payee: 'Etsy', envelopeId: env('Gifts').id });
    if (m === 3) {
      post({ date: dateIn(month, 8), account: checking, amount: -7999, kind: 'spend', payee: 'Jiffy Lube', envelopeId: env('Car Repairs').id });
      const capOne = accountByName.get('Capital One')!;
      post({ date: dateIn(month, 21), account: capOne, amount: -2749, kind: 'slip', payee: 'Amazon', envelopeId: env('Household').id });
      owed.set(capOne.id, owed.get(capOne.id)! + 2749);
    }
    if (isCurrent) {
      // This month's fun money runs a little over, so the overspent state shows.
      const fun = env('Fun Money');
      const left = computeMonth({ accounts, envelopes, transactions, allocations }, month).envelopes.get(fun.id)?.available ?? 0;
      post({ date: dateIn(month, Math.max(todayDay - 2, 1)), account: checking, amount: -(Math.max(left, 0) + 1240), kind: 'spend', payee: 'Best Buy', envelopeId: fun.id });
    }

    // Interest on the statement date, then the payment on the due date.
    debts.forEach((d, i) => {
      const def = DEBTS[i];
      const statementDate = dateIn(month, def.statement);
      if (statementDate <= asOf && owed.get(d.id)! > 0) {
        const interest = Math.round((owed.get(d.id)! * def.apr) / 10000 / 12);
        post({ date: statementDate, account: d, amount: -interest, kind: 'interest', payee: d.kind === 'credit_card' ? 'Interest and fees' : 'Interest' });
        owed.set(d.id, owed.get(d.id)! + interest);
        d.lastReconciledOn = statementDate;
      }
      const amount = plan.get(d.id) ?? 0;
      const dueDate = dateIn(month, def.due);
      if (amount > 0 && dueDate <= asOf) {
        transfer(dueDate, checking, d, Math.min(amount, owed.get(d.id)!), payEnvelope(d.id).id);
        owed.set(d.id, Math.max(0, owed.get(d.id)! - amount));
      }
    });
  }

  // Two things to follow up on: flagged, so they stay out of reconciling.
  const flagLatest = (envelopeName: string) => {
    const envelopeId = env(envelopeName).id;
    const t = [...transactions].reverse().find((x) => x.envelopeId === envelopeId && x.kind === 'spend' && !x.flagged);
    if (t) Object.assign(t, { flagged: true, reconciled: false, memo: t.memo ?? 'Check this charge' });
  };
  flagLatest('Household');
  flagLatest('Eating Out');

  // Leave a few dollars without a job this month; the rest tops up the emergency fund.
  const now = computeMonth({ accounts, envelopes, transactions, allocations }, thisMonth);
  const leave = 4237;
  if (now.readyToAssign > leave) assign(env('Emergency Fund').id, now.readyToAssign - leave, monthStart(thisMonth));

  const payees: Payee[] = [...payeeNames.entries()]
    .sort((a, b) => a[1].localeCompare(b[1]))
    .map(([key, name]) => ({ id: id('y'), name, envelopeId: merchantMemory[key] }));
  payees.push({ id: id('y'), name: 'Paycheck' });

  return {
    accounts,
    envelopes,
    transactions,
    allocations,
    recurring,
    payees,
    merchantMemory,
    settings: { debtStrategy: 'snowball', monthlyDebtPayment: MONTHLY_DEBT_PAYMENT },
  };
}

/** The demo as Firestore-shaped docs, ready to seed a backend. */
export function demoDocs(asOf?: ISODate) {
  const s = generateDemo(asOf);
  const clean = <T,>(list: T[]) => JSON.parse(JSON.stringify(list)) as (Record<string, unknown> & { id: string })[];
  return {
    accounts: clean(s.accounts),
    envelopes: clean(s.envelopes),
    transactions: clean(s.transactions),
    allocations: clean(s.allocations),
    recurring: clean(s.recurring),
    payees: clean(s.payees),
    meta: [{ id: 'state', settings: s.settings, merchantMemory: s.merchantMemory }],
  };
}
