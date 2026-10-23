import { Platform, type TextStyle } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * The one source of truth for visual values. See DESIGN.md for the reasoning.
 * Screens import components; components import tokens from here.
 */

const light = {
  background: '#F4F4F6',
  surface: '#FFFFFF',
  fill: '#EDEDF1',
  fillPressed: '#E1E1E7',
  text: '#0B0B0F',
  textSecondary: '#5C5C66',
  textTertiary: '#8C8C96',
  placeholder: '#A3A3AD',
  separator: 'rgba(60, 60, 67, 0.14)',
  hairline: 'rgba(60, 60, 67, 0.12)',
  ink: '#0B0B0F',
  onInk: '#FFFFFF',
  accent: '#6248F0',
  accentSoft: '#EEEAFF',
  blue: '#2F6BEA',
  blueSoft: '#E6EEFF',
  positive: '#13803F',
  positiveSoft: '#E5F5EB',
  negative: '#D42B1E',
  negativeSoft: '#FDECEA',
  warning: '#A85A00',
  warningSoft: '#FFF2DC',
  heroFrom: '#E6E0FF',
  heroTo: '#FCE6F0',
  floating: 'rgba(255, 255, 255, 0.94)',
};

const dark: typeof light = {
  background: '#000000',
  surface: '#141416',
  fill: '#232327',
  fillPressed: '#2E2E33',
  text: '#F5F5F7',
  textSecondary: '#A1A1AB',
  textTertiary: '#6E6E78',
  placeholder: '#5E5E68',
  separator: 'rgba(255, 255, 255, 0.10)',
  hairline: 'rgba(255, 255, 255, 0.10)',
  ink: '#F5F5F7',
  onInk: '#0B0B0F',
  accent: '#A796FF',
  accentSoft: '#241E3D',
  blue: '#6EA8FF',
  blueSoft: '#152340',
  positive: '#3DD68C',
  positiveSoft: '#11291D',
  negative: '#FF6B61',
  negativeSoft: '#3A1714',
  warning: '#F5B83D',
  warningSoft: '#33260E',
  heroFrom: '#2A2148',
  heroTo: '#1D2A52',
  floating: 'rgba(36, 36, 40, 0.94)',
};

export type Palette = typeof light;
export const palettes = { light, dark };

export function useColors(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

/**
 * Each envelope group gets a hue so a glance tells bills from spending from savings.
 * Red is never used here: red only ever means overspent.
 */
const groupHues = {
  light: {
    Bills: { fg: '#2F6BEA', soft: '#E6EEFF' },
    Everyday: { fg: '#6248F0', soft: '#EEEAFF' },
    Savings: { fg: '#13803F', soft: '#E5F5EB' },
    'Debt payments': { fg: '#3F3D56', soft: '#ECECF1' },
    other: [
      { fg: '#0E7490', soft: '#E0F4F8' },
      { fg: '#B4237A', soft: '#FBE7F2' },
      { fg: '#B45309', soft: '#FDF0DC' },
    ],
  },
  dark: {
    Bills: { fg: '#6EA8FF', soft: '#152340' },
    Everyday: { fg: '#A796FF', soft: '#241E3D' },
    Savings: { fg: '#3DD68C', soft: '#11291D' },
    'Debt payments': { fg: '#C9C7DB', soft: '#232327' },
    other: [
      { fg: '#5ED3EA', soft: '#0F2A31' },
      { fg: '#F48FC8', soft: '#33172A' },
      { fg: '#F5B86A', soft: '#33240F' },
    ],
  },
};

export type Hue = { fg: string; soft: string };

export function useGroupHue(group: string): Hue {
  const scheme = useColorScheme();
  return groupHue(group, scheme);
}

export function groupHue(group: string, scheme: 'light' | 'dark'): Hue {
  const set = groupHues[scheme];
  if (group in set && group !== 'other') return set[group as keyof Omit<typeof set, 'other'>] as Hue;
  let h = 0;
  for (const ch of group) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return set.other[h % set.other.length];
}

/**
 * Card faces for accounts and debts, kept within one hue family each (no rainbow
 * washes). `ink` is the text color on that face.
 */
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
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  full: 9999,
} as const;

/** One shadow, only for things that float over content. Everything else is flat. */
export const shadows = {
  float: '0 2px 10px rgba(0, 0, 0, 0.08)',
} as const;

export const motion = {
  fast: 150,
  base: 250,
} as const;

/** SF Pro. On iOS it's the system font; on web we ask for it by name. */
const fontFamily = Platform.select({
  web: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Display", system-ui, sans-serif',
  default: undefined,
});

const numeric: TextStyle = { fontVariant: ['tabular-nums'] };

export const type = {
  display: { fontFamily, fontSize: 36, lineHeight: 42, fontWeight: '700', letterSpacing: -1, ...numeric },
  largeTitle: { fontFamily, fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.6 },
  title: { fontFamily, fontSize: 20, lineHeight: 25, fontWeight: '600', letterSpacing: -0.3 },
  headline: { fontFamily, fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: -0.1 },
  body: { fontFamily, fontSize: 15, lineHeight: 20, fontWeight: '400', letterSpacing: -0.1 },
  callout: { fontFamily, fontSize: 13, lineHeight: 18, fontWeight: '400' },
  footnote: { fontFamily, fontSize: 12, lineHeight: 16, fontWeight: '400' },
  caption: { fontFamily, fontSize: 11, lineHeight: 13, fontWeight: '500' },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

/** Screen edge padding. */
export const gutter = 20;
/** Readable width on tablets and desktop. */
export const maxContentWidth = 720;
