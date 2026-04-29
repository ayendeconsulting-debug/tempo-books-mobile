import React from 'react';
import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../lib/themeContext';
import { RADIUS } from '../../lib/tokens';
import type { ThemeColors } from '../../lib/tokens';

type PillVariant = 'positive' | 'negative' | 'warning' | 'info' | 'neutral' | 'brand';
type PillSize = 'sm' | 'md';

interface PillProps {
  children: React.ReactNode;
  variant?: PillVariant;
  size?: PillSize;
  style?: StyleProp<ViewStyle>;
}

interface PillColors {
  bg: string;
  fg: string;
}

// Family-tinted bg/fg pairs per variant - intentionally inline per Path A.
// These are internal Pill implementation, not design-system tokens reused elsewhere.
function getPillColors(variant: PillVariant, colors: ThemeColors, isDark: boolean): PillColors {
  switch (variant) {
    case 'positive':
      return isDark ? { bg: '#1A3D33', fg: '#5DCAA5' } : { bg: '#E1F5EE', fg: '#085041' };
    case 'negative':
      return isDark ? { bg: '#3D2218', fg: '#F0997B' } : { bg: '#FBE9DF', fg: '#993C1D' };
    case 'warning':
      return isDark ? { bg: '#3D2C12', fg: '#EF9F27' } : { bg: '#FBEFD9', fg: '#854F0B' };
    case 'info':
      return isDark ? { bg: '#1A2D45', fg: '#85B7EB' } : { bg: '#E6F1FB', fg: '#0C447C' };
    case 'brand':
      return isDark ? { bg: '#1A3D33', fg: '#7FE8C7' } : { bg: '#E8F2EC', fg: '#0A4F3E' };
    case 'neutral':
    default:
      return { bg: colors.surfaceCardElevated, fg: colors.inkSecondary };
  }
}

const SIZE_SPECS: Record<PillSize, { paddingV: number; paddingH: number; fontSize: number; lineHeight: number }> = {
  sm: { paddingV: 2, paddingH: 8, fontSize: 11, lineHeight: 14 },
  md: { paddingV: 4, paddingH: 10, fontSize: 12, lineHeight: 16 },
};

/**
 * Pill - status indicator primitive for Direction B (Phase 32c.3.2).
 * Six variants with family-tinted light/dark bg/fg pairs.
 * Self-fits content; alignSelf: 'flex-start' for column layouts (override via style for row contexts).
 */
export default function Pill({
  children,
  variant = 'neutral',
  size = 'sm',
  style,
}: PillProps) {
  const { colors, isDark } = useTheme();
  const { bg, fg } = getPillColors(variant, colors, isDark);
  const spec = SIZE_SPECS[size];

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          paddingVertical: spec.paddingV,
          paddingHorizontal: spec.paddingH,
          borderRadius: RADIUS.pill,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: fg,
          fontSize: spec.fontSize,
          lineHeight: spec.lineHeight,
          fontFamily: 'Manrope_600SemiBold',
          fontWeight: '600',
        }}
      >
        {children}
      </Text>
    </View>
  );
}