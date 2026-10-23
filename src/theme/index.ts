import { Platform, type TextStyle } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

/**
 * The one source of truth for visual values. See DESIGN.md for the reasoning.
 * Screens import components; components import tokens from here.
 */

const light = {
  background: '#F4F4F6',
  surface: '#FFFFFF',
  fill: '#EBEBEF',
  fillPressed: '#DFDFE5',
  text: '#0B0B0F',
  textSecondary: '#5C5C66',
  textTertiary: '#8C8C96',
  separator: 'rgba(60, 60, 67, 0.14)',
  ink: '#0B0B0F',
  onInk: '#FFFFFF',
  accent: '#6248F0',
  accentSoft: '#EEEAFF',
  positive: '#13803F',
  positiveSoft: '#E5F5EB',
  negative: '#D42B1E',
  negativeSoft: '#FDECEA',
  warning: '#A85A00',
  warningSoft: '#FFF2DC',
  heroFrom: '#E8E2FF',
  heroTo: '#FCE6F2',
  scrim: 'rgba(0, 0, 0, 0.3)',
};

const dark: typeof light = {
  background: '#000000',
  surface: '#141416',
  fill: '#232327',
  fillPressed: '#2E2E33',
  text: '#F5F5F7',
  textSecondary: '#A1A1AB',
  textTertiary: '#6E6E78',
  separator: 'rgba(255, 255, 255, 0.10)',
  ink: '#F5F5F7',
  onInk: '#0B0B0F',
  accent: '#A796FF',
  accentSoft: '#241E3D',
  positive: '#3DD68C',
  positiveSoft: '#11291D',
  negative: '#FF6B61',
  negativeSoft: '#3A1714',
  warning: '#F5B83D',
  warningSoft: '#33260E',
  heroFrom: '#2A2148',
  heroTo: '#3B1D35',
  scrim: 'rgba(0, 0, 0, 0.5)',
};

export type Palette = typeof light;
export const palettes = { light, dark };

export function useColors(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

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
  sm: 10,
  md: 14,
  lg: 22,
  full: 9999,
} as const;

export const shadows = {
  card: '0 1px 2px rgba(17, 17, 26, 0.04), 0 6px 20px rgba(17, 17, 26, 0.05)',
  raised: '0 8px 28px rgba(17, 17, 26, 0.14)',
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
  display: { fontFamily, fontSize: 44, lineHeight: 50, fontWeight: '700', letterSpacing: -1.2, ...numeric },
  largeTitle: { fontFamily, fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: -0.6 },
  title: { fontFamily, fontSize: 22, lineHeight: 28, fontWeight: '600', letterSpacing: -0.3 },
  headline: { fontFamily, fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontFamily, fontSize: 17, lineHeight: 22, fontWeight: '400', letterSpacing: -0.2 },
  callout: { fontFamily, fontSize: 15, lineHeight: 20, fontWeight: '400', letterSpacing: -0.1 },
  footnote: { fontFamily, fontSize: 13, lineHeight: 18, fontWeight: '400' },
  caption: { fontFamily, fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const satisfies Record<string, TextStyle>;

export type TypeVariant = keyof typeof type;

/** Screen edge padding. */
export const gutter = spacing.lg;
/** Readable width on tablets and desktop. */
export const maxContentWidth = 720;
