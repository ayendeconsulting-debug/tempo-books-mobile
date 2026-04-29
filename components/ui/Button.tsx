import React, { useRef } from 'react';
import {
  Animated,
  ActivityIndicator,
  Easing,
  Text,
  TouchableOpacity,
  View,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useTheme } from '../../lib/themeContext';
import { RADIUS } from '../../lib/tokens';
import type { ThemeColors } from '../../lib/tokens';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'warning' | 'destructive';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

interface ButtonColors {
  bg: string;
  fg: string;
  borderColor: string | null;
}

function getButtonColors(variant: ButtonVariant, colors: ThemeColors): ButtonColors {
  switch (variant) {
    case 'primary':
      // White text on the brand-teal fill is theme-independent.
      return { bg: colors.brandPrimary, fg: '#FFFFFF', borderColor: null };
    case 'secondary':
      return { bg: colors.surfaceCard, fg: colors.inkPrimary, borderColor: colors.borderDefault };
    case 'tertiary':
      return { bg: 'transparent', fg: colors.brandPrimary, borderColor: null };
    case 'warning':
      // White text on the warm-amber fill is theme-independent (same exception standard as primary).
      return { bg: colors.accentWarning, fg: '#FFFFFF', borderColor: null };
    case 'destructive':
      // Transparent fill with accent-negative outline + text. Same shape as the inline destructive
      // pattern used pre-32c.3.6 (Void Invoice, Sign Out, Disconnect bank, Unclassify, Delete category).
      return { bg: 'transparent', fg: colors.accentNegative, borderColor: colors.accentNegative };
  }
}

const SIZE_SPECS: Record<ButtonSize, { height: number; paddingH: number; fontSize: number }> = {
  sm: { height: 36, paddingH: 14, fontSize: 14 },
  md: { height: 44, paddingH: 18, fontSize: 15 },
  lg: { height: 52, paddingH: 22, fontSize: 16 },
};

// FR-32c-8: scale to 0.96 with 150ms cubic-bezier(0.2, 0.8, 0.2, 1).
const PRESS_EASING = Easing.bezier(0.2, 0.8, 0.2, 1);
const PRESS_DURATION = 150;
const PRESS_SCALE = 0.96;

/**
 * Button - press-animated CTA primitive for Direction B.
 * Phase 32c.3.3: primary/secondary/tertiary variants with sm/md/lg sizes.
 * Phase 32c.3.6: added warning + destructive variants.
 * Press scale via RN core Animated (no Reanimated/babel-plugin dependency).
 * Loading state replaces label with ActivityIndicator; disabled dims to 0.5 opacity.
 */
export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  leftIcon,
  style,
}: ButtonProps) {
  const { colors } = useTheme();
  const { bg, fg, borderColor } = getButtonColors(variant, colors);
  const spec = SIZE_SPECS[size];
  const scale = useRef(new Animated.Value(1)).current;

  const isInteractive = !loading && !disabled;

  function handlePressIn() {
    if (!isInteractive) return;
    Animated.timing(scale, {
      toValue: PRESS_SCALE,
      duration: PRESS_DURATION,
      easing: PRESS_EASING,
      useNativeDriver: true,
    }).start();
  }

  function handlePressOut() {
    if (!isInteractive) return;
    Animated.timing(scale, {
      toValue: 1,
      duration: PRESS_DURATION,
      easing: PRESS_EASING,
      useNativeDriver: true,
    }).start();
  }

  function handlePress() {
    if (!isInteractive) return;
    onPress();
  }

  const wrapperStyle: ViewStyle = {
    alignSelf: fullWidth ? 'stretch' : 'flex-start',
  };

  const containerStyle: ViewStyle = {
    height: spec.height,
    paddingHorizontal: spec.paddingH,
    backgroundColor: bg,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: disabled ? 0.5 : 1,
    width: fullWidth ? '100%' : undefined,
  };

  if (borderColor) {
    containerStyle.borderWidth = 0.5;
    containerStyle.borderColor = borderColor;
  }

  return (
    <Animated.View style={[wrapperStyle, { transform: [{ scale }] }, style]}>
      <TouchableOpacity
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        activeOpacity={1}
        disabled={disabled || loading}
        style={containerStyle}
      >
        {loading ? (
          <ActivityIndicator size="small" color={fg} />
        ) : (
          <>
            {leftIcon ? <View style={{ marginRight: 8 }}>{leftIcon}</View> : null}
            <Text
              style={{
                color: fg,
                fontSize: spec.fontSize,
                fontFamily: 'Manrope_600SemiBold',
                fontWeight: '600',
              }}
            >
              {label}
            </Text>
          </>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}