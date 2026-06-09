import React from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { buttons, primaryButtonShadow, colors, spacing, textStyles } from "../../styles/theme";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "large",
  disabled = false,
  loading = false,
  style,
  textStyle,
  testID,
}: ButtonProps) {
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
        activeOpacity={0.9}
        testID={testID}
        style={[
          styles.button,
          styles[variant],
          styles[size],
          (disabled || loading) && styles.disabled,
          style,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={variant === "primary" ? colors.cardBg : colors.accent} />
        ) : (
          <Text style={[styles.text, styles[`${variant}Text`], styles[`${size}Text`], textStyle]}>
            {title}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  primary: {
    ...buttons.primary,
    ...primaryButtonShadow,
  },
  secondary: {
    ...buttons.secondary,
  },
  outline: {
    ...buttons.secondary,
    backgroundColor: colors.cardBg,
    borderColor: colors.accent,
    borderWidth: 2,
  },
  ghost: {
    ...buttons.ghost,
    backgroundColor: colors.accentSoft,
  },
  small: {
    height: 40,
    paddingHorizontal: spacing.md,
  },
  medium: {
    height: 46,
    paddingHorizontal: spacing.lg,
  },
  large: {
    height: 52,
    paddingHorizontal: spacing.xl,
  },
  disabled: {
    opacity: 1,
    backgroundColor: colors.border,
    borderColor: colors.border,
  },
  text: {
    ...textStyles.button,
  },
  primaryText: {
    color: colors.cardBg,
  },
  secondaryText: {
    color: colors.text,
  },
  outlineText: {
    color: colors.accent,
  },
  ghostText: {
    color: colors.accent,
  },
  smallText: {
    fontSize: 13,
    lineHeight: 18,
  },
  mediumText: {
    fontSize: 15,
    lineHeight: 22,
  },
  largeText: {
    fontSize: 15,
    lineHeight: 22,
  },
});
