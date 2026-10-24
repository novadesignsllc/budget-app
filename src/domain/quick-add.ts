import { addDays, fromISODate, toISODate } from './dates';
import type { Account, Cents, Envelope, FlagColor, ISODate } from './types';
import { FLAG_COLORS, isCashAccount } from './types';

export type ParseContext = {
  accounts: Account[];
  envelopes: Envelope[];
  /** Normalized payee → envelope id, learned from past transactions. */
  merchantMemory: Record<string, string>;
  today: ISODate;
  /**
   * The text came from dictation. Speech turns "two twenty-seven" into "227", so a bare
   * number of three or more digits reads as dollars and cents ($2.27). Saying "dollars",
   * a "$", a decimal point, or a thousands comma keeps it whole.
   */
  spoken?: boolean;
};

export type EnvelopeSource = 'said' | 'remembered' | 'guessed' | 'none';

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
  /** "note look into this" */
  memo?: string;
  /** "blue flag" */
  flagColor?: FlagColor;
};

const AMOUNT_RE = /(^|[\s(])([+-]?)\$?\s?((?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?)(?![\d%/])/g;
const INCOME_RE = /\b(paycheck|payday|salary|income|direct deposit|deposit|got paid|paid me)\b/i;
// Verbs only ever lead ("spent 10 at..."); prepositions can trail ("...10.99 on chime").
// Keeping "buy" out of the trailing list is what lets "Best Buy" survive.
const LEADING = '(?:spent|spend|paid|pay|bought|for|at|on|from|with|using|via|to|in|dollars?|bucks)';
const TRAILING = '(?:for|at|on|from|with|using|via|to|in|dollars?|bucks)';
const LEADING_FILLER_RE = new RegExp(`^${LEADING}\\b\\s*`, 'i');
const TRAILING_FILLER_RE = new RegExp(`\\s*\\b${TRAILING}$`, 'i');
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
  { merchants: /\b(amazon|target|best buy|walmart\.com|home depot|lowe'?s|ikea|costco\.com)\b/i, envelope: /shopping|household|home|fun/i },
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
  // Finally the kind itself ("checking", "savings", "cash"): the first one in your order.
  for (const kind of ['checking', 'savings', 'cash'] as const) {
    const ofKind = open.filter((a) => a.kind === kind).sort((a, b) => a.order - b.order);
    const m = text.match(new RegExp(`\\b${kind}\\b`, 'i'));
    if (m && ofKind.length) return { account: ofKind[0], matched: m[0] };
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
const NO_ENVELOPE = { envelopeId: null, envelopeSource: 'none' as EnvelopeSource };

/** The first bank account in the user's order: where a new transaction lands unless told otherwise. */
export function defaultAccount(accounts: Account[]): Account | undefined {
  return accounts.filter((a) => !a.closed && isCashAccount(a)).sort((a, b) => a.order - b.order)[0];
}

/** The envelope a payee usually goes to: remembered from the payee list, else guessed from the name. */
export function envelopeFor(payee: string, ctx: Pick<ParseContext, 'envelopes' | 'merchantMemory'>) {
  if (!payee) return NO_ENVELOPE;
  const remembered = ctx.merchantMemory[normalizePayee(payee)];
  if (remembered && ctx.envelopes.some((e) => e.id === remembered && !e.hidden)) {
    return { envelopeId: remembered as string | null, envelopeSource: 'remembered' as EnvelopeSource };
  }
  const guessed = guessEnvelope(payee, ctx.envelopes);
  return guessed ? { envelopeId: guessed, envelopeSource: 'guessed' as EnvelopeSource } : NO_ENVELOPE;
}

/**
 * A draft from the two typed fields. The name is taken as written (so "7-Eleven" stays a
 * name), and it always starts as an outflow; the Outflow/Inflow toggle changes that.
 */
export function draftFromFields(payee: string, amount: Cents | null, ctx: ParseContext): ParsedEntry {
  const name = payee.trim();
  const account = defaultAccount(ctx.accounts) ?? null;
  const { envelopeId, envelopeSource } = envelopeFor(name, ctx);
  return {
    amount,
    payee: name,
    date: ctx.today,
    accountId: account?.id ?? null,
    accountMentioned: false,
    kind: 'spend',
    envelopeId,
    envelopeSource,
  };
}

/** Spoken amounts come back in a few shapes; turn them into plain numbers first. */
export function normalizeSpoken(input: string): string {
  return input
    .replace(/(\d+)\s*dollars?\s*(?:and\s*)?(\d{1,2})\s*cents?/gi, (_m, d, c) => `${d}.${c.padStart(2, '0')}`)
    .replace(/(\d+)\s+point\s+(\d{1,2})\b/gi, '$1.$2')
    .replace(/(\d+(?:\.\d{1,2})?)\s*(?:dollars?|bucks)\b/gi, '$1');
}

const FLAG_WORDS = FLAG_COLORS.join('|');
const FLAG_RE = new RegExp(
  `\\b(?:(${FLAG_WORDS})\\s+flag(?:ged)?|flag(?:ged)?(?:\\s+(?:it|this))?(?:\\s+(?:as\\s+)?(${FLAG_WORDS}))?)\\b`,
  'i',
);

/** "note look into this" (or "memo ...") runs to the end of what was said. */
function findNote(text: string): { memo: string; index: number } | null {
  const m = text.match(/(?:^|\s)(?:note|memo)\b[:,]?\s*(.*)$/i);
  if (!m || m.index === undefined) return null;
  const memo = m[1].trim().replace(/[.\s]+$/, '');
  return { memo: memo.charAt(0).toUpperCase() + memo.slice(1), index: m.index };
}

/**
 * An envelope said by name: "groceries envelope", "envelope groceries", or just
 * "eating out" anywhere in the sentence ("Chipotle 14.50 eating out", "... for gas").
 * Saying "envelope" wins over a bare name.
 */
function findEnvelope(text: string, envelopes: Envelope[]): { id: string; matched: string; bare: boolean } | null {
  const usable = envelopes.filter((e) => !e.hidden && !e.debtAccountId).sort((a, b) => b.name.length - a.name.length);
  const lead = '(?:\\b(?:from|for|in|into|out of|under)\\s+)?(?:\\b(?:the|my)\\s+)?';
  for (const e of usable) {
    const name = escapeRe(e.name.toLowerCase()).replace(/\\? /g, '\\s+');
    const m = text.match(new RegExp(`${lead}\\b${name}\\s+envelope\\b|\\benvelope\\s+${name}\\b`, 'i'));
    if (m) return { id: e.id, matched: m[0], bare: false };
  }
  for (const e of usable) {
    const name = escapeRe(e.name.toLowerCase()).replace(/\\? /g, '\\s+');
    const m = text.match(new RegExp(`${lead}\\b${name}(?![\\w'])`, 'i'));
    if (m) return { id: e.id, matched: m[0], bare: true };
  }
  return null;
}

export function parseQuickAdd(input: string, ctx: ParseContext): ParsedEntry {
  // The note goes first: anything after "note" is the note, numbers and all.
  const note = findNote(input.trim());
  const said = note ? input.trim().slice(0, note.index) : input.trim();
  let rest = ` ${normalizeSpoken(said)} `;

  let flagColor: FlagColor | undefined;
  const flag = rest.match(FLAG_RE);
  if (flag) {
    flagColor = ((flag[1] ?? flag[2])?.toLowerCase() as FlagColor | undefined) ?? 'red';
    rest = rest.replace(flag[0], ' ');
  }

  const direction = rest.match(/\b(inflow|outflow)\b/i);
  if (direction) rest = rest.replace(direction[0], ' ');


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
    const digits = best[3];
    const wholeDollars = /\$|\b(dollars?|bucks)\b/i.test(said) || /[.,]/.test(digits);
    amount =
      ctx.spoken && !wholeDollars && digits.length >= 3
        ? parseInt(digits, 10)
        : Math.round(parseFloat(digits.replace(/,/g, '')) * 100);
    rest = rest.replace(best[0], best[1] + ' ');
  }

  const found = findAccount(rest, ctx.accounts);
  // "checking account", "chase card": the trailing word goes with the account.
  if (found) rest = rest.replace(new RegExp(`${escapeRe(found.matched)}(?:\\s+(?:account|card))?`, 'i'), ' ');

  const saidEnvelope = findEnvelope(rest, ctx.envelopes);
  if (saidEnvelope) {
    const without = rest.replace(saidEnvelope.matched, ' ');
    // "Groceries 54" names only the envelope: keep it as the payee too.
    const leavesAName = /[a-z]/i.test(without.replace(/\d[\d.,$]*/g, ''));
    if (!saidEnvelope.bare || leavesAName) rest = without;
  }

  const isIncome = direction ? direction[1].toLowerCase() === 'inflow' : sign === '+' || INCOME_RE.test(said);
  const account = found?.account ?? defaultAccount(ctx.accounts) ?? null;

  const payee = titleCase(stripFiller(rest));

  const kind: ParsedEntry['kind'] = isIncome
    ? 'income'
    : account && !isCashAccount(account)
      ? 'slip'
      : 'spend';

  const { envelopeId, envelopeSource } =
    kind === 'income'
      ? NO_ENVELOPE
      : saidEnvelope
        ? { envelopeId: saidEnvelope.id, envelopeSource: 'said' as EnvelopeSource }
        : envelopeFor(payee, ctx);

  return {
    amount,
    payee: payee || (isIncome ? 'Income' : ''),
    date: date?.date ?? ctx.today,
    accountId: account?.id ?? null,
    accountMentioned: !!found,
    kind,
    envelopeId,
    envelopeSource,
    ...(note?.memo ? { memo: note.memo } : {}),
    ...(flagColor ? { flagColor } : {}),
  };
}
