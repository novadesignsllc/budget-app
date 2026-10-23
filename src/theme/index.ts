import { Platform, type TextStyle } from 'react-native';

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
  /** Sheets dim the page behind them. */
  scrim: '#C9CFD9',
  floating: '#FFFFFF',
  heroFrom: '#E6E0FF',
  heroTo: '#FCE6F0',
};

export type Palette = typeof light;
export const palettes = { light, dark: light };

/** Light only for now (decided 2026-10-23). Kept as a hook so dark can come back later. */
export function useColors(): Palette {
  return light;
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
