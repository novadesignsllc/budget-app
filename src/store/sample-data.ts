import { addDays, today } from '@/domain/dates';

import { useStore } from './index';

/** Dev-only: fills the app with a believable month so screens can be checked. */
export function loadSampleData() {
  const s = useStore.getState();
  const day = today();

  const checking = s.addAccount({ name: 'Main Checking', kind: 'checking', balance: 234018 });
  s.addAccount({ name: 'Ally Savings', kind: 'savings', balance: 100000 });
  const chime = s.addAccount({ name: 'Chime', kind: 'checking', balance: 8520 });
  const chase = s.addAccount({ name: 'Chase Freedom', kind: 'credit_card', balance: 421840, apr: 2499, minPayment: 12600, dueDay: 14 });
  s.addAccount({ name: 'Capital One', kind: 'credit_card', balance: 124000, apr: 2999, minPayment: 4000, dueDay: 3 });
  s.addAccount({ name: 'Car Loan', kind: 'auto_loan', balance: 1460000, apr: 690, minPayment: 38900, dueDay: 20 });
  s.addAccount({ name: 'Student Loan', kind: 'student_loan', balance: 2280000, apr: 550, minPayment: 26000, dueDay: 1 });

  const env = (name: string, group: string, target?: number) => s.addEnvelope({ name, group, monthlyTarget: target });
  // Each bill and subscription makes its own envelope.
  const bill = (name: string, kind: 'bill' | 'subscription', amount: number, accountId: string, inDays: number) => {
    const rid = s.addRecurring({ name, kind, amount, accountId, frequency: 'monthly', nextDue: addDays(day, inDays) });
    return useStore.getState().recurring.find((r) => r.id === rid)!.envelopeId!;
  };
  const rent = bill('Rent', 'bill', 110000, checking, 9);
  const utilities = bill('Duke Energy', 'bill', 11500, checking, 24);
  const phone = bill('Verizon', 'bill', 6500, checking, 0);
  const subs = bill('Netflix', 'subscription', 1549, checking, 0);
  bill('Spotify', 'subscription', 1199, chime, 5);
  bill('iCloud+', 'subscription', 299, chase, 12);
  const groceries = env('Groceries', 'Daily', 50000);
  const eating = env('Eating Out', 'Daily', 12000);
  const gas = env('Gas', 'Daily', 16000);
  const fun = env('Fun Money', 'Daily', 8000);
  const emergency = env('Emergency Fund', 'Savings', 100000);

  const st = useStore.getState();
  const chasePay = st.envelopes.find((e) => e.debtAccountId === chase)!.id;
  for (const [id, amount] of [
    [rent, 110000],
    [utilities, 18000],
    [phone, 6500],
    [subs, 1600],
    [groceries, 50000],
    [eating, 12000],
    [gas, 16000],
    [fun, 8000],
    [emergency, 100000],
    [chasePay, 25000],
  ] as const) {
    st.assign(id, amount);
  }

  const spend = (daysAgo: number, payee: string, amount: number, envelopeId: string, accountId = checking) =>
    st.addTransaction({ date: addDays(day, -daysAgo), accountId, amount, kind: 'spend', payee, envelopeId });
  spend(0, "McDonald's", 1099, eating);
  spend(1, 'Kroger', 8734, groceries);
  spend(2, 'Sheetz', 4210, gas);
  spend(3, 'Chipotle', 1385, eating, chime);
  spend(5, 'Kroger', 6412, groceries);
  spend(6, 'Duke Energy', 11287, utilities);
  st.addTransaction({ date: addDays(day, -4), accountId: chase, amount: 2399, kind: 'slip', payee: 'Amazon', envelopeId: fun });
  st.addTransaction({ date: addDays(day, -7), accountId: checking, amount: 184216, kind: 'income', payee: 'Paycheck' });
  st.transfer({ fromAccountId: checking, toAccountId: chase, amount: 15000, date: addDays(day, -2) });

  st.updateSettings({ monthlyDebtPayment: 120000 });
}
