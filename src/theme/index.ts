import { Platform, type TextStyle } from 'react-native';
import { create } from 'zustand';
// localStorage on phones too, so the light/dark choice is read before the first frame.
import 'expo-sqlite/localStorage/install';

/**
 * The one source of truth for visual values. Approved mockup:
 * https://claude.ai/artifact/P2wZyZDtBkgBFBV1LarLyU (light, SF Pro).
 * Principles and decisions: docs/design-principles.md.
 * Screens import components; components import tokens from here.
 */

const light = {
  /** Page behind everything. */
  background: '#F3F5F9',
  /** Cards. */
  surface: '#FFFFFF',
  /** Table header strip inside a card. */
  tableHeader: '#FAFBFD',
  /** Inputs, dropdown fields, outlined buttons. */
  control: '#F1F4F9',
  fill: '#E6EBF3',
  fillPressed: '#E3E8F0',
  text: '#0B1220',
  textSecondary: '#5D6B82',
  textTertiary: '#8B97AA',
  placeholder: '#8B97AA',
  /** Card outline. */
  border: 'rgba(20, 40, 80, 0.09)',
  /** Control outline. */
  borderStrong: 'rgba(20, 40, 80, 0.12)',
  /** Line between a card's header row and its rows. */
  separator: 'rgba(20, 40, 80, 0.08)',
  /** Line between rows. */
  hairline: 'rgba(20, 40, 80, 0.06)',
  ink: '#0B1220',
  onInk: '#FFFFFF',
  /** Purple: actions, selection, links, the active tab. */
  accent: '#5B4CF0',
  accentSoft: '#F0EEFE',
  /** The faintest tint, for a selected row. */
  accentFaint: '#F7F6FF',
  blue: '#2F6FEB',
  blueSoft: '#E8EFFD',
  /** Due, flags, needs attention. */
  orange: '#C2560F',
  orangeSoft: '#FFF0E6',
  positive: '#13803F',
  positiveSoft: '#E2F3E8',
  /** Slips, overspent, urgent. */
  negative: '#B42318',
  negativeStrong: '#D92D20',
  negativeSoft: '#FDEEEC',
  negativeTint: '#FFF6F5',
  warning: '#C2560F',
  warningSoft: '#FFF0E6',
  /** "Getting close": a yellow that still reads as text. */
  caution: '#946200',
  cautionDot: '#F5B700',
  cautionSoft: '#FFF6D6',
  /** Sheets dim the page behind them. */
  scrim: '#C9CFD9',
  floating: '#FFFFFF',
  heroFrom: '#E6E0FF',
  heroTo: '#FCE6F0',
  /** Left pills: green with money, its text; grey at zero; dark red text on the red pill. */
  okSoft: '#E9F6EE',
  okInk: '#2E6B45',
  neutralSoft: '#E9EDF3',
  negativeInk: '#7A271A',
  positiveBorder: 'rgba(19, 128, 63, 0.25)',
  negativeBorder: 'rgba(180, 35, 24, 0.25)',
  orangeBorder: 'rgba(194, 86, 15, 0.35)',
  /** Reconciled rows: faded text on a faint grey row. */
  textMuted: '#A3ADBD',
  rowDone: '#F6F7FA',
  rowDoneHover: '#EEF1F6',
  /** Disabled days, idle drag handles. */
  disabled: '#B8C0CE',
  /** Menus and selected filter pills. */
  menuBorder: 'rgba(20, 40, 80, 0.14)',
  /** Behind an open menu, and behind a sheet. */
  backdropLight: 'rgba(11, 18, 32, 0.06)',
  backdrop: 'rgba(11, 18, 32, 0.32)',
  /** Charts: grid lines, the hover line, the projected side. */
  chartGrid: 'rgba(20, 40, 80, 0.06)',
  chartBaseline: 'rgba(20, 40, 80, 0.14)',
  chartCrosshair: 'rgba(20, 40, 80, 0.25)',
  chartShade: 'rgba(20, 40, 80, 0.025)',
  chartDivider: 'rgba(20, 40, 80, 0.18)',
};

export type Palette = typeof light;

/**
 * Dark: its own steps, not an inverted light. Cards sit a step above the page, text is
 * off-white, and status colors are lifted so they still read on dark. White stays the
 * text on accent buttons, so `ink` (the dark button) is a raised grey here.
 */
