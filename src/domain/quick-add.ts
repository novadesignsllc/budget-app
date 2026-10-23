import { addDays, fromISODate, toISODate } from './dates';
import type { Account, Cents, Envelope, ISODate } from './types';
import { isCashAccount } from './types';

export type ParseContext = {
  accounts: Account[];
  envelopes: Envelope[];
  /** Normalized payee → envelope id, learned from past transactions. */
  merchantMemory: Record<string, string>;
  today: ISODate;
};

export type EnvelopeSource = 'remembered' | 'guessed' | 'none';

export type ParsedEntry = {
  amount: Cents | null;
  payee: string;
  date: ISODate;
  accountId: string | null;
  /** True when the account came from the text rather than the default. */
  accountMentioned: boolean;
  kind: 'spend' | 'income' | 'slip';
  envelopeId: string | null;
  envelopeSource: EnvelopeSource;
};

const AMOUNT_RE = /(^|[\s(])([+-]?)\$?\s?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)(?![\d%/])/g;
const INCOME_RE = /\b(paycheck|payday|salary|income|direct deposit|deposit|got paid|paid me)\b/i;
const FILLER = '(?:spent|spend|paid|pay|bought|buy|for|at|on|from|with|using|via|to|in|dollars?|bucks)';
const LEADING_FILLER_RE = new RegExp(`^${FILLER}\\b\\s*`, 'i');
const TRAILING_FILLER_RE = new RegExp(`\\s*\\b${FILLER}$`, 'i');
const ACCOUNT_STOPWORDS = new Set([
  'checking',
  'savings',
  'account',
  'card',
  'credit',
  'bank',
  'the',
  'my',
  'and',
  'debit',
]);
const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Keyword hints for merchants the app hasn't seen yet. Each maps merchant words to a
 * pattern for envelope names. The guess only lands if the user has an envelope whose
 * name matches, and the user can always change it before saving.
 */
