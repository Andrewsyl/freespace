import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import * as Haptics from "expo-haptics";
import { colors, radius } from "../styles/theme";

// The app-wide primary CTA ("full green" button). Shaped like the search
// field's Hourly/Monthly switch chip (`modeChip` in SearchScreen) with colours
// flipped to filled: primary fill, inverse (light) bold label, brandDark on
// press. SquircleBtn is a thin alias over this, so every CTA shares one look.
export function BookButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  fullWidth = false,
  icon,
  style,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}) {
  const inactive = disabled || loading;
  return (
    <Pressable
      onPressIn={() => {
        if (inactive) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }}
      onPress={inactive ? undefined : onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.chip,
        fullWidth && styles.fullWidth,
        disabled && styles.chipDisabled,
        pressed && !inactive && styles.chipPressed,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.textInverse} />
      ) : (
        <>
          {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
          <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    borderWidth: 1.5,
    borderRadius: radius.pill,
    paddingHorizontal: 24,
    paddingVertical: 14,
    minWidth: 132,
  },
  fullWidth: {
    width: "100%",
  },
  chipPressed: {
    backgroundColor: colors.brandDark,
    borderColor: colors.brandDark,
  },
  chipDisabled: {
    backgroundColor: colors.border,
    borderColor: colors.border,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 16,
    color: colors.textInverse,
    letterSpacing: -0.2,
  },
  labelDisabled: {
    color: colors.textDisabled,
  },
});
