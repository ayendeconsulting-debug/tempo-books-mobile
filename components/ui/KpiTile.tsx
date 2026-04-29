import React from 'react';
import { View, Text, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../lib/themeContext';
import { RADIUS } from '../../lib/tokens';
import type { ThemeColors } from '../../lib/tokens';

type KpiAccent = 'positive' | 'negative' | 'warning' | 'info' | 'brand';

interface KpiTileProps {
  label: string;
  value: string;
  accent: KpiAccent;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

function getAccentColor(accent: KpiAccent, colors: ThemeColors): string {
  switch (accent) {
    case 'positive': return colors.accentPositive;
    case 'negative': return colors.accentNegative;
    case 'warning':  return colors.accentWarning;
    case 'info':     return colors.accentInfo;
    case 'brand':    return colors.brandPrimary;
  }
}

/**
 * KpiTile - small KPI surface with accent left-border for Direction B (Phase 32c.3.4).
 * Shown in 3-tile rows on the Dashboard (Income / Expenses / Profit pattern).
 * Required accent prop drives the 3px left-border color and forces semantic intent at the call site.
 *
 * Caller pre-formats `value` as a string (e.g. "$24,180", "12.4%", "—").
 * Tabular figures applied automatically for column alignment.
 *
 * Tile-specific deviations from tokens.ts (intentional, scoped to this component):
 *  - Overline: 10/0.8 letterSpacing instead of 11/1, for tighter 3-across layouts
 *  - Padding: 9/9/9/7 to balance the 3px accent bar without losing content space
 */
export default function KpiTile({
  label,
  value,
  accent,
  onPress,
  style,
}: KpiTileProps) {
  const { colors } = useTheme();
  const accentColor = getAccentColor(accent, colors);

  const containerStyle: ViewStyle = {
    backgroundColor: colors.surfaceCard,
    borderLeftWidth: 3,
    borderLeftColor: accentColor,
    borderTopRightRadius: RADIUS.md,
    borderBottomRightRadius: RADIUS.md,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    paddingTop: 9,
    paddingRight: 9,
    paddingBottom: 9,
    paddingLeft: 7,
  };

  const inner = (
    <>
      <Text
        style={{
          fontSize: 10,
          fontFamily: 'Manrope_600SemiBold',
          fontWeight: '600',
          letterSpacing: 0.8,
          textTransform: 'uppercase',
          color: colors.inkSecondary,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 13,
          fontFamily: 'Manrope_700Bold',
          fontWeight: '700',
          color: colors.inkPrimary,
          marginTop: 2,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={[containerStyle, style]}
      >
        {inner}
      </TouchableOpacity>
    );
  }

  return <View style={[containerStyle, style]}>{inner}</View>;
}