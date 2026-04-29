import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../lib/themeContext';
import { RADIUS, SPACING } from '../../lib/tokens';

type AccentVariant = 'positive' | 'negative' | 'warning' | 'info' | 'brand' | 'none';

interface CardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated';
  accent?: AccentVariant;
  padding?: 'compact' | 'default' | 'prominent';
  borderless?: boolean;
  style?: StyleProp<ViewStyle>;
}

const PADDING_MAP: Record<NonNullable<CardProps['padding']>, number> = {
  compact: SPACING.base,    // 16
  default: SPACING.lg,      // 20
  prominent: SPACING.xl,    // 24
};

/**
 * Card - foundation surface primitive for Direction B (Phase 32c.3).
 * Tokens-only. Presentational. Wrap in TouchableOpacity for press behavior.
 */
export default function Card({
  children,
  variant = 'default',
  accent = 'none',
  padding = 'default',
  borderless = false,
  style,
}: CardProps) {
  const { colors } = useTheme();

  const accentColor =
    accent === 'positive' ? colors.accentPositive :
    accent === 'negative' ? colors.accentNegative :
    accent === 'warning'  ? colors.accentWarning  :
    accent === 'info'     ? colors.accentInfo     :
    accent === 'brand'    ? colors.brandPrimary   :
    null;

  const backgroundColor =
    variant === 'elevated' ? colors.surfaceCardElevated : colors.surfaceCard;

  const baseStyle: ViewStyle = {
    backgroundColor,
    borderRadius: RADIUS.lg,
    padding: PADDING_MAP[padding],
  };

  if (!borderless && !accentColor) {
    baseStyle.borderWidth = 0.5;
    baseStyle.borderColor = colors.borderSubtle;
  }

  if (accentColor) {
    baseStyle.borderLeftWidth = 3;
    baseStyle.borderLeftColor = accentColor;
    // Square the left corners so the accent bar runs flush.
    baseStyle.borderTopLeftRadius = 0;
    baseStyle.borderBottomLeftRadius = 0;
  }

  return <View style={[baseStyle, style]}>{children}</View>;
}