const CATEGORY_HINTS: { merchants: RegExp; envelope: RegExp }[] = [
  {
    merchants:
      /\b(mcdonald'?s?|burger|wendy'?s|taco|chipotle|pizza|starbucks|coffee|dunkin|subway|chick[- ]?fil[- ]?a|restaurant|doordash|uber ?eats|grubhub|sonic|kfc|panera|dinner|lunch|breakfast|cafe|diner|popeyes|arby'?s|five guys|sushi|bar|brewery)\b/i,
    envelope: /eat|dining|restaurant|takeout|fast food|food out/i,
  },
  {
    merchants:
      /\b(walmart|kroger|aldi|publix|costco|safeway|h-?e-?b|grocer(y|ies)|whole foods|trader joe'?s|food lion|meijer|sam'?s club|wegmans|giant|albertsons|sprouts|market)\b/i,
    envelope: /grocer|food/i,
  },
  {
    merchants:
      /\b(shell|exxon|bp|chevron|speedway|wawa|sheetz|marathon|circle k|gas|fuel|quiktrip|qt|sunoco|valero|citgo|buc-?ee'?s)\b/i,
    envelope: /gas|fuel|transport|car\b/i,
  },
  {
    merchants: /\b(netflix|spotify|hulu|disney\+?|youtube|apple music|icloud|max|paramount|peacock|prime video)\b/i,
    envelope: /subscri|stream|entertain/i,
  },
  {
    merchants: /\b(electric|power|water|sewer|utility|utilities|internet|comcast|xfinity|verizon|at&t|t-mobile|spectrum)\b/i,
    envelope: /utilit|electric|internet|phone|bills?/i,
  },
  { merchants: /\b(rent|landlord|mortgage)\b/i, envelope: /rent|housing|mortgage/i },
  {
    merchants: /\b(cvs|walgreens|pharmacy|doctor|dentist|copay|hospital|urgent care)\b/i,
    envelope: /health|medical|pharm|doctor/i,
  },
  { merchants: /\b(amazon|target|home depot|lowe'?s|ikea)\b/i, envelope: /shopping|household|home/i },
];

export function normalizePayee(payee: string): string {
  return payee.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function titleCase(s: string): string {
  if (s !== s.toLowerCase()) return s;
  return s.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

/** Drops "spent ... at" / "... on" around the merchant, but never words inside it. */
function stripFiller(text: string): string {
  let s = text.replace(/\s+/g, ' ').replace(/^[\s,.-]+|[\s,.-]+$/g, '');
  let prev = '';
  while (s !== prev) {
    prev = s;
    s = s.replace(LEADING_FILLER_RE, '').replace(TRAILING_FILLER_RE, '').trim();
  }
  return s;
}

function findAccount(text: string, accounts: Account[]): { account: Account; matched: string } | null {
  const open = accounts.filter((a) => !a.closed);
  // Full names first, longest first, so "Chase Freedom" beats "Chase".
  const byLength = [...open].sort((a, b) => b.name.length - a.name.length);
  for (const a of byLength) {
    const re = new RegExp(`\\b${escapeRe(a.name.toLowerCase())}\\b`, 'i');
    const m = text.match(re);
    if (m) return { account: a, matched: m[0] };
  }
  // Then distinctive words from a name ("chime" for "Chime Checking") if only one account has it.
  const wordOwners = new Map<string, Account[]>();
  for (const a of open) {
    for (const w of a.name.toLowerCase().split(/\s+/)) {
      if (w.length < 3 || ACCOUNT_STOPWORDS.has(w)) continue;
      wordOwners.set(w, [...(wordOwners.get(w) ?? []), a]);
    }
  }
  for (const [word, owners] of wordOwners) {
    if (owners.length !== 1) continue;
    const re = new RegExp(`\\b${escapeRe(word)}\\b`, 'i');
    const m = text.match(re);
    if (m) return { account: owners[0], matched: m[0] };
  }
  // Finally the kind itself ("savings", "cash") when there's exactly one of it.
  for (const kind of ['savings', 'cash'] as const) {
    const ofKind = open.filter((a) => a.kind === kind);
    const m = text.match(new RegExp(`\\b${kind}\\b`, 'i'));
    if (m && ofKind.length === 1) return { account: ofKind[0], matched: m[0] };
  }
  return null;
}

function findDate(text: string, today: ISODate): { date: ISODate; matched: string } | null {
  const lower = text.toLowerCase();
  let m = lower.match(/\byesterday\b/);
  if (m) return { date: addDays(today, -1), matched: m[0] };
  m = lower.match(/\btoday\b/);
  if (m) return { date: today, matched: m[0] };
  m = lower.match(/\b(?:last\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (m) {
    const target = WEEKDAYS.indexOf(m[1]);
    const current = fromISODate(today).getDay();
    const back = (current - target + 7) % 7 || 7;
    return { date: addDays(today, -back), matched: m[0] };
  }
  m = lower.match(/\b(\d{1,2})\/(\d{1,2})\b/);
  if (m) {
    const t = fromISODate(today);
    const d = new Date(t.getFullYear(), Number(m[1]) - 1, Number(m[2]));
    if (d > t) d.setFullYear(d.getFullYear() - 1);
    return { date: toISODate(d), matched: m[0] };
  }
  return null;
}

function guessEnvelope(payee: string, envelopes: Envelope[]): string | null {
  const usable = envelopes.filter((e) => !e.hidden && !e.debtAccountId);
  for (const hint of CATEGORY_HINTS) {
    if (!hint.merchants.test(payee)) continue;
    const match = usable.find((e) => hint.envelope.test(e.name));
    if (match) return match.id;
  }
  // The payee might literally name an envelope ("groceries 54").
  const direct = usable.find((e) =>
    new RegExp(`\\b${escapeRe(e.name.toLowerCase())}\\b`, 'i').test(payee),
  );
  return direct?.id ?? null;
}

/**
 * Turns "McDonald's 10.99", "$54.20 kroger yesterday", or "netflix 15.49 chime" into a
 * transaction draft. Runs on-device, so it works offline and instantly.
 */
export function parseQuickAdd(input: string, ctx: ParseContext): ParsedEntry {
  let rest = ` ${input.trim()} `;

  const date = findDate(rest, ctx.today);
  if (date) rest = rest.replace(new RegExp(escapeRe(date.matched), 'i'), ' ');

  // Amount: prefer one written with $ or cents, else the last number.
  let amount: Cents | null = null;
  let sign = '';
  const candidates = [...rest.matchAll(AMOUNT_RE)];
  const best =
    [...candidates].reverse().find((c) => /\$|\./.test(c[0])) ?? candidates[candidates.length - 1];
  if (best) {
    sign = best[2];
    amount = Math.round(parseFloat(best[3].replace(/,/g, '')) * 100);
    rest = rest.replace(best[0], best[1] + ' ');
  }

  const found = findAccount(rest, ctx.accounts);
  if (found) rest = rest.replace(new RegExp(escapeRe(found.matched), 'i'), ' ');

  const isIncome = sign === '+' || INCOME_RE.test(input);
  const defaultAccount = ctx.accounts
    .filter((a) => !a.closed && isCashAccount(a))
    .sort((a, b) => a.order - b.order)[0];
  const account = found?.account ?? defaultAccount ?? null;

  const payee = titleCase(stripFiller(rest));

  const kind: ParsedEntry['kind'] = isIncome
    ? 'income'
    : account && !isCashAccount(account)
      ? 'slip'
      : 'spend';

  let envelopeId: string | null = null;
  let envelopeSource: EnvelopeSource = 'none';
  if (kind !== 'income' && payee) {
    const remembered = ctx.merchantMemory[normalizePayee(payee)];
    if (remembered && ctx.envelopes.some((e) => e.id === remembered && !e.hidden)) {
      envelopeId = remembered;
      envelopeSource = 'remembered';
    } else {
      envelopeId = guessEnvelope(payee, ctx.envelopes);
      if (envelopeId) envelopeSource = 'guessed';
    }
  }

  return {
    amount,
    payee: payee || (isIncome ? 'Income' : ''),
    date: date?.date ?? ctx.today,
    accountId: account?.id ?? null,
    accountMentioned: !!found,
    kind,
    envelopeId,
    envelopeSource,
  };
}