const dark: Palette = {
  background: '#0C1018',
  surface: '#161B24',
  tableHeader: '#1A202A',
  control: '#212835',
  fill: '#2A3240',
  fillPressed: '#323B4B',
  text: '#E8ECF3',
  textSecondary: '#9AA5B8',
  textTertiary: '#717D91',
  placeholder: '#6C788C',
  border: 'rgba(255, 255, 255, 0.08)',
  borderStrong: 'rgba(255, 255, 255, 0.12)',
  separator: 'rgba(255, 255, 255, 0.08)',
  hairline: 'rgba(255, 255, 255, 0.05)',
  ink: '#343D4E',
  onInk: '#FFFFFF',
  accent: '#7B6FF4',
  accentSoft: '#272646',
  accentFaint: '#1C1F31',
  blue: '#6EA0FF',
  blueSoft: '#17243D',
  orange: '#FF9B57',
  orangeSoft: '#33231A',
  positive: '#45C97E',
  positiveSoft: '#16301F',
  negative: '#FF7A6E',
  negativeStrong: '#FF5A4D',
  negativeSoft: '#3A1D1C',
  negativeTint: '#22181C',
  warning: '#FF9B57',
  warningSoft: '#33231A',
  caution: '#F2C14E',
  cautionDot: '#F5B700',
  cautionSoft: '#332B14',
  scrim: '#05070B',
  floating: '#1E2430',
  heroFrom: '#28224D',
  heroTo: '#3A1E33',
  okSoft: '#163020',
  okInk: '#7ED9A0',
  neutralSoft: '#252C38',
  negativeInk: '#FFB3AA',
  positiveBorder: 'rgba(69, 201, 126, 0.3)',
  negativeBorder: 'rgba(255, 122, 110, 0.3)',
  orangeBorder: 'rgba(255, 155, 87, 0.35)',
  textMuted: '#5E6A7D',
  rowDone: '#12161E',
  rowDoneHover: '#1A1F29',
  disabled: '#4A5465',
  menuBorder: 'rgba(255, 255, 255, 0.14)',
  backdropLight: 'rgba(0, 0, 0, 0.25)',
  backdrop: 'rgba(0, 0, 0, 0.55)',
  chartGrid: 'rgba(255, 255, 255, 0.06)',
  chartBaseline: 'rgba(255, 255, 255, 0.16)',
  chartCrosshair: 'rgba(255, 255, 255, 0.3)',
  chartShade: 'rgba(255, 255, 255, 0.03)',
  chartDivider: 'rgba(255, 255, 255, 0.2)',
};

export const palettes = { light, dark };

/**
 * Light or dark, chosen in Settings and kept on this device only (not the account), so a
 * phone and a computer can differ.
 */
