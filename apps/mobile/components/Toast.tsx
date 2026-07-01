import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { CircleCheck, Info, TriangleAlert, X, type LucideIcon } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { cardShadow, colors, radius, spacing } from "../styles/theme";

type ToastProps = {
  message: string;
  variant?: "success" | "info" | "danger";
  visible: boolean;
  onDismiss?: () => void;
  toastKey?: number;
};

const variantStyles = {
  success: { accent: "#0a8050", icon: CircleCheck },
  info: { accent: "#2563eb", icon: Info },
  danger: { accent: "#b42318", icon: TriangleAlert },
} satisfies Record<NonNullable<ToastProps["variant"]>, { accent: string; icon: LucideIcon }>;

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
  // Keep the toast mounted through its exit animation. Driven off `visible` so a
  // hide fades/slides out instead of snapping to null, and a re-show always starts
  // from the hidden values (set below) so it never flashes at full opacity first.
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (visible) {
      setRendered(true);
      translateY.setValue(-18);
      opacity.setValue(0);
      const anim = Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 260,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 220,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]);
      anim.start();
      return () => anim.stop();
    }
    const anim = Animated.parallel([
      Animated.timing(translateY, {
        toValue: -18,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    anim.start(({ finished }) => {
      if (finished) setRendered(false);
    });
    return () => anim.stop();
  }, [visible, opacity, toastKey, translateY]);

  if (!rendered) return null;

  const tone = variantStyles[variant];
  const ToneIcon = tone.icon;

  return (
    <Animated.View
      style={[
        styles.viewport,
        { top: Math.max(insets.top + 10, 18), opacity, transform: [{ translateY }] },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[styles.container, { borderLeftColor: tone.accent }]}
      >
        <ToneIcon size={16} color={tone.accent} strokeWidth={2.2} style={styles.icon} />
        <Text style={styles.text} numberOfLines={2}>{message}</Text>
        {onDismiss ? (
          <Pressable style={styles.dismissButton} onPress={onDismiss} accessibilityRole="button">
            <X size={16} color={colors.textSoft} strokeWidth={2.2} />
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
    borderLeftWidth: 3,
    flexDirection: "row",
    marginHorizontal: spacing.screenX,
    paddingHorizontal: 14,
    paddingVertical: 11,
    ...cardShadow,
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 6,
  },
  icon: {
    marginRight: 10,
    flexShrink: 0,
  },
  text: {
    fontFamily: "PlusJakartaSans-SemiBold",
    color: colors.text,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  dismissButton: {
    alignItems: "center",
    height: 26,
    justifyContent: "center",
    marginLeft: 8,
    width: 26,
    flexShrink: 0,
  },
});
