import React from 'react';
import { View, Text, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../lib/themeContext';
import { RADIUS } from '../../lib/tokens';

type TrendDirection = 'up' | 'down' | 'flat';

interface HeroCardProps {
  label: string;
  value: string;
  trend?: {
    direction: TrendDirection;
    text: string;
  };
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * HeroCard - Dashboard signature gradient surface for Direction B (Phase 32c.3.5).
 * Gradient: brandPrimary -> brandPrimaryDeep at 135deg, mode-adaptive via theme tokens.
 * White text is theme-independent (all four gradient stops are dark teals).
 *
 * Trend pill is rendered inline rather than composing <Pill> because it needs an
 * inline View triangle indicator and Pill renders children inside <Text>.
 *
 * Padding 18 / radius 18 are SRD section 6.6 hero-specific values - intentional
 * deviations from the strict 4-point scale, scoped to this component.
 */
export default function HeroCard({
  label,
  value,
  trend,
  onPress,
  style,
}: HeroCardProps) {
  const { colors, isDark } = useTheme();

  // White-on-gradient overline opacity differs slightly per mode for legibility.
  const labelOpacity = isDark ? 0.85 : 0.78;

  // 135deg = top-left to bottom-right. expo-linear-gradient uses start/end points.
  const gradientStart = { x: 0, y: 0 };
  const gradientEnd = { x: 1, y: 1 };

  const containerStyle: ViewStyle = {
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
  };

  // Triangle indicator for the trend pill - rendered as a CSS-shape View.
  const triangleSize = 4;
  const triangleColor = colors.brandPrimaryDeep;
  const triangleStyle: ViewStyle = trend
    ? {
        width: 0,
        height: 0,
        borderLeftWidth: triangleSize,
        borderRightWidth: triangleSize,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        marginRight: 5,
        ...(trend.direction === 'up'
          ? { borderBottomWidth: 5, borderBottomColor: triangleColor }
          : trend.direction === 'down'
          ? { borderTopWidth: 5, borderTopColor: triangleColor }
          : { height: 1, width: 8, backgroundColor: triangleColor, borderLeftWidth: 0, borderRightWidth: 0 }),
      }
    : {};

  const inner = (
    <LinearGradient
      colors={[colors.brandPrimary, colors.brandPrimaryDeep]}
      start={gradientStart}
      end={gradientEnd}
      style={{ padding: 18 }}
    >
      <Text
        style={{
          fontSize: 11,
          fontFamily: 'Manrope_600SemiBold',
          fontWeight: '600',
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: '#FFFFFF',
          opacity: labelOpacity,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          fontSize: 32,
          lineHeight: 38,
          fontFamily: 'Manrope_700Bold',
          fontWeight: '700',
          color: '#FFFFFF',
          marginTop: 6,
          fontVariant: ['tabular-nums'],
        }}
      >
        {value}
      </Text>
      {trend ? (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.brandPrimaryHighlight,
            paddingVertical: 4,
            paddingHorizontal: 10,
            borderRadius: RADIUS.pill,
            marginTop: 10,
            alignSelf: 'flex-start',
          }}
        >
          <View style={triangleStyle} />
          <Text
            style={{
              color: colors.brandPrimaryDeep,
              fontSize: 12,
              lineHeight: 16,
              fontFamily: 'Manrope_600SemiBold',
              fontWeight: '600',
              fontVariant: ['tabular-nums'],
            }}
          >
            {trend.text}
          </Text>
        </View>
      ) : null}
    </LinearGradient>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.85}
        style={[containerStyle, style]}
      >
        {inner}
      </TouchableOpacity>
    );
  }

  return <View style={[containerStyle, style]}>{inner}</View>;
}