const SCHEME_KEY = 'slip-scheme';
function savedScheme(): 'light' | 'dark' {
  try {
    return localStorage.getItem(SCHEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}
export const useScheme = create<{ scheme: 'light' | 'dark' }>()(() => ({ scheme: savedScheme() }));
export function setScheme(scheme: 'light' | 'dark') {
  try {
    localStorage.setItem(SCHEME_KEY, scheme);
  } catch {}
  useScheme.setState({ scheme });
}

/**
 * The accent of the profile you're in. Each profile can pick one of these; all keep white
 * text readable on them (4.5:1+), and none is red, orange, yellow or green, which mean
 * overspent, due, short and funded.
 */
export const ACCENTS = [
  { name: 'Purple', hex: '#5B4CF0' },
  { name: 'Blue', hex: '#2563EB' },
  { name: 'Teal', hex: '#0F766E' },
  { name: 'Magenta', hex: '#A21CAF' },
  { name: 'Graphite', hex: '#3F4A5C' },
] as const;

export const useAccent = create<{ accent: string }>()(() => ({ accent: light.accent }));

/** A solid light tint of a color, for soft backgrounds behind it. */
export function tint(hex: string, amount: number): string {
  return mix(hex, '#FFFFFF', amount);
}

/** `hex` laid over `base` at `amount` (0 to 1), as a solid color. */
function mix(hex: string, base: string, amount: number): string {
  const rgb = (h: string) => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [a, b] = [rgb(hex), rgb(base)];
  const [r, g, bl] = a.map((c, i) => Math.round(b[i] + (c - b[i]) * amount));
  return `#${((1 << 24) | (r << 16) | (g << 8) | bl).toString(16).slice(1).toUpperCase()}`;
}

const withAccent = new Map<string, Palette>();
/** The palette for this device's light or dark setting, with the current profile's accent. */
export function useColors(): Palette {
  const accent = useAccent((s) => s.accent);
  const scheme = useScheme((s) => s.scheme);
  return paletteFor(scheme, accent);
}

export function paletteFor(scheme: 'light' | 'dark', accent: string): Palette {
  const base = scheme === 'dark' ? dark : light;
  if (accent === light.accent) return base;
  const key = `${scheme}${accent}`;
  let palette = withAccent.get(key);
  if (!palette) {
    // On dark, the accent is lifted a little so links and selection read on the dark cards.
    const shown = scheme === 'dark' ? mix(accent, '#FFFFFF', 0.78) : accent;
    palette =
      scheme === 'dark'
        ? { ...base, accent: shown, accentSoft: mix(shown, base.surface, 0.2), accentFaint: mix(shown, base.surface, 0.08) }
        : { ...base, accent, accentSoft: tint(accent, 0.09), accentFaint: tint(accent, 0.04) };
    withAccent.set(key, palette);
  }
  return palette;
}

/**
 * Chart series, in fixed order, never cycled. Checked with the data-viz validator for
 * colorblind separation on the light surface. Slots 3 and 4 are low contrast, so every
 * chart labels its lines directly as well as with a legend.
 */
export const chartColors = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];
export const chartCash = chartColors[0];
export const chartDebt = chartColors[1];

/** Envelope group hues: a dot on the group header and the color of its bars. */
const groupHues: Record<string, string> = {
  Bills: '#2a78d6',
  Daily: '#5B4CF0',
  Savings: '#1baf7a',
  Subscriptions: '#0E8FA0',
  'Debt payments': '#8B97AA',
};
const otherHues = ['#0E7490', '#B4237A', '#B45309'];

export type Hue = { fg: string; soft: string };

export function groupColor(group: string): string {
  if (groupHues[group]) return groupHues[group];
  let h = 0;
  for (const ch of group) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return otherHues[h % otherHues.length];
}

/** Soft tint of a hue for icon tiles. */
export function softOf(hex: string, alpha = 0.12): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

export function groupHue(group: string, _scheme?: unknown): Hue {
  const fg = groupColor(group);
  return { fg, soft: softOf(fg) };
}

export function useGroupHue(group: string): Hue {
  return groupHue(group);
}

/** Card faces for accounts in lists (mini cards). */
export const cardFaces = [
  { from: '#3730A3', to: '#6D5DF5', ink: '#FFFFFF' },
  { from: '#1D4ED8', to: '#4F8DF7', ink: '#FFFFFF' },
  { from: '#16161C', to: '#2C2C38', ink: '#FFFFFF' },
  { from: '#D3EC63', to: '#EEF0A0', ink: '#1D2108' },
  { from: '#EEEEF1', to: '#C8C9D1', ink: '#0B0B0F' },
  { from: '#5B21B6', to: '#8B5CF6', ink: '#FFFFFF' },
] as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

/** Flag swatches. Saturated enough to read as a small icon in a table row. */
export const flagHues = {
  red: '#E5484D',
  orange: '#F76B15',
  yellow: '#F5B700',
  green: '#30A46C',
  blue: '#0090FF',
  purple: '#8E4EC6',
} as const;

export const radius = {
  /** Buttons. */
  button: 8,
  /** Inputs and dropdown fields. */
  control: 10,
  /** Dropdown menus and sheets' grouped rows. */
  menu: 14,
  /** Cards. */
  card: 16,
  sm: 8,
  md: 10,
  lg: 16,
  xl: 22,
  full: 9999,
} as const;

/** No shadows anywhere (principle 5). Kept so old imports still compile. */
export const shadows = {
  float: 'none',
} as const;

export const motion = {
  fast: 150,
  base: 250,
} as const;

/** SF Pro: the system font on iOS; requested by name on web. */
export const fontFamily = Platform.select({
  web: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
  default: undefined,
});

const numeric: TextStyle = { fontVariant: ['tabular-nums'] };

export const type = {
  /** The one big number on a card. */
  number: { fontFamily, fontSize: 24, lineHeight: 29, fontWeight: '600', letterSpacing: -0.4, ...numeric },
  display: { fontFamily, fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.5, ...numeric },
  /** Screen title, centered. */
  title: { fontFamily, fontSize: 18, lineHeight: 23, fontWeight: '700' },
  largeTitle: { fontFamily, fontSize: 18, lineHeight: 23, fontWeight: '700' },
  /** Card and section headings. */
  section: { fontFamily, fontSize: 15, lineHeight: 19, fontWeight: '600' },
  headline: { fontFamily, fontSize: 14, lineHeight: 18, fontWeight: '600' },
  body: { fontFamily, fontSize: 14, lineHeight: 18, fontWeight: '400' },
  /** Dense table text. */
  row: { fontFamily, fontSize: 13, lineHeight: 17, fontWeight: '400' },
  callout: { fontFamily, fontSize: 13, lineHeight: 17, fontWeight: '400' },
  footnote: { fontFamily, fontSize: 12, lineHeight: 15, fontWeight: '400' },
  caption: { fontFamily, fontSize: 11, lineHeight: 14, fontWeight: '400' },
  /** Uppercase column labels. */
  label: { fontFamily, fontSize: 11, lineHeight: 14, fontWeight: '600', letterSpacing: 0.7 },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

/** Screen edge padding. */
export const gutter = 16;
/** Readable width on tablets and desktop. */
export const maxContentWidth = 720;
