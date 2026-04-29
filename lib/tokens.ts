// lib/tokens.ts
// Phase 32c.2 - Direction B (Editorial fintech) design tokens for Tempo Books mobile.
// Pure constants module. Consumed by themeContext.tsx and primitive components in 32c.3+.

import type { TextStyle } from 'react-native';

export interface ThemeColors {
  // Direction B canonical tokens (SRD section 6.2)
  brandPrimary: string;
  brandPrimaryDeep: string;
  brandPrimaryHighlight: string;
  surfaceApp: string;
  surfaceCard: string;
  surfaceCardElevated: string;
  inkPrimary: string;
  inkSecondary: string;
  inkTertiary: string;
  accentPositive: string;
  accentNegative: string;
  accentWarning: string;
  accentInfo: string;
  borderSubtle: string;
  borderDefault: string;

  // Legacy aliases preserved for back-compat with 18 consumer screens.
  // 32c.4/5 sweeps will gradually migrate consumers to canonical names.
  background: string;
  card: string;
  cardBorder: string;
  text: string;
  subtext: string;
  placeholder: string;
  border: string;
  divider: string;
  primary: string;
  primaryLight: string;
  primaryText: string;
  danger: string;
  dangerLight: string;
  warning: string;
  warningLight: string;
  tabBar: string;
  tabBarBorder: string;
  header: string;
  inputBg: string;
  inputBorder: string;
  badgeBg: string;
}

export const LIGHT_TOKENS: ThemeColors = {
  brandPrimary: '#0F6E56',
  brandPrimaryDeep: '#0A4F3E',
  brandPrimaryHighlight: '#7FE8C7',
  surfaceApp: '#F5F1EA',
  surfaceCard: '#FFFFFF',
  surfaceCardElevated: '#FFFFFF',
  inkPrimary: '#1A2520',
  inkSecondary: '#6B7570',
  inkTertiary: '#A8B0AA',
  accentPositive: '#1D9E75',
  accentNegative: '#D85A30',
  accentWarning: '#BA7517',
  accentInfo: '#185FA5',
  borderSubtle: 'rgba(0,0,0,0.08)',
  borderDefault: 'rgba(0,0,0,0.16)',

  background: '#F5F1EA',
  card: '#FFFFFF',
  cardBorder: 'rgba(0,0,0,0.08)',
  text: '#1A2520',
  subtext: '#6B7570',
  placeholder: '#A8B0AA',
  border: 'rgba(0,0,0,0.08)',
  divider: 'rgba(0,0,0,0.16)',
  primary: '#0F6E56',
  primaryLight: '#E8F2EC',
  primaryText: '#FFFFFF',
  danger: '#D85A30',
  dangerLight: '#FBE9DF',
  warning: '#BA7517',
  warningLight: '#FBEFD9',
  tabBar: '#FFFFFF',
  tabBarBorder: 'rgba(0,0,0,0.08)',
  header: '#0F6E56',
  inputBg: '#FFFFFF',
  inputBorder: 'rgba(0,0,0,0.16)',
  badgeBg: '#FFFFFF',
};

export const DARK_TOKENS: ThemeColors = {
  brandPrimary: '#1FA07C',
  brandPrimaryDeep: '#16886D',
  brandPrimaryHighlight: '#7FE8C7',
  surfaceApp: '#1A1F1D',
  surfaceCard: '#262B28',
  surfaceCardElevated: '#2E332F',
  inkPrimary: '#F5F1EA',
  inkSecondary: '#A8B0AA',
  inkTertiary: '#6B7570',
  accentPositive: '#5DCAA5',
  accentNegative: '#F0997B',
  accentWarning: '#EF9F27',
  accentInfo: '#85B7EB',
  borderSubtle: 'rgba(255,255,255,0.10)',
  borderDefault: 'rgba(255,255,255,0.18)',

  background: '#1A1F1D',
  card: '#262B28',
  cardBorder: 'rgba(255,255,255,0.10)',
  text: '#F5F1EA',
  subtext: '#A8B0AA',
  placeholder: '#6B7570',
  border: 'rgba(255,255,255,0.10)',
  divider: 'rgba(255,255,255,0.18)',
  primary: '#1FA07C',
  primaryLight: '#1A3D33',
  primaryText: '#FFFFFF',
  danger: '#F0997B',
  dangerLight: '#3D2218',
  warning: '#EF9F27',
  warningLight: '#3D2C12',
  tabBar: '#262B28',
  tabBarBorder: 'rgba(255,255,255,0.10)',
  header: '#1FA07C',
  inputBg: '#262B28',
  inputBorder: 'rgba(255,255,255,0.18)',
  badgeBg: '#2E332F',
};

// Back-compat const aliases for any code that imports LIGHT/DARK directly.
export const LIGHT = LIGHT_TOKENS;
export const DARK = DARK_TOKENS;

// Typography scale (SRD section 6.3)
// Manrope loaded in app/_layout.tsx via @expo-google-fonts/manrope (Phase 32c.1).
export const TYPE_SCALE: Record<string, TextStyle> = {
  displayXl: { fontSize: 32, lineHeight: 38, fontFamily: 'Manrope_700Bold', fontWeight: '700' },
  displayLg: { fontSize: 28, lineHeight: 34, fontFamily: 'Manrope_700Bold', fontWeight: '700' },
  displayMd: { fontSize: 22, lineHeight: 28, fontFamily: 'Manrope_700Bold', fontWeight: '700' },
  bodyLg:    { fontSize: 18, lineHeight: 26, fontFamily: 'Manrope_600SemiBold', fontWeight: '600' },
  bodyMd:    { fontSize: 16, lineHeight: 24, fontFamily: 'Manrope_400Regular', fontWeight: '400' },
  bodySm:    { fontSize: 14, lineHeight: 20, fontFamily: 'Manrope_400Regular', fontWeight: '400' },
  labelMd:   { fontSize: 13, lineHeight: 18, fontFamily: 'Manrope_600SemiBold', fontWeight: '600' },
  caption:   { fontSize: 12, lineHeight: 16, fontFamily: 'Manrope_600SemiBold', fontWeight: '600' },
  overline:  { fontSize: 11, lineHeight: 14, fontFamily: 'Manrope_600SemiBold', fontWeight: '600', letterSpacing: 1 },
};

// Spacing scale (SRD section 6.4) - strict 4-point base, no in-between values.
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
  display: 56,
  hero: 80,
};

// Corner radii used by primitive components in 32c.3.
export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 14,
  xl: 18,
  pill: 999,
};

// Motion (SRD section 6.5) - cubic-bezier(0.2, 0.8, 0.2, 1), no spring/bounce.
export const MOTION = {
  durationFast: 150,
  durationStandard: 200,
  durationSlow: 280,
  easing: [0.2, 0.8, 0.2, 1] as const,
};

// Tabular figures helper for currency rendering (FR-32c-5).
export const TABULAR_NUMS: Pick<TextStyle, 'fontVariant'> = {
  fontVariant: ['tabular-nums'],
};