import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cardShadow, colors, radius, spacing, textStyles } from "../styles/theme";

type ToastProps = {
  message: string;
  variant?: "success" | "info" | "danger";
  visible: boolean;
  onDismiss?: () => void;
  toastKey?: number;
};

const variantStyles = {
  success: { accent: "#0fa968", icon: "checkmark-circle" as const, label: "Success" },
  info: { accent: "#2563eb", icon: "information-circle" as const, label: "Notice" },
  danger: { accent: "#b42318", icon: "alert-circle" as const, label: "Error" },
} as const;

export function Toast({
  message,
  variant = "success",
  visible,
  onDismiss,
  toastKey,
}: ToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(-18)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    translateY.setValue(-18);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, opacity, toastKey, translateY]);

  if (!visible) return null;

  const tone = variantStyles[variant];

  return (
    <Animated.View
      style={[
        styles.viewport,
        { top: Math.max(insets.top + 10, 18), opacity, transform: [{ translateY }] },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.container,
          {
            borderColor: tone.accent,
          },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: `${tone.accent}14` }]}>
          <Ionicons name={tone.icon} size={18} color={tone.accent} />
        </View>
        <View style={styles.content}>
          <Text style={styles.label}>{tone.label}</Text>
          <Text style={styles.text}>{message}</Text>
        </View>
        {onDismiss ? (
          <Pressable style={styles.dismissButton} onPress={onDismiss} accessibilityRole="button">
            <Ionicons name="close" size={18} color={colors.textSoft} />
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    left: 0,
    position: "absolute",
    right: 0,
    zIndex: 120,
  },
  container: {
    alignItems: "center",
    backgroundColor: colors.cardBg,
    borderRadius: radius.card,
    borderWidth: 1,
    flexDirection: "row",
    marginHorizontal: spacing.screenX,
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...cardShadow,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 6,
  },
  iconWrap: {
    alignItems: "center",
    borderRadius: 14,
    height: 34,
    justifyContent: "center",
    marginRight: 12,
    width: 34,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  label: {
    ...textStyles.label,
    color: colors.textSoft,
  },
  text: {
    ...textStyles.bodyStrong,
    color: colors.text,
    paddingRight: 4,
  },
  dismissButton: {
    alignItems: "center",
    height: 28,
    justifyContent: "center",
    marginLeft: 8,
    width: 28,
  },
});
