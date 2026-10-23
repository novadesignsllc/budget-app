import { describe, expect, it } from '@jest/globals';
import { parseQuickAdd, type ParseContext } from './quick-add';

const ctx: ParseContext = {
  today: '2026-10-22', // a Thursday
  accounts: [
    { id: 'main', name: 'Main Checking', kind: 'checking', openingBalance: 0, openedOn: '2026-10-01', order: 0 },
    { id: 'chime', name: 'Chime', kind: 'checking', openingBalance: 0, openedOn: '2026-10-01', order: 1 },
    { id: 'sav', name: 'Ally Savings', kind: 'savings', openingBalance: 0, openedOn: '2026-10-01', order: 2 },
    { id: 'visa', name: 'Chase Visa', kind: 'credit_card', openingBalance: 0, openedOn: '2026-10-01', order: 3 },
  ],
  envelopes: [
    { id: 'eat', name: 'Eating Out', group: 'Everyday', order: 0 },
    { id: 'groc', name: 'Groceries', group: 'Everyday', order: 1 },
    { id: 'gas', name: 'Gas', group: 'Everyday', order: 2 },
    { id: 'fun', name: 'Fun Money', group: 'Everyday', order: 3 },
  ],
  merchantMemory: { kroger: 'groc', targetcom: 'fun' },
};

describe('parseQuickAdd', () => {
  it('parses the basic dictation case', () => {
    const p = parseQuickAdd("McDonald's $10.99", ctx);
    expect(p).toMatchObject({
      amount: 1099,
      payee: "McDonald's",
      date: '2026-10-22',
      accountId: 'main',
      accountMentioned: false,
      kind: 'spend',
      envelopeId: 'eat',
      envelopeSource: 'guessed',
    });
  });

  it('works without a dollar sign and with the amount first', () => {
    expect(parseQuickAdd('10.99 mcdonalds', ctx)).toMatchObject({ amount: 1099, payee: 'Mcdonalds' });
    expect(parseQuickAdd('starbucks 6', ctx)).toMatchObject({ amount: 600, payee: 'Starbucks' });
  });

  it('routes to an account named in the text', () => {
    const p = parseQuickAdd("McDonald's $10.99 Chime", ctx);
    expect(p).toMatchObject({ accountId: 'chime', accountMentioned: true, payee: "McDonald's" });
    expect(parseQuickAdd('mcdonalds 10.99 on chime account', ctx).accountId).toBe('chime');
    expect(parseQuickAdd('transfer 50 savings', ctx).accountId).toBe('sav');
  });

  it('marks credit card spending as a slip', () => {
    const p = parseQuickAdd('gas 40 chase visa', ctx);
    expect(p).toMatchObject({ kind: 'slip', accountId: 'visa', amount: 4000, payee: 'Gas' });
  });

  it('uses remembered merchants before guessing', () => {
    expect(parseQuickAdd('kroger 54.20', ctx)).toMatchObject({ envelopeId: 'groc', envelopeSource: 'remembered' });
  });

  it('reads relative dates', () => {
    expect(parseQuickAdd('kroger 54.20 yesterday', ctx)).toMatchObject({ date: '2026-10-21', payee: 'Kroger' });
    expect(parseQuickAdd('pizza 22 monday', ctx).date).toBe('2026-10-19');
    expect(parseQuickAdd('pizza 22 thursday', ctx).date).toBe('2026-10-15');
    expect(parseQuickAdd('pizza 22 10/3', ctx).date).toBe('2026-10-03');
  });

  it('detects income', () => {
    expect(parseQuickAdd('paycheck 1,842.16', ctx)).toMatchObject({ kind: 'income', amount: 184216, envelopeId: null });
    expect(parseQuickAdd('+250 venmo from mom', ctx).kind).toBe('income');
  });

  it('keeps numbers that are part of the merchant name', () => {
    expect(parseQuickAdd('7-Eleven $5.25', ctx)).toMatchObject({ amount: 525, payee: '7-Eleven' });
  });

  it('strips filler around the merchant', () => {
    expect(parseQuickAdd('spent 10.99 at mcdonalds', ctx).payee).toBe('Mcdonalds');
  });

  it('understands amounts the way dictation writes them', () => {
    expect(parseQuickAdd('Best Buy 47 dollars and 27 cents', ctx)).toMatchObject({ amount: 4727, payee: 'Best Buy' });
    expect(parseQuickAdd('Best Buy 47 point 27', ctx)).toMatchObject({ amount: 4727, payee: 'Best Buy' });
    expect(parseQuickAdd('gas 40 dollars', ctx)).toMatchObject({ amount: 4000, payee: 'Gas' });
    expect(parseQuickAdd('Starbucks 6 dollars and 5 cents', ctx).amount).toBe(605);
  });

  it('returns no amount when there is none yet', () => {
    expect(parseQuickAdd('mcdonalds', ctx).amount).toBeNull();
  });

  it('leaves the envelope empty when there is no good guess', () => {
    expect(parseQuickAdd('random shop 12', ctx)).toMatchObject({ envelopeId: null, envelopeSource: 'none' });
  });
});
