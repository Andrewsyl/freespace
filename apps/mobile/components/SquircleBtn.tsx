import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { SquircleView } from "react-native-figma-squircle";
import Reanimated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

interface SquircleBtnProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

export function SquircleBtn({
  label,
  onPress,
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  style,
}: SquircleBtnProps) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    ...(fullWidth ? { width: "100%" as unknown as number } : {}),
  }));

  const inactive = disabled || loading;

  return (
    <Pressable
      onPressIn={() => {
        if (inactive) return;
        scale.value = withSpring(0.96, { damping: 10, stiffness: 380 });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 8, stiffness: 280 });
      }}
      onPress={inactive ? undefined : onPress}
      style={[
        styles.shadow,
        disabled && styles.shadowDisabled,
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      <Reanimated.View style={animStyle}>
        <SquircleView
          squircleParams={{
            cornerRadius: 20,
            cornerSmoothing: 1,
            fillColor: disabled ? "#C4CCD5" : "#0a8050",
          }}
          style={[styles.inner, fullWidth && styles.fullWidth]}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
              <Text style={[styles.label, disabled && styles.labelDisabled]}>
                {label}
              </Text>
            </>
          )}
        </SquircleView>
      </Reanimated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  shadow: {
    shadowColor: "#0a7a50",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.26,
    shadowRadius: 12,
    elevation: 5,
  },
  shadowDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  fullWidth: {
    width: "100%",
  },
  inner: {
    height: 52,
    paddingHorizontal: 24,
    minWidth: 120,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontFamily: "PlusJakartaSans-SemiBold",
    fontSize: 16,
    color: "#ffffff",
    letterSpacing: -0.3,
  },
  labelDisabled: {
    color: "#6b7280",
  },
});
